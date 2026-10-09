import React, { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import type { FormularyItem } from '../types/pharmacy';

interface EditInventoryItemModalProps {
  item: FormularyItem;
  onClose: () => void;
}

export const EditInventoryItemModal: React.FC<EditInventoryItemModalProps> = ({ item, onClose }) => {
  const { updateInventoryItem } = usePharmacy();
  const [name, setName] = useState(item.name);
  const [sku, setSku] = useState(item.sku);
  const [presentation, setPresentation] = useState(item.presentation);
  const [category, setCategory] = useState(item.category);
  const [minThreshold, setMinThreshold] = useState(String(item.minThreshold));
  const [shelfLocation, setShelfLocation] = useState(item.shelfLocation);
  const [formDescription, setFormDescription] = useState(item.formDescription);
  const [costPriceGhc, setCostPriceGhc] = useState(String(item.costPriceGhc));
  const [sellingPriceGhc, setSellingPriceGhc] = useState(String(item.sellingPriceGhc));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const quantity = item.currentBalance;
  const threshold = Number(minThreshold);
  const grade = quantity === 0 ? 'Out of stock' : quantity <= threshold ? 'Low stock' : 'In stock';
  const gradeClass = quantity === 0
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : quantity <= threshold
      ? 'text-amber-800 bg-amber-50 border-amber-200'
      : 'text-emerald-800 bg-emerald-50 border-emerald-200';

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
              <p className="text-xs text-slate-400">Update item details and stock grade threshold</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close edit item dialog" className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-700">Quantity remaining</p>
              <p className="mt-0.5 text-slate-500">Update quantities through stock receipt, dispensing, or adjustment records.</p>
            </div>
            <span className="shrink-0 font-mono font-bold text-slate-900">{quantity} {item.unit}</span>
          </div>

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

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span className="font-semibold text-slate-600">Grade at {quantity} {item.unit} remaining</span>
            <span className={`px-2 py-1 rounded-full border text-[11px] font-bold ${gradeClass}`}>{grade}</span>
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-xs font-bold text-white bg-[#197882] hover:bg-[#14646D] rounded-lg shadow-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
