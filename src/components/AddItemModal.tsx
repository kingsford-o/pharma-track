import React, { useState } from 'react';
import { X, Plus, ShieldCheck } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

interface AddItemModalProps {
  onClose: () => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ onClose }) => {
  const { addNewItem } = usePharmacy();

  const [name, setName] = useState('');
  const [presentation, setPresentation] = useState('Solid Oral');
  const [category, setCategory] = useState('Analgesic');
  const [unit, setUnit] = useState('tabs');
  const [minThreshold, setMinThreshold] = useState<number | string>(0);
  const [shelfLocation, setShelfLocation] = useState('');
  const [costPriceGhc, setCostPriceGhc] = useState<number | string>('');
  const [sellingPriceGhc, setSellingPriceGhc] = useState<number | string>('');
  const [initialQuantity, setInitialQuantity] = useState<number | string>(0);
  const [initialBatchNo, setInitialBatchNo] = useState(`BAT-${new Date().getFullYear()}-01`);
  const [initialExpiryDate, setInitialExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter the medicine name.');
      return;
    }
    if (Number(initialQuantity) > 0 && (!initialBatchNo.trim() || !initialExpiryDate)) {
      setError('Enter the opening batch number and expiry date when adding opening stock.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addNewItem({
        name: name.trim(),
        presentation,
        category,
        unit,
        minThreshold: Number(minThreshold),
        shelfLocation,
        formDescription: `${presentation} pack`,
        costPriceGhc: Number(costPriceGhc),
        sellingPriceGhc: Number(sellingPriceGhc),
        initialQuantity: Number(initialQuantity),
        initialBatchNo,
        initialExpiryDate,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add this medicine.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Add Formulary Drug</h2>
              <p className="text-xs text-slate-400">Enroll new medicine into perpetual catalog</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Drug Generic &amp; Strength Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Paracetamol 500mg tablets"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Presentation</label>
              <select
                value={presentation}
                onChange={(e) => setPresentation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="Solid Oral">Solid Oral</option>
                <option value="Capsule">Capsule</option>
                <option value="Antibiotic">Antibiotic</option>
                <option value="Antidiabetic">Antidiabetic</option>
                <option value="Hydration">Hydration</option>
                <option value="Pediatric">Pediatric</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dispensing Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="tabs">tabs (Tablets)</option>
                <option value="caps">caps (Capsules)</option>
                <option value="sachets">sachets</option>
                <option value="vials">vials</option>
                <option value="bottles">bottles</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Minimum Safety Reorder Level</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shelf Location</label>
              <input
                type="text"
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                placeholder="e.g. Shelf B-02-A"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cost Price (GH₵)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={costPriceGhc}
                onChange={(e) => setCostPriceGhc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Selling Price (GH₵)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={sellingPriceGhc}
                onChange={(e) => setSellingPriceGhc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Initial Stock Opening Batch */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
              Opening Consignment (Initial Stock)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Initial Quantity ({unit})</label>
                <input
                  type="number"
                  min="0"
                  value={initialQuantity}
                  onChange={(e) => setInitialQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Batch Number</label>
                <input
                  type="text"
                  value={initialBatchNo}
                  onChange={(e) => setInitialBatchNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono uppercase"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-slate-600 mb-1">Expiry date {Number(initialQuantity) > 0 ? '(required)' : '(optional)'}</label>
                <input
                  type="date"
                  value={initialExpiryDate}
                  onChange={(e) => setInitialExpiryDate(e.target.value)}
                  required={Number(initialQuantity) > 0}
                  min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs"
                />
              </div>
            </div>
          </div>

          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-[#197882] hover:bg-[#14646D] rounded-lg shadow-sm disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Formulary Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
