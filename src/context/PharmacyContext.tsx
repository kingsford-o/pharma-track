import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  FormularyItem, 
  LedgerTransaction, 
  MarketBenchmark, 
  ActiveScreen 
} from '../types/pharmacy';
import { 
  INITIAL_FORMULARY_ITEMS, 
  INITIAL_LEDGER_TRANSACTIONS, 
  INITIAL_MARKET_BENCHMARKS 
} from '../data/mockPharmacyData';

interface ReceiveStockParams {
  itemId: string;
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
  quantityToDispense: number;
  referenceNo: string;
  destinationOrPatient: string;
  notes?: string;
  recordedBy?: string;
}

interface PharmacyContextType {
  items: FormularyItem[];
  ledger: LedgerTransaction[];
  marketBenchmarks: Record<string, MarketBenchmark>;
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  selectedItem: FormularyItem | undefined;
  
  // High-level Actions
  receiveStock: (params: ReceiveStockParams) => Promise<{ success: boolean; message: string }>;
  dispenseStock: (params: DispenseStockParams) => Promise<{ success: boolean; message: string }>;
  addNewItem: (item: Omit<FormularyItem, 'id' | 'currentBalance' | 'batches' | 'status' | 'earliestExpiry' | 'sku'> & { sku?: string; initialQuantity?: number; initialBatchNo?: string; initialExpiryDate?: string }) => void;
  
  // Real-time market verification
  getMarketBenchmark: (itemName: string) => MarketBenchmark | undefined;
  
  // UI states
  isSupabaseConnected: boolean;
  isSchemaModalOpen: boolean;
  setIsSchemaModalOpen: (open: boolean) => void;
  syncTimestamp: string;
  refreshLedgerSync: () => void;
  notification: { type: 'success' | 'error' | 'info'; message: string } | null;
  clearNotification: () => void;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

const STORAGE_KEY_ITEMS = 'pharmatrack_items_v1';
const STORAGE_KEY_LEDGER = 'pharmatrack_ledger_v1';

export const PharmacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<FormularyItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_FORMULARY_ITEMS;
  });

  const [ledger, setLedger] = useState<LedgerTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LEDGER);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_LEDGER_TRANSACTIONS;
  });

  const [marketBenchmarks] = useState<Record<string, MarketBenchmark>>(INITIAL_MARKET_BENCHMARKS);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('dashboard');
  const [selectedItemId, setSelectedItemId] = useState<string>('med-pcm-500'); // Default to Paracetamol 500mg
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [syncTimestamp, setSyncTimestamp] = useState('01/10/2026 09:41 AM');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LEDGER, JSON.stringify(ledger));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [ledger]);

  const selectedItem = items.find(i => i.id === selectedItemId) || items[0];

  const clearNotification = () => setNotification(null);

  const refreshLedgerSync = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncTimestamp(`01/10/2026 ${timeStr}`);
    setNotification({
      type: 'info',
      message: 'Perpetual ledger and batch synchronization refreshed successfully.',
    });
  };

  const getMarketBenchmark = (itemName: string): MarketBenchmark | undefined => {
    return marketBenchmarks[itemName] || Object.values(marketBenchmarks).find(b => 
      itemName.toLowerCase().includes(b.itemName.toLowerCase().slice(0, 8))
    );
  };

  /**
   * Receive stock workflow:
   * 1. Checks/confirms physical stock balance on shelf
   * 2. Incorporates physical audit count if corrected
   * 3. Adds newly delivered consignment
   * 4. Appends to batch list & stock movement ledger
   */
  const receiveStock = async (params: ReceiveStockParams): Promise<{ success: boolean; message: string }> => {
    const targetItem = items.find(i => i.id === params.itemId);
    if (!targetItem) {
      return { success: false, message: 'Item not found in formulary catalog.' };
    }

    const expiryDateObj = new Date(params.expiryDate);
    const today = new Date('2026-10-01');
    const diffTime = expiryDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Calculate updated balance
    // If user confirmed a physical count before receipt, use that base + quantityReceived
    const verifiedBaseStock = Number(params.physicalCountBeforeReceipt);
    const newBalance = verifiedBaseStock + Number(params.quantityReceived);

    const newBatch = {
      id: `b-${Date.now()}`,
      batchNo: params.batchNo.trim().toUpperCase(),
      shelfLocation: targetItem.shelfLocation,
      expiryDate: params.expiryDate,
      expiryDaysLeft: Math.max(0, diffDays),
      initialQuantity: Number(params.quantityReceived),
      currentQuantity: Number(params.quantityReceived),
      costPriceGhc: Number(params.costPriceGhc),
      supplierName: params.supplier,
      isEarliestExpiry: false,
    };

    // Update item batches and recalculate status & earliest expiry
    setItems(prevItems => {
      return prevItems.map(item => {
        if (item.id !== params.itemId) return item;

        const updatedBatches = [...item.batches, newBatch].sort(
          (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
        );

        // Mark earliest expiry
        if (updatedBatches.length > 0) {
          updatedBatches.forEach((b, idx) => {
            b.isEarliestExpiry = idx === 0;
          });
        }

        const earliestBatch = updatedBatches.find(b => b.currentQuantity > 0);
        let earliestDateFormatted = item.earliestExpiry;
        if (earliestBatch) {
          const parts = earliestBatch.expiryDate.split('-');
          if (parts.length === 3) {
            earliestDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }

        let newStatus: FormularyItem['status'] = 'In stock';
        if (newBalance === 0) {
          newStatus = 'Out of stock';
        } else if (newBalance <= item.minThreshold) {
          newStatus = 'Low stock';
        } else if (earliestBatch && earliestBatch.expiryDaysLeft <= 90) {
          newStatus = 'Expiring soon';
        }

        return {
          ...item,
          currentBalance: newBalance,
          costPriceGhc: Number(params.costPriceGhc),
          sellingPriceGhc: Number(params.sellingPriceGhc),
          earliestExpiry: earliestDateFormatted,
          status: newStatus,
          batches: updatedBatches,
        };
      });
    });

    // Append to Ledger
    const expiryParts = params.expiryDate.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expiryLabel = expiryParts.length === 3 
      ? `${monthNames[parseInt(expiryParts[1], 10) - 1] || 'Exp'} ${expiryParts[0]}`
      : 'Nov 2028';

    const newLedgerTx: LedgerTransaction = {
      id: `tx-${Date.now()}`,
      date: '01 Oct 2026',
      rawDate: '2026-10-01',
      type: 'Received',
      supplierOrCustomer: params.supplier,
      referenceDetails: `GRN #${params.batchNo}`,
      batchNo: params.batchNo.trim().toUpperCase(),
      expiryLabel,
      qtyIn: Number(params.quantityReceived),
      qtyOut: null,
      balanceAfter: newBalance,
      recordedBy: params.recordedBy || 'S. Jenkins, Pharmacist',
      isHighlight: true,
    };

    setLedger(prev => [newLedgerTx, ...prev]);

    setNotification({
      type: 'success',
      message: `Successfully received ${params.quantityReceived} ${targetItem.unit} of ${targetItem.name}. New shelf balance: ${newBalance} ${targetItem.unit}.`,
    });

    return { 
      success: true, 
      message: `Stock posted to bin card. Perpetual ledger updated to ${newBalance} ${targetItem.unit}.` 
    };
  };

  /**
   * Dispense stock workflow:
   * 1. Validates that quantityToDispense <= available balance
   * 2. Automatically allocates according to FEFO (earliest expiring batch first)
   * 3. Updates batches & ledger
   */
  const dispenseStock = async (params: DispenseStockParams): Promise<{ success: boolean; message: string }> => {
    const targetItem = items.find(i => i.id === params.itemId);
    if (!targetItem) {
      return { success: false, message: 'Item not found in formulary catalog.' };
    }

    if (params.quantityToDispense > targetItem.currentBalance) {
      return {
        success: false,
        message: `Requested quantity (${params.quantityToDispense}) exceeds available stock (${targetItem.currentBalance}). Shortfall: -${params.quantityToDispense - targetItem.currentBalance} ${targetItem.unit}.`,
      };
    }

    let remainingToDeduct = params.quantityToDispense;
    const sortedBatches = [...targetItem.batches].sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    );

    let primaryBatchNo = sortedBatches[0]?.batchNo || 'PRC-26H14';
    let primaryExpiryLabel = 'Nov 2026';

    const updatedBatches = sortedBatches.map(batch => {
      if (remainingToDeduct <= 0 || batch.currentQuantity <= 0) return batch;

      const deductAmount = Math.min(batch.currentQuantity, remainingToDeduct);
      remainingToDeduct -= deductAmount;
      return {
        ...batch,
        currentQuantity: batch.currentQuantity - deductAmount,
      };
    });

    const newBalance = targetItem.currentBalance - params.quantityToDispense;

    setItems(prevItems => {
      return prevItems.map(item => {
        if (item.id !== params.itemId) return item;

        const earliestBatch = updatedBatches.find(b => b.currentQuantity > 0);
        let newStatus: FormularyItem['status'] = 'In stock';
        if (newBalance === 0) {
          newStatus = 'Out of stock';
        } else if (newBalance <= item.minThreshold) {
          newStatus = 'Low stock';
        } else if (earliestBatch && earliestBatch.expiryDaysLeft <= 90) {
          newStatus = 'Expiring soon';
        }

        return {
          ...item,
          currentBalance: newBalance,
          status: newStatus,
          batches: updatedBatches,
        };
      });
    });

    const newLedgerTx: LedgerTransaction = {
      id: `tx-${Date.now()}`,
      date: '01 Oct 2026',
      rawDate: '2026-10-01',
      type: 'Dispensed',
      supplierOrCustomer: params.destinationOrPatient || 'Outpatient Dispensary (OPD #1098)',
      referenceDetails: params.referenceNo || 'Direct ambulatory issue',
      batchNo: primaryBatchNo,
      expiryLabel: primaryExpiryLabel,
      qtyIn: null,
      qtyOut: params.quantityToDispense,
      balanceAfter: newBalance,
      recordedBy: params.recordedBy || 'S. Jenkins, Pharmacist',
      isHighlight: true,
      isBreachAlert: newBalance < targetItem.minThreshold,
    };

    setLedger(prev => [newLedgerTx, ...prev]);

    setNotification({
      type: 'success',
      message: `Dispensed ${params.quantityToDispense} ${targetItem.unit} against ${params.referenceNo}. Shelf balance updated to ${newBalance} ${targetItem.unit}.`,
    });

    return { 
      success: true, 
      message: `Dispense authorized via FEFO protocol. Balance is now ${newBalance}.` 
    };
  };

  const addNewItem = (newItemData: any) => {
    const id = `med-${Date.now().toString(36)}`;
    const initialQty = Number(newItemData.initialQuantity) || 0;
    const batchNo = newItemData.initialBatchNo?.trim().toUpperCase() || `BAT-${new Date().getFullYear()}-01`;
    const expiryDate = newItemData.initialExpiryDate || '2027-12-31';

    const newBatches = initialQty > 0 ? [{
      id: `b-${Date.now()}`,
      batchNo,
      shelfLocation: newItemData.shelfLocation || 'Shelf A-01-A',
      expiryDate,
      expiryDaysLeft: 450,
      initialQuantity: initialQty,
      currentQuantity: initialQty,
      costPriceGhc: Number(newItemData.costPriceGhc) || 0,
      supplierName: 'General Medical Supply Ltd',
      isEarliestExpiry: true,
    }] : [];

    let status: FormularyItem['status'] = 'In stock';
    if (initialQty === 0) status = 'Out of stock';
    else if (initialQty <= (newItemData.minThreshold || 50)) status = 'Low stock';

    const newItem: FormularyItem = {
      id,
      sku: newItemData.sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
      name: newItemData.name,
      presentation: newItemData.presentation || 'Solid Oral',
      category: newItemData.category || 'Therapeutic',
      unit: newItemData.unit || 'tabs',
      currentBalance: initialQty,
      minThreshold: Number(newItemData.minThreshold) || 100,
      shelfLocation: newItemData.shelfLocation || 'Shelf A-01-A',
      formDescription: newItemData.formDescription || 'Standard Formulary Unit',
      costPriceGhc: Number(newItemData.costPriceGhc) || 0.5,
      sellingPriceGhc: Number(newItemData.sellingPriceGhc) || 1.0,
      earliestExpiry: initialQty > 0 ? '31/12/2027' : 'None',
      status,
      batches: newBatches,
    };

    setItems(prev => [newItem, ...prev]);

    if (initialQty > 0) {
      const newLedgerTx: LedgerTransaction = {
        id: `tx-${Date.now()}`,
        date: '01 Oct 2026',
        rawDate: '2026-10-01',
        type: 'Received',
        supplierOrCustomer: 'Initial Inventory Ingestion',
        referenceDetails: `Opening Balance GRN #${batchNo}`,
        batchNo,
        expiryLabel: 'Dec 2027',
        qtyIn: initialQty,
        qtyOut: null,
        balanceAfter: initialQty,
        recordedBy: 'S. Jenkins, Pharmacist',
        isHighlight: true,
      };
      setLedger(prev => [newLedgerTx, ...prev]);
    }

    setNotification({
      type: 'success',
      message: `Formulary drug "${newItem.name}" added successfully to perpetual catalog.`,
    });
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
        addNewItem,
        getMarketBenchmark,
        isSupabaseConnected: false, // In-memory + storage engine with ready Supabase setup
        isSchemaModalOpen,
        setIsSchemaModalOpen,
        syncTimestamp,
        refreshLedgerSync,
        notification,
        clearNotification,
      }}
    >
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error('usePharmacy must be used within a PharmacyProvider');
  }
  return context;
};
