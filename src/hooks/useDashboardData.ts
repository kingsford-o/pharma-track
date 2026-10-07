import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type TxType = 'sale' | 'purchase' | 'receipt';

interface Tx {
  id: string;
  type: TxType;
  item_name: string | null;
  quantity: number;
  amount: number;
  created_at: string;
}

export interface Kpi {
  total: number;
  delta: number | null; // % change vs last month, null if last month had no data
  trend: number[]; // last 7 days
}

const sumBy = (txs: Tx[], pick: (t: Tx) => number) => txs.reduce((s, t) => s + pick(t), 0);

function summarise(txs: Tx[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  const days = Array.from(
    { length: 7 },
    (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i)),
  );

  const dayKey = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const kpiFor = (type: TxType): Kpi => {
    const mine = txs.filter((t) => t.type === type);
    const thisMonth = mine.filter((t) => new Date(t.created_at) >= monthStart);
    const lastMonth = mine.filter((t) => {
      const d = new Date(t.created_at);
      return d >= prevMonthStart && d < monthStart;
    });

    const total = sumBy(thisMonth, (t) => Number(t.amount));
    const prev = sumBy(lastMonth, (t) => Number(t.amount));
    const delta = prev > 0 ? Math.round(((total - prev) / prev) * 1000) / 10 : null;

    const trend = days.map((day) =>
      sumBy(
        mine.filter((t) => dayKey(new Date(t.created_at)) === dayKey(day)),
        (t) => Number(t.amount),
      ),
    );

    return { total, delta, trend };
  };

  const kpis: Record<TxType, Kpi> = {
    sale: kpiFor('sale'),
    purchase: kpiFor('purchase'),
    receipt: kpiFor('receipt'),
  };

  const week = days.map((d, i) => ({
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    value: kpis.sale.trend[i],
  }));

  const soldUnits = new Map<string, number>();
  txs
    .filter((t) => t.type === 'sale' && t.item_name && new Date(t.created_at) >= thirtyDaysAgo)
    .forEach((t) => soldUnits.set(t.item_name as string, (soldUnits.get(t.item_name as string) ?? 0) + t.quantity));

  const topSelling = [...soldUnits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, units]) => ({ name, units }));

  return { kpis, week, topSelling };
}

export function useDashboardData(pharmacyId: string | undefined) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    if (!pharmacyId) return;
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 1, 1); // start of last month

    const { data, error: err } = await supabase
      .from('transactions')
      .select('id, type, item_name, quantity, amount, created_at')
      .eq('pharmacy_id', pharmacyId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (err) setError('We could not load your latest numbers.');
    else {
      setError('');
      setTxs((data ?? []) as Tx[]);
    }
    setLoading(false);
  }, [pharmacyId]);

  useEffect(() => {
    if (!pharmacyId) return;
    load();

    const channel = supabase
      .channel(`transactions-${pharmacyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `pharmacy_id=eq.${pharmacyId}` },
        () => load(),
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pharmacyId, load]);

  const summary = useMemo(() => summarise(txs), [txs]);

  return { ...summary, hasData: txs.length > 0, loading, error, live };
}
