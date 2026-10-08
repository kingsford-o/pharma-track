import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, RefreshCw } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { apiGet } from '../../services/api';
import type { FormularyItem } from '../../types/pharmacy';

type OperationsView = 'sales' | 'finance' | 'reconciliation';

interface Transaction {
  id: string;
  type: 'sale' | 'purchase' | 'receipt';
  item_name: string | null;
  quantity: number;
  amount: number;
  created_at: string;
}

const currency = (value: number) =>
  `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const OperationsScreen: React.FC<{ view: OperationsView }> = ({ view }) => {
  const { setActiveScreen } = usePharmacy();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<FormularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [transactionData, inventoryData] = await Promise.all([
        apiGet<{ transactions: Transaction[] }>('/api/transactions'),
        view === 'reconciliation'
          ? apiGet<{ items: FormularyItem[]; ledger: unknown[] }>('/api/inventory')
          : Promise.resolve({ items: [], ledger: [] }),
      ]);
      setTransactions(transactionData.transactions);
      setItems(inventoryData.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not load this report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [view]);

  const currentMonth = new Date();
  const monthTransactions = transactions.filter((tx) => {
    const created = new Date(tx.created_at);
    return created.getFullYear() === currentMonth.getFullYear() && created.getMonth() === currentMonth.getMonth();
  });
  const sales = transactions.filter((tx) => tx.type === 'sale');
  const saleTotal = monthTransactions.filter((tx) => tx.type === 'sale').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const purchaseTotal = monthTransactions.filter((tx) => tx.type === 'purchase').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const mismatches = useMemo(
    () => items.filter((item) => item.currentBalance !== item.batches.reduce((sum, batch) => sum + batch.currentQuantity, 0)),
    [items],
  );
  const title = view === 'sales' ? 'Sales & Business' : view === 'finance' ? 'Finance & Accounts' : 'Stock Reconciliation';

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {view === 'sales' && 'Recorded dispense transactions from your pharmacy.'}
            {view === 'finance' && 'Recorded sales and stock purchases for the current month.'}
            {view === 'reconciliation' && 'Compare recorded inventory balances with the remaining batch quantities.'}
          </p>
        </div>
        <button onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh from server
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading your records…</p> : (
        <>
          {view === 'finance' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">Recorded sales this month</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{currency(saleTotal)}</p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">Recorded purchases this month</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{currency(purchaseTotal)}</p>
              </section>
            </div>
          )}

          {view === 'reconciliation' ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold text-slate-900">Batch balance check</h2>
              </div>
              {items.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No inventory records to reconcile yet.</p>
              ) : mismatches.length === 0 ? (
                <p className="p-8 text-center text-sm text-emerald-700">Inventory balances match the recorded batch quantities.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {mismatches.map((item) => {
                    const batchTotal = item.batches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
                    return (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <AlertTriangle className="h-4 w-4 text-amber-600" /> {item.name}
                        </span>
                        <span className="text-sm text-slate-600">Balance {item.currentBalance} · batches {batchTotal}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold text-slate-900">{view === 'sales' ? 'Recorded sales' : 'Recent transactions'}</h2>
              </div>
              {transactions.length === 0 || (view === 'sales' && sales.length === 0) ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm text-slate-600">No transactions recorded yet.</p>
                  <button onClick={() => setActiveScreen(view === 'sales' ? 'dispense' : 'inventory')} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
                    {view === 'sales' ? 'Record a dispense' : 'Open inventory'} <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Item</th><th className="px-5 py-3">Type</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3 text-right">Amount</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(view === 'sales' ? sales : transactions).map((tx) => (
                        <tr key={tx.id}>
                          <td className="whitespace-nowrap px-5 py-3 text-slate-600">{new Date(tx.created_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3 font-medium text-slate-800">{tx.item_name || '—'}</td>
                          <td className="px-5 py-3 capitalize text-slate-600">{tx.type}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-700">{tx.quantity}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-700">{currency(Number(tx.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};
