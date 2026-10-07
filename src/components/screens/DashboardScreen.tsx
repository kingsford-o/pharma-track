import React, { useMemo } from 'react';
import {
  ShoppingCart,
  Package,
  Pill,
  ArrowUpRight,
  ArrowDownRight,
  PackageX,
  TriangleAlert,
  CalendarClock,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { useProfile } from '../../context/ProfileContext';
import { useDashboardData, type Kpi } from '../../hooks/useDashboardData';

const CATEGORY_COLORS = ['bg-brand-600', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-400'];

const money = (n: number) => `GH₵ ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

/* Batch expiry: adjust the field names here if yours differ */
const expiryOf = (batch: unknown): Date | null => {
  const b = batch as Record<string, unknown>;
  const raw = b.expiryDate ?? b.expiry ?? b.expiryAt;
  if (!raw) return null;
  const d = new Date(raw as string);
  return isNaN(d.getTime()) ? null : d;
};

/* ----------------------------- small pieces ----------------------------- */

const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 80},${26 - ((v - min) / (max - min || 1)) * 22}`)
    .join(' ');
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const TrendChart: React.FC<{ data: { day: string; value: number }[] }> = ({ data }) => {
  const W = 600;
  const H = 180;
  const max = (Math.max(...data.map((d) => d.value)) || 1) * 1.1;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * W, H - (d.value / max) * H] as const);
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full text-brand-600" preserveAspectRatio="none" role="img" aria-label="Sales for the last 7 days">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="#e2e8f0" strokeDasharray="4 4" />
        ))}
        <polygon points={area} fill="currentColor" opacity="0.08" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        {data.map((d, i) => (
          <span key={`${d.day}-${i}`}>{d.day}</span>
        ))}
      </div>
    </div>
  );
};

const Card: React.FC<{ title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  action,
  children,
  className = '',
}) => (
  <section className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`}>
    {title && (
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {action}
      </div>
    )}
    {children}
  </section>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="py-6 text-center text-sm text-slate-500">{children}</p>
);

const KpiCard: React.FC<{ label: string; kpi: Kpi }> = ({ label, kpi }) => (
  <Card>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{money(kpi.total)}</div>
      </div>
      <div className="text-brand-600">
        <Sparkline data={kpi.trend} />
      </div>
    </div>
    <div className="mt-3 text-xs">
      {kpi.delta === null ? (
        <span className="text-slate-400">This month so far</span>
      ) : (
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-0.5 font-semibold ${
              kpi.delta >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {kpi.delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(kpi.delta)}%
          </span>
          <span className="text-slate-400">vs last month</span>
        </span>
      )}
    </div>
  </Card>
);

/* -------------------------------- screen -------------------------------- */

export const DashboardScreen: React.FC = () => {
  const { items, setActiveScreen, setSelectedItemId } = usePharmacy();
  const { profile } = useProfile();
  const { kpis, week, topSelling, hasData, loading, error, live } = useDashboardData(profile?.id);

  const { outOfStock, lowStock, expiringCount, restock } = useMemo(() => {
    const out = items.filter((i) => i.currentBalance === 0);
    const low = items.filter((i) => i.currentBalance > 0 && i.currentBalance <= i.minThreshold);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 90);
    const expiring = items.filter((i) =>
      i.batches.some((b) => {
        const d = expiryOf(b);
        return d !== null && d <= cutoff;
      }),
    ).length;
    const list = [...out, ...low]
      .sort((a, b) => a.currentBalance / (a.minThreshold || 1) - b.currentBalance / (b.minThreshold || 1))
      .slice(0, 6);
    return { outOfStock: out.length, lowStock: low.length, expiringCount: expiring, restock: list };
  }, [items]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => {
      const c = (i as unknown as { category?: string }).category?.trim() || 'Uncategorised';
      map.set(c, (map.get(c) ?? 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], idx) => ({ name, count, bar: CATEGORY_COLORS[idx] }));
  }, [items]);

  const openReceive = (itemId?: string) => {
    if (itemId) setSelectedItemId(itemId);
    setActiveScreen('receive');
  };
  const openDispense = () => setActiveScreen('dispense');
  const openInventory = () => setActiveScreen('inventory');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.manager_name.split(' ')[0] ?? '';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const topMax = Math.max(...topSelling.map((m) => m.units), 1);
  const catTotal = categories.reduce((s, c) => s + c.count, 0) || 1;
  const weekHasSales = week.some((d) => d.value > 0);

  const alerts = [
    { label: 'Out of stock', value: outOfStock, hint: 'Cannot be dispensed', icon: PackageX, tone: 'text-rose-700 bg-rose-50 border-rose-100' },
    { label: 'Running low', value: lowStock, hint: 'At or below minimum level', icon: TriangleAlert, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
    { label: 'Expiring in 90 days', value: expiringCount, hint: 'Check batches before they lapse', icon: CalendarClock, tone: 'text-orange-700 bg-orange-50 border-orange-100' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Title + actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 flex items-center gap-3 text-sm text-slate-500">
            {today}
            {live && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openDispense}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <ShoppingCart className="h-4 w-4" />
            New sale
          </button>
          <button
            onClick={() => openReceive()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Package className="h-4 w-4 text-slate-500" />
            New purchase
          </button>
          <button
            onClick={openInventory}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Pill className="h-4 w-4 text-slate-500" />
            Add medicine
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Stock attention */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {alerts.map(({ label, value, hint, icon: Icon, tone }) => (
          <button
            key={label}
            onClick={openInventory}
            className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-shadow hover:shadow-md ${tone}`}
          >
            <Icon className="h-6 w-6 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">{value}</span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
              <div className="truncate text-xs opacity-80">{hint}</div>
            </div>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
        <KpiCard label="Total sales" kpi={kpis.sale} />
        <KpiCard label="Purchases" kpi={kpis.purchase} />
        <KpiCard label="Receipts" kpi={kpis.receipt} />
      </div>

      {/* Trend + restock */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card title="Sales this week" className="lg:col-span-3">
          {weekHasSales ? (
            <TrendChart data={week} />
          ) : (
            <Empty>{hasData ? 'No sales in the last 7 days.' : 'Your sales will appear here once you record your first one.'}</Empty>
          )}
        </Card>

        <Card
          title="Needs restocking"
          className="lg:col-span-2"
          action={
            <button onClick={openInventory} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              View all
            </button>
          }
        >
          {items.length === 0 ? (
            <Empty>No medicines yet. Add your first one in Inventory.</Empty>
          ) : restock.length === 0 ? (
            <Empty>Everything is above its minimum level.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {restock.map((item) => {
                const pct = Math.min(100, Math.round((item.currentBalance / (item.minThreshold || 1)) * 100));
                const empty = item.currentBalance === 0;
                return (
                  <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-800">{item.name}</div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full ${empty ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {empty ? 'Out of stock' : `${item.currentBalance} left`}, minimum {item.minThreshold}
                      </div>
                    </div>
                    <button
                      onClick={() => openReceive(item.id)}
                      className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Receive
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Top sellers + categories */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top selling medicine (last 30 days)">
          {topSelling.length === 0 ? (
            <Empty>Top sellers will show up after your first sales.</Empty>
          ) : (
            <ul className="space-y-4">
              {topSelling.map((m) => (
                <li key={m.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{m.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{m.units.toLocaleString()} units</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(m.units / topMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Medicine categories">
          {categories.length === 0 ? (
            <Empty>Add medicines in Inventory to see your categories.</Empty>
          ) : (
            <>
              <div className="mb-5 flex h-3 overflow-hidden rounded-full">
                {categories.map((c) => (
                  <div key={c.name} className={c.bar} style={{ width: `${(c.count / catTotal) * 100}%` }} title={c.name} />
                ))}
              </div>
              <ul className="space-y-3">
                {categories.map((c) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2.5 font-medium text-slate-700">
                      <span className={`h-2.5 w-2.5 rounded-full ${c.bar}`} />
                      {c.name}
                    </span>
                    <span className="tabular-nums text-slate-600">{c.count} items</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
