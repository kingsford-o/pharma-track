import React, { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import type { FormularyItem } from '../types/pharmacy';

const localDateValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

interface EditInventoryItemModalProps {
  item: FormularyItem;
  onClose: () => void;
}

export const EditInventoryItemModal: React.FC<EditInventoryItemModalProps> = ({ item, onClose }) => {
  const { updateInventoryItem, adjustStock } = usePharmacy();
  const [name, setName] = useState(item.name);
  const [sku, setSku] = useState(item.sku);
  const [presentation, setPresentation] = useState(item.presentation);
  const [category, setCategory] = useState(item.category);
  const [minThreshold, setMinThreshold] = useState(String(item.minThreshold));
  const [shelfLocation, setShelfLocation] = useState(item.shelfLocation);
  const [formDescription, setFormDescription] = useState(item.formDescription);
  const [costPriceGhc, setCostPriceGhc] = useState(String(item.costPriceGhc));
  const [sellingPriceGhc, setSellingPriceGhc] = useState(String(item.sellingPriceGhc));
  const [quantity, setQuantity] = useState(String(item.currentBalance));
  const [savedQuantity, setSavedQuantity] = useState(item.currentBalance);
  const [adjustmentDate, setAdjustmentDate] = useState(localDateValue);
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [error, setError] = useState('');
  const [stockError, setStockError] = useState('');

  const targetQuantity = Number(quantity);
  const hasValidQuantity = quantity !== '' && Number.isInteger(targetQuantity) && targetQuantity >= 0;
  const requiresNewBatch = hasValidQuantity && targetQuantity > savedQuantity;
  const threshold = Number(minThreshold);
  const grade = !hasValidQuantity ? 'Enter a valid quantity' : targetQuantity === 0 ? 'Out of stock' : targetQuantity <= threshold ? 'Low stock' : 'In stock';
  const gradeClass = !hasValidQuantity
    ? 'text-slate-600 bg-slate-50 border-slate-200'
    : targetQuantity === 0
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : targetQuantity <= threshold
      ? 'text-amber-800 bg-amber-50 border-amber-200'
      : 'text-emerald-800 bg-emerald-50 border-emerald-200';
  const earliestValidExpiry = new Date();
  earliestValidExpiry.setDate(earliestValidExpiry.getDate() + 1);
  const earliestValidExpiryDate = [
    earliestValidExpiry.getFullYear(),
    String(earliestValidExpiry.getMonth() + 1).padStart(2, '0'),
    String(earliestValidExpiry.getDate()).padStart(2, '0'),
  ].join('-');

  const handleStockAdjustment = async () => {
    setStockError('');
    if (!hasValidQuantity) {
      setStockError('Enter a non-negative whole number for the available quantity.');
      return;
    }
    if (requiresNewBatch && (!batchNo.trim() || !expiryDate)) {
      setStockError('Enter the new batch number and expiry date before increasing stock.');
      return;
    }
    setSavingStock(true);
    try {
      await adjustStock({
        itemId: item.id,
        targetQuantity,
        adjustmentDate,
        ...(requiresNewBatch ? { batchNo: batchNo.trim(), expiryDate } : {}),
      });
      setSavedQuantity(targetQuantity);
      setQuantity(String(targetQuantity));
      setBatchNo('');
      setExpiryDate('');
    } catch (cause) {
      setStockError(cause instanceof Error ? cause.message : 'Could not adjust this stock quantity.');
    } finally {
      setSavingStock(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateInventoryItem({
        ...item,
        name: name.trim(),
        sku: sku.trim(),
        presentation: presentation.trim(),
        category: category.trim(),
        minThreshold: Number(minThreshold),
        shelfLocation: shelfLocation.trim(),
        formDescription: formDescription.trim(),
        costPriceGhc: Number(costPriceGhc),
        sellingPriceGhc: Number(sellingPriceGhc),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this medicine.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Edit Inventory Item</h2>
              <p className="text-xs text-slate-400">Update item details, available quantity, and grade threshold</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close edit item dialog" className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <section className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label htmlFor="edit-stock-quantity" className="font-bold text-slate-700">Available quantity ({item.unit})</label>
                <p className="mt-0.5 text-slate-500">Enter the total amount currently on hand.</p>
              </div>
              <input
                id="edit-stock-quantity"
                aria-label={`Available quantity in ${item.unit}`}
                type="number"
                min="0"
                step="1"
                required
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setStockError('');
                }}
                className={`${inputClass} max-w-32 font-mono text-right`}
              />
            </div>
            <div>
              <label htmlFor="stock-adjustment-date" className="block font-bold text-slate-700 mb-1">Adjustment date</label>
              <input
                id="stock-adjustment-date"
                type="date"
                max={localDateValue()}
                required
                value={adjustmentDate}
                onChange={(event) => setAdjustmentDate(event.target.value)}
                className={inputClass}
              />
            </div>
            {requiresNewBatch && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-teal-200 bg-white p-3">
                <p className="col-span-2 text-slate-600">Increasing quantity creates a new traceable batch. Enter its batch number and expiry date.</p>
                <div>
                  <label htmlFor="adjustment-batch-no" className="block font-bold text-slate-700 mb-1">Batch number</label>
                  <input id="adjustment-batch-no" maxLength={80} value={batchNo} onChange={(event) => setBatchNo(event.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="adjustment-expiry-date" className="block font-bold text-slate-700 mb-1">Expiry date</label>
                  <input id="adjustment-expiry-date" type="date" min={earliestValidExpiryDate} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className={inputClass} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Grade at {hasValidQuantity ? targetQuantity : '—'} {item.unit}</span>
                <span className={`px-2 py-1 rounded-full border text-[11px] font-bold ${gradeClass}`}>{grade}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleStockAdjustment()}
                disabled={savingStock || saving || !hasValidQuantity || (targetQuantity === savedQuantity && !requiresNewBatch)}
                className="px-3 py-2 text-xs font-bold text-white bg-[#197882] hover:bg-[#14646D] rounded-lg disabled:opacity-60"
              >
                {savingStock ? 'Updating stock…' : 'Update stock quantity'}
              </button>
            </div>
            {stockError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{stockError}</p>}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Medicine name</label>
              <input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Barcode / SKU</label>
              <input required maxLength={80} value={sku} onChange={(event) => setSku(event.target.value)} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category</label>
              <input required maxLength={100} value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Presentation</label>
              <input maxLength={100} value={presentation} onChange={(event) => setPresentation(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Minimum level ({item.unit})</label>
              <input type="number" min="0" step="1" required value={minThreshold} onChange={(event) => setMinThreshold(event.target.value)} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Shelf location</label>
              <input maxLength={100} value={shelfLocation} onChange={(event) => setShelfLocation(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Cost price (GH₵)</label>
              <input type="number" min="0" step="0.01" required value={costPriceGhc} onChange={(event) => setCostPriceGhc(event.target.value)} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Selling price (GH₵)</label>
              <input type="number" min="0" step="0.01" required value={sellingPriceGhc} onChange={(event) => setSellingPriceGhc(event.target.value)} className={`${inputClass} font-mono`} />
            </div>
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Form description</label>
              <input maxLength={200} value={formDescription} onChange={(event) => setFormDescription(event.target.value)} className={inputClass} />
            </div>
          </div>

          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving || savingStock} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={saving || savingStock} className="px-5 py-2 text-xs font-bold text-white bg-[#197882] hover:bg-[#14646D] rounded-lg shadow-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
