import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Barcode, Building2, ClipboardList, Package,
  Plus, RefreshCw, Shield, Stethoscope, Truck,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../services/api';
import { usePharmacy } from '../../context/PharmacyContext';
import { useProfile } from '../../context/ProfileContext';
import type { ActiveScreen } from '../../types/pharmacy';

export type HubTab = 'insights' | 'safety' | 'suppliers' | 'access' | 'patients' | 'locations' | 'barcode';
type Role = 'admin' | 'pharmacist' | 'cashier' | 'inventory_clerk';

const SCREEN_BY_TAB: Record<HubTab, ActiveScreen> = {
  insights: 'management-insights',
  safety: 'management-safety',
  suppliers: 'management-suppliers',
  access: 'management-access',
  patients: 'management-patients',
  locations: 'management-locations',
  barcode: 'management-barcode',
};

interface Item {
  id: string; sku: string; name: string; current_balance: number; min_threshold: number;
  cost_price_ghc: number; selling_price_ghc: number;
}
interface Batch {
  id: string; item_id: string; location_id: string | null; batch_no: string; expiry_date: string;
  current_quantity: number; cost_price_ghc: number; supplier_name: string; is_recalled: boolean;
}
interface Supplier { id: string; name: string; contact_name: string; email: string; phone: string; }
interface Delivery {
  id: string; supplier_id: string; reference: string; expected_date: string; status: 'pending' | 'received' | 'cancelled';
}
interface Location { id: string; name: string; address: string; is_primary: boolean; }
interface Patient { id: string; full_name: string; date_of_birth: string | null; phone: string; }
interface Prescription {
  id: string; patient_id: string; medicine_name: string; dosage: string; prescriber: string;
  prescribed_on: string; notes: string; active: boolean;
}
interface Staff { id: string; email: string; role: Role; active: boolean; }
interface Transaction { type: string; item_name: string | null; quantity: number; amount: number; created_at: string; }
interface Ledger { type: string; item_id: string; supplier_or_customer: string; qty_in: number | null; qty_out: number | null; balance_after: number; created_at: string; }
interface Recall { batch_id: string; reason: string; recalled_at: string; }
interface ManagementData {
  items: Item[]; batches: Batch[]; transactions: Transaction[]; ledger: Ledger[];
  suppliers: Supplier[]; deliveries: Delivery[]; locations: Location[]; recalls: Recall[];
}

const emptyData: ManagementData = {
  items: [], batches: [], transactions: [], ledger: [], suppliers: [], deliveries: [], locations: [], recalls: [],
};
const currency = (amount: number) => `GH₵ ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const controlClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';
const buttonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60';

const tabs: { id: HubTab; label: string; icon: React.ElementType }[] = [
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'safety', label: 'Safety', icon: AlertTriangle },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'access', label: 'Staff access', icon: Shield },
  { id: 'patients', label: 'Patients', icon: Stethoscope },
  { id: 'locations', label: 'Locations', icon: Building2 },
  { id: 'barcode', label: 'Barcode', icon: Barcode },
];

const PAGE_TITLES: Record<HubTab, string> = {
  insights: 'Data Insights Hub',
  safety: 'Safety Monitoring View',
  suppliers: 'Supplier Management Panel',
  access: 'Access Control Panel',
  patients: 'Patient Management Panel',
  locations: 'Multi-Location Support',
  barcode: 'Barcode Scanning',
};

export const ManagementHubScreen: React.FC<{ initialTab?: HubTab }> = ({ initialTab = 'insights' }) => {
  const { setActiveScreen, setSelectedItemId, reloadInventory } = usePharmacy();
  const { profile } = useProfile();
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [data, setData] = useState<ManagementData>(emptyData);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lookup, setLookup] = useState('');
  const [labelItem, setLabelItem] = useState<Item | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadManagement = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiGet<ManagementData>('/api/management'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not load pharmacy management data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const result = await apiGet<{ patients: Patient[]; prescriptions: Prescription[] }>('/api/management/patients');
      setPatients(result.patients);
      setPrescriptions(result.prescriptions);
      setSelectedPatient((current) => current || result.patients[0]?.id || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not load patient records.');
    }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const result = await apiGet<{ staff: Staff[] }>('/api/management/staff');
      setStaff(result.staff);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not load staff access.');
    }
  }, []);

  useEffect(() => { void loadManagement(); }, [loadManagement]);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => {
    if (tab === 'patients' && (profile?.role === 'admin' || profile?.role === 'pharmacist')) void loadPatients();
    if (tab === 'access' && profile?.role === 'admin') void loadStaff();
  }, [tab, profile?.role, loadPatients, loadStaff]);

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(message);
      await loadManagement();
      if (tab === 'safety' || tab === 'locations') await reloadInventory();
      if (tab === 'patients') await loadPatients();
      if (tab === 'access') await loadStaff();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const openItem = (item: Item) => {
    setSelectedItemId(item.id);
    setActiveScreen('inventory');
  };

  const findBarcode = (value: string) => {
    const found = data.items.find((item) => item.sku.toLowerCase() === value.trim().toLowerCase());
    if (!found) {
      setError(`No inventory item matches barcode or SKU "${value.trim()}".`);
      return;
    }
    setError('');
    setLookup(found.sku);
    setSelectedItemId(found.id);
    setActiveScreen('inventory');
  };

  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    type Detection = { rawValue: string };
    type Detector = { detect: (source: HTMLVideoElement) => Promise<Detection[]> };
    type DetectorConstructor = new (options?: { formats: string[] }) => Detector;
    const DetectorClass = (globalThis as typeof globalThis & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!DetectorClass) {
      setCameraError('Camera barcode scanning is not supported in this browser. A USB scanner or manual SKU entry still works.');
      setCameraOn(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access requires a secure browser connection. A USB scanner or manual SKU entry still works.');
      setCameraOn(false);
      return;
    }
    let active = true;
    setCameraError('');
    let detector: Detector;
    try {
      detector = new DetectorClass({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
    } catch {
      setCameraError('This browser does not support the available barcode formats.');
      setCameraOn(false);
      return;
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        const scan = async () => {
          if (!active || !videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results[0]?.rawValue && active) {
              setCameraOn(false);
              findBarcode(results[0].rawValue);
            }
          } catch {
            setCameraError('The camera could not read a barcode. Try entering the SKU manually.');
          }
        };
        const timer = window.setInterval(() => { void scan(); }, 500);
        cleanupScan = () => window.clearInterval(timer);
      })
      .catch(() => {
        if (active) setCameraError('Camera access was denied or unavailable. A USB scanner or manual SKU entry still works.');
      });
    let cleanupScan = () => {};
    return () => {
      active = false;
      cleanupScan();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOn]);

  const lowStock = data.items.filter((item) => item.current_balance <= item.min_threshold);
  const expiring = data.batches.filter((batch) => {
    const days = Math.ceil((new Date(`${batch.expiry_date}T00:00:00`).getTime() - Date.now()) / 86400000);
    return batch.current_quantity > 0 && !batch.is_recalled && days >= 0 && days <= 90;
  });
  const fastMoving = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of data.transactions) if (tx.type === 'sale' && tx.item_name) totals.set(tx.item_name, (totals.get(tx.item_name) ?? 0) + tx.quantity);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [data.transactions]);
  const adjustmentQty = data.ledger.filter((row) => row.type === 'Adjustment').reduce((sum, row) => sum + Math.abs(row.qty_out ?? 0) + Math.abs(row.qty_in ?? 0), 0);
  const inventoryValue = data.items.reduce((sum, item) => sum + item.current_balance * Number(item.cost_price_ghc), 0);
  const deliverySupplier = new Map(data.suppliers.map((supplier) => [supplier.id, supplier.name]));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">PharmAsyst · Pharmacy operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{PAGE_TITLES[tab]}</h1>
          <p className="mt-1 text-sm text-slate-500">Insights, safety, suppliers, patient records, staff access, and store locations.</p>
        </div>
        <button onClick={() => void loadManagement()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh records
        </button>
      </header>

      <nav aria-label="Management modules" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setActiveScreen(SCREEN_BY_TAB[id]); setError(''); setNotice(''); }}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading pharmacy records…</p> : (
        <>
          {tab === 'insights' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Inventory valuation at cost" value={currency(inventoryValue)} icon={Package} />
                <Metric label="Items at/below safety stock" value={String(lowStock.length)} icon={AlertTriangle} />
                <Metric label="Batches expiring in 90 days" value={String(expiring.length)} icon={Activity} />
                <Metric label="Adjustment quantity recorded" value={String(adjustmentQty)} icon={ClipboardList} />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="font-bold text-slate-900">Fast-moving items</h2>
                  <p className="mt-1 text-xs text-slate-500">Dispensed quantities from saved transactions.</p>
                  {fastMoving.length ? <ul className="mt-4 space-y-3">{fastMoving.map(([name, quantity]) => (
                    <li key={name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-700">{name}</span>
                      <span className="font-semibold tabular-nums text-brand-700">{quantity} dispensed</span>
                    </li>
                  ))}</ul> : <Empty>No dispense history is recorded yet.</Empty>}
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="font-bold text-slate-900">Supplier performance history</h2>
                  <p className="mt-1 text-xs text-slate-500">Recorded receipt quantities and tracked delivery completion.</p>
                  {data.suppliers.length ? <div className="mt-4 space-y-3">{data.suppliers.map((supplier) => {
                    const received = data.ledger.filter((row) => row.type === 'Received' && row.supplier_or_customer === supplier.name);
                    const receivedQuantity = received.reduce((sum, row) => sum + (row.qty_in ?? 0), 0);
                    const deliveries = data.deliveries.filter((delivery) => delivery.supplier_id === supplier.id);
                    const completed = deliveries.filter((delivery) => delivery.status === 'received').length;
                    return <div key={supplier.id} className="flex justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-0">
                      <span className="font-medium text-slate-700">{supplier.name}</span>
                      <span className="text-right text-slate-500">{received.length} receipts · {receivedQuantity} units · {deliveries.length ? `${completed}/${deliveries.length} tracked deliveries received` : 'No delivery history'}</span>
                    </div>;
                  })}</div> : <Empty>No suppliers have been recorded yet.</Empty>}
                  <p className="mt-3 text-xs text-slate-400">Adjustment totals flag recorded stock adjustments; investigate discrepancies before treating them as confirmed shrinkage.</p>
                </section>
              </div>
            </div>
          )}

          {tab === 'safety' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Upcoming expiries</h2><p className="mt-1 text-sm text-slate-500">Unrecalled stock expiring within 90 days.</p></div>
                {!expiring.length ? <Empty>No batches meet this expiry window.</Empty> : <ul className="divide-y divide-slate-100">{expiring.map((batch) => {
                  const item = data.items.find((entry) => entry.id === batch.item_id);
                  return <li key={batch.id} className="flex flex-wrap justify-between gap-3 px-5 py-4 text-sm">
                    <span><strong className="text-slate-800">{item?.name ?? 'Unknown item'}</strong><span className="block text-xs text-slate-500">Batch {batch.batch_no} · Qty {batch.current_quantity}</span></span>
                    <time className="font-medium text-amber-700">{new Date(`${batch.expiry_date}T00:00:00`).toLocaleDateString()}</time>
                  </li>;
                })}</ul>}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Recalled batches</h2><p className="mt-1 text-sm text-slate-500">Recalled lots are excluded from dispensing.</p></div>
                {!data.recalls.length ? <Empty>No recalls have been recorded.</Empty> : <ul className="divide-y divide-slate-100">{data.recalls.map((recall) => {
                  const batch = data.batches.find((entry) => entry.id === recall.batch_id);
                  const item = batch && data.items.find((entry) => entry.id === batch.item_id);
                  return <li key={recall.batch_id} className="px-5 py-4 text-sm">
                    <strong className="text-rose-800">{item?.name ?? 'Item'} · {batch?.batch_no ?? 'Batch'}</strong>
                    <p className="mt-1 text-slate-600">{recall.reason}</p>
                  </li>;
                })}</ul>}
                {(profile?.role === 'admin' || profile?.role === 'pharmacist') && (
                  <form className="space-y-3 border-t border-slate-100 p-5" onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const batchId = String(form.get('batchId') ?? '');
                    const reason = String(form.get('reason') ?? '');
                    void runAction(() => apiPost(`/api/management/batches/${encodeURIComponent(batchId)}/recall`, { reason }), 'Batch recall saved; this lot is blocked from dispensing.');
                    event.currentTarget.reset();
                  }}>
                    <h3 className="text-sm font-semibold text-slate-800">Block a batch from dispensing</h3>
                    <select name="batchId" required className={controlClass}><option value="">Choose a batch</option>{data.batches.filter((batch) => !batch.is_recalled).map((batch) => <option key={batch.id} value={batch.id}>{data.items.find((item) => item.id === batch.item_id)?.name} · {batch.batch_no}</option>)}</select>
                    <input name="reason" required maxLength={1000} placeholder="Recall reason / notice reference" className={controlClass} />
                    <button disabled={busy} className={buttonClass}>Record recall</button>
                  </form>
                )}
              </section>
            </div>
          )}

          {tab === 'suppliers' && (
            <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
              <section className="space-y-5">
                <Panel title="Supplier directory">
                  {data.suppliers.length ? <ul className="mb-4 divide-y divide-slate-100">{data.suppliers.map((supplier) => <li key={supplier.id} className="py-3 text-sm">
                    <strong className="text-slate-800">{supplier.name}</strong>
                    <p className="mt-1 text-slate-500">{[supplier.contact_name, supplier.phone, supplier.email].filter(Boolean).join(' · ') || 'No contact details'}</p>
                  </li>)}</ul> : <Empty>No suppliers recorded yet.</Empty>}
                  {(profile?.role === 'admin' || profile?.role === 'pharmacist' || profile?.role === 'inventory_clerk') && <form className="space-y-3 border-t border-slate-100 pt-4" onSubmit={(event) => {
                    event.preventDefault(); const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
                    void runAction(() => apiPost('/api/management/suppliers', body), 'Supplier details saved.');
                    event.currentTarget.reset();
                  }}>
                    <h3 className="text-sm font-semibold text-slate-800">Add or update supplier</h3>
                    <input name="name" required maxLength={160} placeholder="Supplier / vendor name" className={controlClass} />
                    <div className="grid gap-3 sm:grid-cols-2"><input name="contactName" placeholder="Contact person" className={controlClass} /><input name="phone" placeholder="Phone" className={controlClass} /></div>
                    <input name="email" type="email" placeholder="Email" className={controlClass} />
                    <button disabled={busy} className={buttonClass}><Plus className="h-4 w-4" />Save supplier</button>
                  </form>}
                </Panel>
                <Panel title="Automated reorder list">
                  <p className="mb-3 text-xs text-slate-500">Generated from saved safety thresholds; verify quantities before ordering.</p>
                  {lowStock.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-slate-500"><th className="pb-2">Medicine</th><th className="pb-2 text-right">On hand</th><th className="pb-2 text-right">Suggested</th></tr></thead><tbody>{lowStock.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="py-2 font-medium">{item.name}</td><td className="py-2 text-right">{item.current_balance}</td><td className="py-2 text-right font-semibold text-amber-700">{Math.max(item.min_threshold - item.current_balance, 0)}</td></tr>)}</tbody></table></div> : <Empty>All recorded items are above their safety thresholds.</Empty>}
                </Panel>
              </section>
              <section className="space-y-5">
                <Panel title="Pending vendor deliveries">
                  <p className="mb-3 text-xs text-slate-500">Delivery status is tracked separately from inventory receipts. Record received batch quantities in Receive Stock so balances and ledgers stay accurate.</p>
                  {!data.deliveries.length ? <Empty>No deliveries are being tracked.</Empty> : <ul className="divide-y divide-slate-100">{data.deliveries.map((delivery) => <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <span><strong className="text-slate-800">{delivery.reference}</strong><span className="block text-xs text-slate-500">{deliverySupplier.get(delivery.supplier_id) ?? 'Supplier'} · expected {delivery.expected_date}</span></span>
                    <span className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize text-slate-600">{delivery.status}</span>{delivery.status === 'pending' && <button disabled={busy} onClick={() => void runAction(() => apiPatch(`/api/management/deliveries/${delivery.id}`, { status: 'received' }), 'Delivery marked received.')} className="text-xs font-semibold text-brand-700">Mark received</button>}</span>
                  </li>)}</ul>}
                  {(profile?.role === 'admin' || profile?.role === 'pharmacist' || profile?.role === 'inventory_clerk') && <form className="mt-4 space-y-3 border-t border-slate-100 pt-4" onSubmit={(event) => {
                    event.preventDefault(); const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
                    void runAction(() => apiPost('/api/management/deliveries', body), 'Vendor delivery added to the tracker.');
                    event.currentTarget.reset();
                  }}>
                    <h3 className="text-sm font-semibold text-slate-800">Track an expected delivery</h3>
                    <select name="supplierId" required className={controlClass}><option value="">Choose supplier</option>{data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
                    <div className="grid gap-3 sm:grid-cols-2"><input name="reference" required placeholder="PO / delivery reference" className={controlClass} /><input name="expectedDate" required type="date" className={controlClass} /></div>
                    <button disabled={busy || !data.suppliers.length} className={buttonClass}><Plus className="h-4 w-4" />Track delivery</button>
                  </form>}
                </Panel>
                <Panel title="Vendor receipt history"><p className="text-sm text-slate-600">{data.ledger.filter((entry) => entry.type === 'Received').length} stock receipt ledger entries are available for supplier review.</p><button onClick={() => setActiveScreen('bincard')} className="mt-3 text-sm font-semibold text-brand-700">Review stock ledger</button></Panel>
              </section>
            </div>
          )}

          {tab === 'access' && (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <Panel title="Role-based access">
                {profile?.role !== 'admin' ? <Empty>Administrator permission is required to manage staff roles.</Empty> : <>
                  <p className="mb-4 text-sm text-slate-600">Assign roles to existing PharmAsyst accounts. Staff must create an account before they can be added.</p>
                  <div className="mb-5 space-y-3">{[
                    ['Pharmacist', 'Patient records, prescriptions, stock, and safety'],
                    ['Cashier', 'Sales and read-only operational summaries'],
                    ['Inventory clerk', 'Inventory, suppliers, deliveries, and location transfers'],
                    ['Admin', 'Full access; the pharmacy owner is the administrator'],
                  ].map(([role, detail]) => <div key={role} className="rounded-lg bg-slate-50 p-3"><strong className="text-sm text-slate-800">{role}</strong><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}</div>
                  <form className="space-y-3 border-t border-slate-100 pt-4" onSubmit={(event) => {
                    event.preventDefault(); const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
                    void runAction(() => apiPost('/api/management/staff', body), 'Staff role assigned.');
                    event.currentTarget.reset();
                  }}>
                    <input name="email" required type="email" placeholder="Staff member account email" className={controlClass} />
                    <select name="role" className={controlClass}><option value="pharmacist">Pharmacist</option><option value="cashier">Cashier</option><option value="inventory_clerk">Inventory clerk</option></select>
                    <button disabled={busy} className={buttonClass}><Plus className="h-4 w-4" />Assign access</button>
                  </form>
                </>}
              </Panel>
              <Panel title="Current staff">
                <div className="mb-3 border-b border-slate-100 pb-3 text-sm"><strong className="text-slate-800">{profile?.manager_name} · Pharmacy owner</strong><span className="ml-2 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">Administrator</span></div>
                {!staff.length ? <Empty>No additional staff members have been assigned.</Empty> : <ul className="divide-y divide-slate-100">{staff.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span><strong className="text-slate-800">{member.email}</strong><span className="block text-xs capitalize text-slate-500">{member.role.replace('_', ' ')} · {member.active ? 'Active' : 'Inactive'}</span></span>
                  {profile?.role === 'admin' && <div className="flex items-center gap-2">
                    <select aria-label={`Role for ${member.email}`} value={member.role} disabled={!member.active || busy} onChange={(event) => void runAction(() => apiPatch(`/api/management/staff/${member.id}`, { role: event.target.value }), 'Staff role updated.')} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                      <option value="pharmacist">Pharmacist</option><option value="cashier">Cashier</option><option value="inventory_clerk">Inventory clerk</option>
                    </select>
                    <button disabled={busy} onClick={() => void runAction(() => apiPatch(`/api/management/staff/${member.id}`, { active: !member.active }), member.active ? 'Staff access revoked.' : 'Staff access restored.')} className="text-xs font-semibold text-rose-700">{member.active ? 'Revoke' : 'Restore'}</button>
                  </div>}
                </li>)}</ul>}
              </Panel>
            </div>
          )}

          {tab === 'patients' && (
            profile?.role !== 'admin' && profile?.role !== 'pharmacist' ? <Panel title="Patient records"><Empty>Pharmacist or administrator permission is required to view patient information.</Empty></Panel> :
            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <section className="space-y-5">
                <Panel title="Patient directory">
                  {!patients.length ? <Empty>No patient records have been added.</Empty> : <label className="block text-sm font-medium text-slate-700">Select patient
                    <select value={selectedPatient} onChange={(event) => setSelectedPatient(event.target.value)} className={`${controlClass} mt-2`}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}</select>
                  </label>}
                  {selectedPatient && (() => {
                    const patient = patients.find((entry) => entry.id === selectedPatient);
                    return patient ? <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm"><strong className="text-slate-800">{patient.full_name}</strong><p className="mt-1 text-slate-600">{patient.date_of_birth ? `DOB ${patient.date_of_birth}` : 'Date of birth not recorded'} · {patient.phone || 'No phone recorded'}</p></div> : null;
                  })()}
                  <form className="mt-4 space-y-3 border-t border-slate-100 pt-4" onSubmit={(event) => {
                    event.preventDefault(); const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
                    void runAction(() => apiPost('/api/management/patients', body), 'Patient record saved.');
                    event.currentTarget.reset();
                  }}>
                    <h3 className="text-sm font-semibold text-slate-800">Add patient record</h3>
                    <input name="fullName" required maxLength={160} placeholder="Patient full name" className={controlClass} />
                    <div className="grid gap-3 sm:grid-cols-2"><input name="dateOfBirth" type="date" aria-label="Date of birth" className={controlClass} /><input name="phone" maxLength={40} placeholder="Phone" className={controlClass} /></div>
                    <button disabled={busy} className={buttonClass}><Plus className="h-4 w-4" />Save patient</button>
                  </form>
                </Panel>
                <Panel title="Add medication history">
                  {!selectedPatient ? <Empty>Select or add a patient first.</Empty> : <form className="space-y-3" onSubmit={(event) => {
                    event.preventDefault(); const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
                    void runAction(() => apiPost(`/api/management/patients/${selectedPatient}/prescriptions`, body), 'Prescription history recorded.');
                    event.currentTarget.reset();
                  }}>
                    <input name="medicineName" required maxLength={160} placeholder="Medicine" className={controlClass} />
                    <input name="dosage" maxLength={160} placeholder="Dosage / instructions" className={controlClass} />
                    <div className="grid gap-3 sm:grid-cols-2"><input name="prescriber" maxLength={160} placeholder="Prescriber" className={controlClass} /><input name="prescribedOn" type="date" aria-label="Prescription date" className={controlClass} /></div>
                    <button disabled={busy} className={buttonClass}><Plus className="h-4 w-4" />Save medication history</button>
                  </form>}
                </Panel>
              </section>
              <Panel title="Prescription history">
                {selectedPatient && prescriptions.filter((entry) => entry.patient_id === selectedPatient).length ? <ul className="divide-y divide-slate-100">{prescriptions.filter((entry) => entry.patient_id === selectedPatient).map((entry) => <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                  <span><strong className="text-slate-800">{entry.medicine_name}</strong><span className={`ml-2 rounded-full px-2 py-1 text-xs ${entry.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{entry.active ? 'Current' : 'History'}</span><span className="ml-2 text-xs text-slate-500">{entry.prescribed_on}</span>
                  <p className="mt-1 text-slate-600">{entry.dosage || 'No dosage recorded'}{entry.prescriber ? ` · ${entry.prescriber}` : ''}</p></span>
                  <button disabled={busy} onClick={() => void runAction(() => apiPatch(`/api/management/prescriptions/${entry.id}`, { active: !entry.active }), entry.active ? 'Medication moved to history.' : 'Medication marked current.')} className="text-xs font-semibold text-brand-700">{entry.active ? 'End medication' : 'Mark current'}</button>
                </li>)}</ul> : <Empty>Choose a patient to view saved medication history.</Empty>}
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-amber-700">Patient details are restricted to pharmacist and administrator roles. Store only information needed for care, and follow your local privacy and retention requirements.</p>
              </Panel>
            </div>
          )}

          {tab === 'locations' && (
            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="space-y-5">
                <Panel title="Stores and storage locations">
                  {data.locations.length ? <ul className="divide-y divide-slate-100">{data.locations.map((location) => {
                    const qty = data.batches.filter((batch) => batch.location_id === location.id).reduce((sum, batch) => sum + batch.current_quantity, 0);
                    return <li key={location.id} className="flex justify-between gap-3 py-3 text-sm"><span><strong className="text-slate-800">{location.name}</strong>{location.is_primary && <span className="ml-2 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">Primary</span>}<span className="block text-xs text-slate-500">{location.address || 'No address recorded'}</span></span><span className="text-right font-medium text-slate-600">{qty} units</span></li>;
                  })}</ul> : <Empty>No locations have been set up.</Empty>}
                  {profile?.role === 'admin' && <form className="mt-4 space-y-3 border-t border-slate-100 pt-4" onSubmit={(event) => {
                    event.preventDefault(); const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
                    void runAction(() => apiPost('/api/management/locations', body), 'Location added.');
                    event.currentTarget.reset();
                  }}>
                    <input name="name" required maxLength={120} placeholder="Store / location name" className={controlClass} />
                    <input name="address" maxLength={300} placeholder="Address or storage description" className={controlClass} />
                    <button disabled={busy} className={buttonClass}><Plus className="h-4 w-4" />Add location</button>
                  </form>}
                </Panel>
              </section>
              <Panel title="Transfer stock between locations">
                {profile?.role === 'admin' || profile?.role === 'pharmacist' || profile?.role === 'inventory_clerk' ? data.locations.length < 2 ? <Empty>Add at least two locations to transfer stock.</Empty> :
                  <form className="space-y-3" onSubmit={(event) => {
                    event.preventDefault(); const form = new FormData(event.currentTarget); const itemId = String(form.get('itemId') ?? ''); const batchId = String(form.get('batchId') ?? '');
                    const body = { itemId, batchId, destinationLocationId: form.get('destinationLocationId'), quantity: Number(form.get('quantity')) };
                    void runAction(() => apiPost('/api/management/transfers', body), 'Stock transferred; source and destination balances were updated.');
                    event.currentTarget.reset();
                  }}>
                    <label className="block text-sm font-medium text-slate-700">Medicine and source batch
                      <select name="batchId" required className={`${controlClass} mt-1`} onChange={(event) => {
                        const batch = data.batches.find((entry) => entry.id === event.target.value);
                        const hiddenItem = event.currentTarget.form?.elements.namedItem('itemId') as HTMLInputElement | null;
                        if (hiddenItem && batch) hiddenItem.value = batch.item_id;
                      }}>
                        <option value="">Select available batch</option>{data.batches.filter((batch) => !batch.is_recalled && new Date(batch.expiry_date) > new Date()).map((batch) => <option key={batch.id} value={batch.id}>{data.items.find((item) => item.id === batch.item_id)?.name} · {batch.batch_no} · {data.locations.find((location) => location.id === batch.location_id)?.name ?? 'Unassigned'} · {batch.current_quantity} units</option>)}
                      </select>
                    </label>
                    <input type="hidden" name="itemId" />
                    <select name="destinationLocationId" required className={controlClass}><option value="">Destination location</option>{data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
                    <input name="quantity" type="number" min="1" step="1" required placeholder="Quantity to transfer" className={controlClass} />
                    <button disabled={busy} className={buttonClass}>Transfer stock</button>
                    <p className="text-xs text-slate-500">Transfers are recorded in the stock ledger and cannot use expired or recalled batches.</p>
                  </form> : <Empty>Inventory clerk, pharmacist, or administrator permission is required.</Empty>}
              </Panel>
            </div>
          )}

          {tab === 'barcode' && (
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Find an item by barcode or SKU">
                <p className="mb-4 text-sm text-slate-600">Scan with a USB barcode reader, enter a SKU, or use a supported phone camera. The product barcode should match its inventory SKU.</p>
                <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); findBarcode(lookup); }}>
                  <input autoFocus value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="Scan or enter product SKU" className={controlClass} />
                  <button className={buttonClass}>Find</button>
                </form>
                {cameraError && <p role="status" className="mt-3 text-sm text-amber-700">{cameraError}</p>}
                <div className="mt-4 flex gap-2">
                  <button disabled={cameraOn} onClick={() => { setCameraError(''); setCameraOn(true); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Use camera</button>
                  {cameraOn && <button onClick={() => setCameraOn(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Stop camera</button>}
                </div>
                {cameraOn && <video ref={videoRef} muted playsInline className="mt-4 max-h-72 w-full rounded-xl bg-slate-900 object-cover" />}
              </Panel>
              <Panel title="Available barcode matches">
                {!lookup.trim() ? <Empty>Scanned items will be matched against the inventory SKU list.</Empty> : data.items.filter((item) => item.sku.toLowerCase().includes(lookup.trim().toLowerCase()) || item.name.toLowerCase().includes(lookup.trim().toLowerCase())).length ?                                 <ul className="divide-y divide-slate-100">{data.items.filter((item) => item.sku.toLowerCase().includes(lookup.trim().toLowerCase()) || item.name.toLowerCase().includes(lookup.trim().toLowerCase())).slice(0, 10).map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span><strong className="text-slate-800">{item.name}</strong><span className="block text-xs text-slate-500">SKU {item.sku} · {item.current_balance} units</span></span><span className="flex flex-wrap gap-3">
                  <button onClick={() => setLabelItem(item)} className="text-xs font-semibold text-slate-600">Print SKU label</button>
                  {(profile?.role === 'admin' || profile?.role === 'pharmacist' || profile?.role === 'inventory_clerk') && <button onClick={() => { setSelectedItemId(item.id); setActiveScreen('receive'); }} className="text-xs font-semibold text-slate-600">Receive</button>}
                  {(profile?.role === 'admin' || profile?.role === 'pharmacist' || profile?.role === 'cashier') && <button onClick={() => { setSelectedItemId(item.id); setActiveScreen('dispense'); }} className="text-xs font-semibold text-slate-600">Dispense</button>}
                  <button onClick={() => openItem(item)} className="text-xs font-semibold text-brand-700">Audit inventory</button>
                </span></li>)}</ul> : <Empty>No inventory product matches this barcode or SKU.</Empty>}
                {labelItem && <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <section className="print-output" aria-label="Product SKU label">
                  <h2 className="text-base font-bold">{labelItem.name}</h2>
                  <p className="mt-2 font-mono text-sm">SKU / barcode: {labelItem.sku}</p>
                  <p className="mt-1 text-xs">PharmAsyst inventory label</p>
                </section>
                <button onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold print:hidden">Print SKU label</button>
                </div>}
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Barcode readers work for item lookup and audits. The print action produces a browser-printable SKU label; dedicated encoded barcode artwork and printer-specific label layouts are not included.</p>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><Icon className="h-5 w-5 text-brand-600" /></div><p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{value}</p></section>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-bold text-slate-900">{title}</h2>{children}</section>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="py-4 text-sm text-slate-500">{children}</p>
);
