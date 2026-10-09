import React, { useState, useEffect } from 'react';
import { 
  FileCheck2, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { apiGet } from '../../services/api';

interface PharmacyLocation { id: string; name: string; is_primary: boolean; }

export const ReceiveStockScreen: React.FC = () => {
  const { 
    items, 
    ledger,
    selectedItemId, 
    setSelectedItemId, 
    receiveStock, 
    getMarketBenchmark,
    setActiveScreen
  } = usePharmacy();

  const currentItem = items.find(i => i.id === selectedItemId) || items[0];

  // Form states
  const [supplier, setSupplier] = useState('');
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [supplierLoadError, setSupplierLoadError] = useState('');
  const [locations, setLocations] = useState<PharmacyLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [locationLoadError, setLocationLoadError] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantityReceived, setQuantityReceived] = useState<number | string>('');
  const [physicalCountAvailable, setPhysicalCountAvailable] = useState<number | string>(
    currentItem?.currentBalance ?? 0
  );
  const [costPriceGhc, setCostPriceGhc] = useState<number | string>(currentItem?.costPriceGhc || '');
  const [sellingPriceGhc, setSellingPriceGhc] = useState<number | string>(currentItem?.sellingPriceGhc || '');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<{ suppliers: { name: string }[] }>('/api/management')
      .then(({ suppliers: savedSuppliers }) => {
        if (active) setSupplierNames(savedSuppliers.map((entry) => entry.name));
      })
      .catch((error: unknown) => {
        if (active) setSupplierLoadError(error instanceof Error ? error.message : 'Saved supplier names could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    apiGet<{ locations: PharmacyLocation[] }>('/api/locations')
      .then(({ locations: savedLocations }) => {
        if (!active) return;
        setLocations(savedLocations);
        setLocationId((current) => current || savedLocations.find((location) => location.is_primary)?.id || savedLocations[0]?.id || '');
      })
      .catch((error: unknown) => {
        if (active) setLocationLoadError(error instanceof Error ? error.message : 'Stock locations could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  // Update fields when selected item changes
  useEffect(() => {
    if (currentItem) {
      setPhysicalCountAvailable(currentItem.batches
        .filter((batch) => batch.locationId === locationId)
        .reduce((sum, batch) => sum + batch.currentQuantity, 0));
      setCostPriceGhc(currentItem.costPriceGhc || '');
      setSellingPriceGhc(currentItem.sellingPriceGhc || '');
      setBatchNo('');
      setExpiryDate('');
      setQuantityReceived('');
    }
  }, [currentItem?.id, locationId]);

  // Financial calculations
  const cost = Number(costPriceGhc) || 0;
  const sell = Number(sellingPriceGhc) || 0;
  const profitPerUnit = sell - cost;
  const marginPercent = sell > 0 ? ((profitPerUnit / sell) * 100).toFixed(1) : '0';

  // Market benchmark comparison
  const benchmark = getMarketBenchmark(currentItem?.name || '');
  const isAboveMarket = benchmark ? cost > benchmark.marketRangeMaxGhc : false;
  const isBelowMarket = benchmark ? cost < benchmark.marketRangeMinGhc : false;
  const isFairMarket = !isAboveMarket && !isBelowMarket;

  // Real-time addition preview
  const verifiedShelfBalance = Number(physicalCountAvailable) || 0;
  const incomingQty = Number(quantityReceived) || 0;
  const projectedBalance = verifiedShelfBalance + incomingQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;

    if (incomingQty <= 0) {
      setStatusMessage({ type: 'error', text: 'Received quantity must be greater than 0.' });
      return;
    }

    if (!batchNo.trim()) {
      setStatusMessage({ type: 'error', text: 'Batch number is required.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    const res = await receiveStock({
      itemId: currentItem.id,
      locationId,
      supplier: supplier.trim(),
      batchNo: batchNo.trim(),
      expiryDate,
      quantityReceived: incomingQty,
      physicalCountBeforeReceipt: verifiedShelfBalance,
      costPriceGhc: cost,
      sellingPriceGhc: sell,
    });

    setSubmitting(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message });
      setPhysicalCountAvailable(verifiedShelfBalance + incomingQty);
      setBatchNo('');
      setExpiryDate('');
      setQuantityReceived('');
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  if (!currentItem) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">No inventory items yet</h1>
        <p className="mt-2 text-sm text-slate-500">Add a medicine to your pharmacy inventory before recording a delivery.</p>
        <button onClick={() => setActiveScreen('inventory')} className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Open inventory
        </button>
      </div>
    );
  }

  const recentDeliveries = ledger.filter((entry) => entry.itemId === currentItem.id && entry.type === 'Received').slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumbs */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          OPERATIONS &gt; <span className="text-teal-600">RECEIVE STOCK</span>
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          INVENTORY &gt; STOCK INWARD &gt; RECEIVE STOCK
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Receive Stock
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Record stock delivery to update perpetual inventory ledger.
        </p>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between shadow-sm ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          {statusMessage.type === 'success' && (
            <button
              onClick={() => setActiveScreen('bincard')}
              className="text-xs font-semibold underline text-emerald-900 hover:text-emerald-700 ml-4 shrink-0"
            >
              View Updated Bin Card →
            </button>
          )}
        </div>
      )}
      {locationLoadError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Stock locations are unavailable: {locationLoadError}</div>}

      {/* Main Grid: Left Consignment Form, Right Recent Deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: 8 cols */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Consignment Details
                </h2>
                <p className="text-xs text-slate-500">
                  Fill required delivery details to post inward batch
                </p>
              </div>
            </div>

            <span className="text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
              GRN Inward
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Receiving location</label>
              <select required value={locationId} onChange={(event) => setLocationId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800" disabled={Boolean(locationLoadError)}>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.is_primary ? ' · Primary' : ''}</option>)}
              </select>
            </div>
            {/* Item Name Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  Pharmacy-wide balance: <strong className="text-teal-700 font-mono tabular-nums">{currentItem?.currentBalance || 0} {currentItem?.unit}</strong>
                </span>
              </div>

              <div className="relative">
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                >
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.presentation} ({item.currentBalance} {item.unit} available)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Crucial Pharmacist Step: Confirm Physical Stock Count on Shelf Before Inward Receipt */}
            <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-200/90 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-sky-900">
                    Physical Stock Verification (Clinical Audit Step)
                  </div>
                  <p className="text-sky-700 text-[11px] mt-0.5">
                    Confirm the recorded shelf balance before adding a delivery. Resolve any discrepancy before posting the new batch.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="font-semibold text-sky-900 text-xs">
                      Confirmed balance at this location before receipt:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={physicalCountAvailable}
                        onChange={(e) => setPhysicalCountAvailable(e.target.value)}
                        className="w-24 px-2 py-1 bg-white border border-sky-300 rounded font-mono font-bold text-xs text-sky-950 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <span className="text-sky-800 font-semibold">{currentItem?.unit}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Supplier <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="supplier-directory"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder={supplierNames.length ? 'Select a saved supplier or enter a new name' : 'Enter the supplier name'}
                className="w-full py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
              />
              <datalist id="supplier-directory">{supplierNames.map((name) => <option key={name} value={name} />)}</datalist>
              {supplierLoadError && <p role="status" className="mt-1 text-xs text-amber-700">Saved supplier list unavailable: {supplierLoadError}</p>}
              {!supplierLoadError && <p className="mt-1 text-xs text-slate-500">Use a saved supplier name to link this batch to vendor performance history.</p>}
            </div>

            {/* Batch Number & Expiry Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Batch Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  placeholder="e.g. PRC-26M18"
                  className="w-full py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono uppercase text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Expiry Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                  className="w-full py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Quantity Received */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Quantity Received <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  value={quantityReceived}
                  onChange={(e) => setQuantityReceived(e.target.value)}
                  className="w-full py-2.5 pl-3.5 pr-20 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 pointer-events-none">
                  {currentItem?.unit || 'tablets'}
                </span>
              </div>
            </div>

            {/* Cost Price & Selling Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Cost Price Per Unit (GH₵) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    GH₵
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={costPriceGhc}
                    onChange={(e) => setCostPriceGhc(e.target.value)}
                    className="w-full py-2.5 pl-12 pr-16 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    / unit
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Selling Price Per Unit (GH₵) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    GH₵
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPriceGhc}
                    onChange={(e) => setSellingPriceGhc(e.target.value)}
                    className="w-full py-2.5 pl-12 pr-16 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    / unit
                  </span>
                </div>
              </div>
            </div>

            {/* Margin Calculation Preview */}
            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-teal-800">
                Margin: {marginPercent}% · Profit: GH₵ {profitPerUnit.toFixed(2)}/unit
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                Projected New Balance: <strong className="text-slate-900">{projectedBalance} {currentItem?.unit}</strong>
              </span>
            </div>

            {/* Real-Time Market Benchmark Verification Box (Requested by user) */}
            {benchmark && (
              <div className={`p-4 rounded-xl border text-xs ${
                isFairMarket 
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                  : isAboveMarket 
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isFairMarket ? 'text-emerald-700' : isAboveMarket ? 'text-amber-700' : 'text-blue-700'
                    }`} />
                    <div>
                      <div className="font-bold">
                        {isFairMarket 
                          ? 'Real-Time Market Rate Verified' 
                          : isAboveMarket 
                            ? 'Warning: Supplier Price Above Market Benchmark' 
                            : 'Favorable Wholesale Rate (Below Average)'}
                      </div>
                      <p className="text-[11px] mt-0.5 opacity-90">
                        {benchmark.source}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/80 font-semibold shadow-xs">
                    Range: GH₵ {benchmark.marketRangeMinGhc.toFixed(2)} – {benchmark.marketRangeMaxGhc.toFixed(2)}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-current/15 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span>National Wholesale Baseline: <strong>GH₵ {benchmark.wholesaleRefGhc.toFixed(2)}</strong></span>
                  <span>Retail Price Ceiling: <strong>GH₵ {benchmark.retailCapGhc.toFixed(2)}</strong></span>
                  <span className="font-medium">Market Trend: {benchmark.trend.toUpperCase()}</span>
                </div>
              </div>
            )}

            {/* Save to Bin Card Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !locationId || Boolean(locationLoadError)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#197882] hover:bg-[#14646D] text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Saving to Ledger...' : 'Save to bin card'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Sidebar: Recent Deliveries (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">Recent Deliveries</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {currentItem?.name?.split(' ')[0] || 'Drug'}
            </span>
          </div>

          {recentDeliveries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No deliveries have been recorded for this medicine.</p>
          ) : (
            <ul className="space-y-3">
              {recentDeliveries.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono font-bold text-slate-800">Batch: {entry.batchNo || '—'}</span>
                    <span className="shrink-0 text-slate-500">{entry.date}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-emerald-700">
                    Qty: +{entry.qtyIn ?? 0} {currentItem.unit}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Supplier: {entry.supplierOrCustomer || '—'}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Expiry: {entry.expiryLabel || '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
