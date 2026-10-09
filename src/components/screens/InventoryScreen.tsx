import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Layers, 
  FileText, 
  Pencil,
  Trash2,
  X,
  Calendar, 
  Check, 
  AlertTriangle,
  Wallet
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { AddItemModal } from '../AddItemModal';
import { EditInventoryItemModal } from '../EditInventoryItemModal';
import type { FormularyItem } from '../../types/pharmacy';

type FilterTab = 'all' | 'low_stock' | 'expiring_soon' | 'out_of_stock';

const isExpiringSoon = (item: { batches: { currentQuantity: number; expiryDaysLeft: number }[] }) =>
  item.batches.some((batch) => batch.currentQuantity > 0 && batch.expiryDaysLeft >= 0 && batch.expiryDaysLeft <= 90);

export const InventoryScreen: React.FC = () => {
  const { items, setSelectedItemId, setActiveScreen, syncTimestamp, deleteInventoryItem } = usePharmacy();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<FormularyItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FormularyItem | null>(null);
  const [isDeletingItemId, setIsDeletingItemId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Dynamic counts
  const lowStockCount = items.filter(i => i.currentBalance > 0 && i.currentBalance <= i.minThreshold).length;
  const expiringCount = items.filter(isExpiringSoon).length;
  const outOfStockCount = items.filter(i => i.currentBalance === 0).length;

  // Calculate Total Stock Value at Cost
  const totalStockValueAtCost = items.reduce((acc, item) => {
    return acc + (item.currentBalance * item.costPriceGhc);
  }, 0);

  // Filtering
  const filteredItems = items.filter(item => {
    // Search match
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.presentation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Tab match
    if (activeTab === 'low_stock') {
      return item.currentBalance > 0 && item.currentBalance <= item.minThreshold;
    }
    if (activeTab === 'expiring_soon') {
      return isExpiringSoon(item);
    }
    if (activeTab === 'out_of_stock') {
      return item.currentBalance === 0;
    }
    return true;
  });

  const handleOpenBinCard = (itemId: string) => {
    setSelectedItemId(itemId);
    setActiveScreen('bincard');
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    const item = itemToDelete;
    setIsDeletingItemId(item.id);
    setDeleteError('');
    try {
      await deleteInventoryItem(item);
      setItemToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'We could not delete this medicine.');
    } finally {
      setIsDeletingItemId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumb & Screen Title */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            OPERATIONS &gt; <span className="text-teal-600">INVENTORY</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Inventory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Formulary catalog, real-time stock balances, and FEFO expiry tracking.
          </p>
        </div>

        {/* Total Stock Value at Cost Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3.5 self-start">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              TOTAL STOCK VALUE AT COST
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums">
              GH₵ {totalStockValueAtCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter inventory items, brand or generic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
          />
        </div>

        {/* Filter Tabs & Add Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'all' 
                  ? 'bg-white text-slate-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('low_stock')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'low_stock' 
                  ? 'bg-white text-amber-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Low stock ({lowStockCount})
            </button>
            <button
              onClick={() => setActiveTab('expiring_soon')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'expiring_soon' 
                  ? 'bg-white text-rose-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expiring soon ({expiringCount})
            </button>
            <button
              onClick={() => setActiveTab('out_of_stock')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'out_of_stock' 
                  ? 'bg-white text-slate-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Out of stock ({outOfStockCount})
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#197882] hover:bg-[#15666f] rounded-lg transition-colors shadow-xs cursor-pointer ml-auto md:ml-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add new item</span>
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Item</th>
                <th className="py-3 px-3 text-center">Balance</th>
                <th className="py-3 px-3 text-center">Minimum Level</th>
                <th className="py-3 px-3 text-center">Earliest Expiry</th>
                <th className="py-3 px-3 text-center">Stock grade</th>
                <th className="py-3 px-3 text-right">Cost Price (GH₵)</th>
                <th className="py-3 px-3 text-right">Selling Price (GH₵)</th>
                <th className="py-3 px-4 sm:px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isOutOfStock = item.currentBalance === 0;
                const isLow = item.currentBalance > 0 && item.currentBalance <= item.minThreshold;
                const isExpiring = isExpiringSoon(item);

                // Color accent bar on left edge
                const borderIndicator = isOutOfStock 
                  ? 'border-l-4 border-l-rose-600' 
                  : isLow 
                    ? 'border-l-4 border-l-amber-500' 
                    : isExpiring 
                      ? 'border-l-4 border-l-orange-500' 
                      : 'border-l-4 border-l-emerald-500';

                return (
                  <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${borderIndicator}`}>
                    <td className="py-3 px-4 sm:px-6">
                      <div className="font-bold text-slate-900 leading-tight">
                        {item.name.replace(/ tablets| capsules| dispersible tablets/i, '')}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.name.includes('500mg') ? '500mg tablets' : 
                         item.name.includes('250mg') ? '250mg capsules' :
                         item.name.includes('400mg') ? '400mg tablets' :
                         item.name.includes('20mg') ? '20mg capsules' :
                         item.name.includes('10mg') ? '10mg tablets' :
                         item.name.includes('5mg') ? '5mg tablets' : ''} • {item.presentation}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`font-mono font-bold tabular-nums text-xs ${
                        isOutOfStock ? 'text-rose-600' :
                        isLow ? 'text-amber-700' : 'text-emerald-700'
                      }`}>
                        {item.currentBalance} {item.unit}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono tabular-nums text-slate-600 text-xs">
                      {item.minThreshold} {item.unit}
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-xs">
                      {item.earliestExpiry === 'None' ? (
                        <span className="text-slate-400">None</span>
                      ) : (
                        <span className={isExpiring ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          {item.earliestExpiry}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Out of stock</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Low stock</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                            <Check className="w-3 h-3" />
                            <span>In stock</span>
                          </span>
                        )}
                        {isExpiring && <span className="text-[10px] font-semibold text-orange-700">Expiring soon</span>}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 text-xs font-medium">
                      {item.costPriceGhc.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 text-xs font-semibold">
                      {item.sellingPriceGhc.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 sm:px-6 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setItemToEdit(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors shadow-2xs"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleOpenBinCard(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span>Bin card</span>
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError('');
                            setItemToDelete(item);
                          }}
                          disabled={isDeletingItemId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded transition-colors shadow-2xs disabled:opacity-60"
                          aria-label={`Permanently delete ${item.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isDeletingItemId === item.id ? 'Deleting…' : 'Delete'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{syncTimestamp ? `Synced ${syncTimestamp}` : 'Inventory sync pending'} · FEFO batch allocation active</span>
          </div>
          <div>
            Showing {filteredItems.length} of {items.length} cataloged formulary items
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <AddItemModal onClose={() => setIsAddModalOpen(false)} />
      )}
      {itemToEdit && (
        <EditInventoryItemModal item={itemToEdit} onClose={() => setItemToEdit(null)} />
      )}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-item-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between bg-rose-700 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5" />
                <h2 id="delete-item-title" className="font-bold">Permanently delete inventory item</h2>
              </div>
              <button type="button" onClick={() => setItemToDelete(null)} disabled={isDeletingItemId !== null} aria-label="Cancel deletion" className="rounded-lg p-1.5 text-rose-100 hover:bg-rose-800 disabled:opacity-60">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="space-y-4 p-6">
              <p className="text-sm text-slate-700">Delete <strong>{itemToDelete.name}</strong> permanently?</p>
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800">
                This also permanently deletes {itemToDelete.currentBalance} {itemToDelete.unit} remaining, all batches, and the stock ledger history. This cannot be undone.
              </p>
              {deleteError && <p role="alert" className="rounded-lg border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-rose-700">{deleteError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setItemToDelete(null)} disabled={isDeletingItemId !== null} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  Cancel
                </button>
                <button type="button" onClick={() => void handleDeleteItem()} disabled={isDeletingItemId !== null} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60">
                  <Trash2 className="h-4 w-4" />
                  {isDeletingItemId !== null ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
