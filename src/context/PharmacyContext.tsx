import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { FormularyItem, LedgerTransaction, MarketBenchmark, ActiveScreen } from '../types/pharmacy';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { useProfile } from './ProfileContext';

interface ReceiveStockParams {
  itemId: string;
  locationId?: string;
  supplier: string;
  batchNo: string;
  expiryDate: string;
  quantityReceived: number;
  physicalCountBeforeReceipt: number;
  costPriceGhc: number;
  sellingPriceGhc: number;
  recordedBy?: string;
}

interface DispenseStockParams {
  itemId: string;
  locationId?: string;
  quantityToDispense: number;
  referenceNo: string;
  destinationOrPatient: string;
  prescriberName?: string;
  notes?: string;
  recordedBy?: string;
}

interface AdjustStockParams {
  itemId: string;
  targetQuantity: number;
  adjustmentDate: string;
  batchNo?: string;
  expiryDate?: string;
}

type NewItem = Omit<FormularyItem, 'id' | 'currentBalance' | 'batches' | 'status' | 'earliestExpiry' | 'sku'> & {
  sku?: string;
  initialQuantity?: number;
  initialBatchNo?: string;
  initialExpiryDate?: string;
};

interface PharmacyContextType {
  items: FormularyItem[];
  ledger: LedgerTransaction[];
  marketBenchmarks: Record<string, MarketBenchmark>;
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  selectedItem: FormularyItem | undefined;
  receiveStock: (params: ReceiveStockParams) => Promise<{ success: boolean; message: string }>;
  dispenseStock: (params: DispenseStockParams) => Promise<{ success: boolean; message: string }>;
  adjustStock: (params: AdjustStockParams) => Promise<void>;
  addNewItem: (item: NewItem) => Promise<void>;
  updateInventoryItem: (item: FormularyItem) => Promise<void>;
  deleteInventoryItem: (item: FormularyItem) => Promise<void>;
  getMarketBenchmark: (itemName: string) => MarketBenchmark | undefined;
  isSupabaseConnected: boolean;
  isSchemaModalOpen: boolean;
  setIsSchemaModalOpen: (open: boolean) => void;
  syncTimestamp: string;
  refreshLedgerSync: () => void;
  notification: { type: 'success' | 'error' | 'info'; message: string } | null;
  clearNotification: () => void;
  reloadInventory: () => Promise<void>;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

const benchmarkFromRow = (row: Record<string, unknown>): MarketBenchmark => ({
  itemName: String(row.item_name),
  wholesaleRefGhc: Number(row.wholesale_ref_ghc),
  retailCapGhc: Number(row.retail_cap_ghc),
  marketRangeMinGhc: Number(row.market_range_min_ghc),
  marketRangeMaxGhc: Number(row.market_range_max_ghc),
  source: String(row.source),
  trend: row.trend as MarketBenchmark['trend'],
  lastUpdated: String(row.last_updated),
});

export const PharmacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useProfile();
  const [items, setItems] = useState<FormularyItem[]>([]);
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [marketBenchmarks, setMarketBenchmarks] = useState<Record<string, MarketBenchmark>>({});
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('dashboard');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [syncTimestamp, setSyncTimestamp] = useState('');
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [notification, setNotification] = useState<PharmacyContextType['notification']>(null);

  const reloadInventory = useCallback(async () => {
    const data = await apiGet<{ items: FormularyItem[]; ledger: LedgerTransaction[] }>('/api/inventory');
    setItems(data.items);
    setLedger(data.ledger);
    setIsSupabaseConnected(true);
    setSyncTimestamp(new Date().toLocaleString());
    setSelectedItemId((current) => data.items.some((item) => item.id === current) ? current : data.items[0]?.id || '');
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!profile) return;
    void Promise.all([
      apiGet<{ items: FormularyItem[]; ledger: LedgerTransaction[] }>('/api/inventory'),
      apiGet<Record<string, unknown>[]>('/api/market-prices'),
    ])
      .then(([inventory, rows]) => {
        if (!mounted) return;
        setItems(inventory.items);
        setLedger(inventory.ledger);
        setMarketBenchmarks(Object.fromEntries(rows.map((row) => {
          const benchmark = benchmarkFromRow(row);
          return [benchmark.itemName, benchmark];
        })));
        setIsSupabaseConnected(true);
        setSyncTimestamp(new Date().toLocaleString());
        setSelectedItemId((current) => current || inventory.items[0]?.id || '');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setIsSupabaseConnected(false);
        setNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'We could not load pharmacy data.',
        });
      });
    return () => {
      mounted = false;
    };
  }, [profile]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0],
    [items, selectedItemId],
  );
  const clearNotification = () => setNotification(null);

  const refreshLedgerSync = () => {
    void reloadInventory()
      .then(() => setNotification({ type: 'success', message: 'Inventory and stock ledger refreshed from the server.' }))
      .catch((error: unknown) =>
        setNotification({ type: 'error', message: error instanceof Error ? error.message : 'Refresh failed.' }),
      );
  };

  const getMarketBenchmark = (itemName: string) =>
    marketBenchmarks[itemName] ??
    Object.values(marketBenchmarks).find((benchmark) =>
      itemName.toLowerCase().includes(benchmark.itemName.toLowerCase().slice(0, 8)),
    );

  const receiveStock: PharmacyContextType['receiveStock'] = async (params) => {
    try {
      const result = await apiPost<{ success: boolean; message: string }>(
        `/api/inventory/${encodeURIComponent(params.itemId)}/receive`,
        params,
      );
      await reloadInventory();
      setNotification({ type: 'success', message: result.message });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not record this stock receipt.';
      setNotification({ type: 'error', message });
      return { success: false, message };
    }
  };

  const dispenseStock: PharmacyContextType['dispenseStock'] = async (params) => {
    try {
      const result = await apiPost<{ success: boolean; message: string }>(
        `/api/inventory/${encodeURIComponent(params.itemId)}/dispense`,
        params,
      );
      await reloadInventory();
      setNotification({ type: 'success', message: result.message });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not record this dispense.';
      setNotification({ type: 'error', message });
      return { success: false, message };
    }
  };

  const adjustStock: PharmacyContextType['adjustStock'] = async (params) => {
    try {
      await apiPost<{ success: boolean; quantity: number }>(
        `/api/inventory/${encodeURIComponent(params.itemId)}/adjust`,
        params,
      );
      await reloadInventory();
      const item = items.find((candidate) => candidate.id === params.itemId);
      setNotification({
        type: 'success',
        message: `${item?.name ?? 'Stock quantity'} adjusted and inventory grade recalculated.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not adjust this stock quantity.';
      setNotification({ type: 'error', message });
      throw new Error(message);
    }
  };

  const addNewItem: PharmacyContextType['addNewItem'] = async (item) => {
    try {
      await apiPost('/api/inventory', {
        ...item,
        initialQuantity: item.initialQuantity ?? 0,
      });
      await reloadInventory();
      setNotification({ type: 'success', message: `${item.name} added to your pharmacy inventory.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not add this medicine.';
      setNotification({ type: 'error', message });
      throw new Error(message);
    }
  };

  const updateInventoryItem: PharmacyContextType['updateInventoryItem'] = async (item) => {
    try {
      await apiPatch(`/api/inventory/${encodeURIComponent(item.id)}`, {
        sku: item.sku,
        name: item.name,
        presentation: item.presentation,
        category: item.category,
        minThreshold: item.minThreshold,
        shelfLocation: item.shelfLocation,
        formDescription: item.formDescription,
        costPriceGhc: item.costPriceGhc,
        sellingPriceGhc: item.sellingPriceGhc,
      });
      await reloadInventory();
      setNotification({ type: 'success', message: `${item.name} updated. Stock grade recalculated from the remaining quantity.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not update this medicine.';
      setNotification({ type: 'error', message });
      throw new Error(message);
    }
  };

  const deleteInventoryItem: PharmacyContextType['deleteInventoryItem'] = async (item) => {
    try {
      await apiDelete(`/api/inventory/${encodeURIComponent(item.id)}`);
      await reloadInventory();
      setNotification({ type: 'success', message: `${item.name} and its stock and ledger history were permanently deleted.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not delete this medicine.';
      setNotification({ type: 'error', message });
      throw new Error(message);
    }
  };

  return (
    <PharmacyContext.Provider
      value={{
        items,
        ledger,
        marketBenchmarks,
        activeScreen,
        setActiveScreen,
        selectedItemId,
        setSelectedItemId,
        selectedItem,
        receiveStock,
        dispenseStock,
        adjustStock,
        addNewItem,
        updateInventoryItem,
        deleteInventoryItem,
        getMarketBenchmark,
        isSupabaseConnected,
        isSchemaModalOpen,
        setIsSchemaModalOpen,
        syncTimestamp,
        refreshLedgerSync,
        notification,
        clearNotification,
        reloadInventory,
      }}
    >
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) throw new Error('usePharmacy must be used within a PharmacyProvider');
  return context;
};
