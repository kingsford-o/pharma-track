import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { InventorySize, NewProfile, StockCategory } from '../../context/ProfileContext';

interface OnboardingScreenProps {
  onSubmit: (input: NewProfile) => Promise<void>;
}

const SIZES: { value: InventorySize; label: string; hint: string }[] = [
  { value: 'small', label: 'Small', hint: 'Under 200 products' },
  { value: 'medium', label: 'Medium', hint: '200 to 1,000 products' },
  { value: 'large', label: 'Large', hint: 'More than 1,000 products' },
];

const STOCK_CATEGORIES: { value: StockCategory; label: string }[] = [
  { value: 'prescription_medicines', label: 'Prescription medicines' },
  { value: 'over_the_counter', label: 'Over-the-counter' },
  { value: 'controlled_drugs', label: 'Controlled drugs' },
  { value: 'herbal_and_supplements', label: 'Herbal and supplements' },
  { value: 'medical_supplies', label: 'Medical supplies' },
];

const inputClass =
  'h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onSubmit }) => {
  const [pharmacyName, setPharmacyName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [size, setSize] = useState<InventorySize | ''>('');
  const [stockCategories, setStockCategories] = useState<StockCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pharmacyName.trim() || !managerName.trim() || !size || stockCategories.length === 0) {
      setError('Fill in your pharmacy name, your name, inventory size, and at least one stock type.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: pharmacyName.trim(),
        manager_name: managerName.trim(),
        inventory_size: size,
        stock_categories: stockCategories,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z" />
            </svg>
          </div>
          <div className="text-lg font-bold text-slate-900">Axelle MD</div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Set up your pharmacy</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          This takes a minute. We use it to personalise your dashboard.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <div>
            <label htmlFor="pharmacy-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Pharmacy name
            </label>
            <input
              id="pharmacy-name"
              type="text"
              value={pharmacyName}
              onChange={(e) => setPharmacyName(e.target.value)}
              placeholder="e.g. Grace Community Pharmacy"
              autoComplete="organization"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="manager-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Your name
            </label>
            <input
              id="manager-name"
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="The manager's full name"
              autoComplete="name"
              className={inputClass}
            />
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-slate-700">Inventory size</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {SIZES.map((s) => (
                <label
                  key={s.value}
                  className="cursor-pointer rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40"
                >
                  <input
                    type="radio"
                    name="inventory-size"
                    value={s.value}
                    checked={size === s.value}
                    onChange={() => setSize(s.value)}
                    className="sr-only"
                  />
                  <div className="text-sm font-semibold text-slate-800">{s.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{s.hint}</div>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-slate-700">What do you stock?</legend>
            <p className="mb-2 text-xs text-slate-500">Choose all that apply. We will tailor features to your pharmacy.</p>
            <div className="space-y-2">
              {STOCK_CATEGORIES.map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={stockCategories.includes(value)}
                    onChange={(event) => {
                      setStockCategories((current) =>
                        event.target.checked ? [...current, value] : current.filter((category) => category !== value),
                      );
                    }}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving' : 'Set up my pharmacy'}
          </button>
        </form>
      </div>
    </div>
  );
};
