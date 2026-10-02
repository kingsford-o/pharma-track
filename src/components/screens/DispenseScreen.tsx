import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Send, 
  Lock, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

export const DispenseScreen: React.FC = () => {
  const { 
    items, 
    selectedItemId, 
    setSelectedItemId, 
    dispenseStock, 
    setActiveScreen 
  } = usePharmacy();

  const currentItem = items.find(i => i.id === selectedItemId) || items[0];

  // Dispense Form state
  const [quantityToDispense, setQuantityToDispense] = useState<number | string>(500); // Default from screenshot showing 500
  const [referenceNo, setReferenceNo] = useState('RX-2026-9814 (Outpatient OPD)');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const reqQty = Number(quantityToDispense) || 0;
  const availableBalance = currentItem?.currentBalance || 0;
  const isShortfall = reqQty > availableBalance;
  const shortfallAmount = reqQty - availableBalance;

  // Auto-Ranked FEFO Batch allocation simulation
  // Batches ordered by expiry date
  const sortedBatches = currentItem ? [...currentItem.batches].sort(
    (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
  ) : [];

  let remaining = reqQty;
  const allocations = sortedBatches.map((batch, index) => {
    const allocAmount = Math.min(batch.currentQuantity, Math.max(0, remaining));
    const allocPercent = batch.currentQuantity > 0 
      ? Math.round((allocAmount / batch.currentQuantity) * 100) 
      : 0;
    remaining -= allocAmount;

    return {
      batch,
      rank: index === 0 ? '1st' : index === 1 ? '2nd' : `${index + 1}th`,
      drawType: index === 0 ? 'Primary Draw' : 'Secondary Draw',
      allocatedQty: allocAmount,
      allocatedPercent: allocPercent,
      isFullyAllocated: allocPercent === 100,
    };
  });

  const handleAdjustToMax = () => {
    setQuantityToDispense(availableBalance);
  };

  const handleDispenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;

    if (reqQty <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid quantity to dispense.' });
      return;
    }

    if (isShortfall) {
      setStatusMessage({
        type: 'error',
        text: `Requested quantity (${reqQty}) exceeds aggregate shelf inventory (${availableBalance}). Stock release blocked.`,
      });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    const res = await dispenseStock({
      itemId: currentItem.id,
      quantityToDispense: reqQty,
      referenceNo: referenceNo.trim(),
      destinationOrPatient: referenceNo.includes('OPD') ? 'Outpatient Dispensary (OPD)' : 'Clinical Ward',
      recordedBy: 'S. Jenkins, Pharmacist',
    });

    setSubmitting(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message });
      setQuantityToDispense(100);
      setReferenceNo(`RX-2026-${Math.floor(Math.random() * 8000 + 1000)} (Direct OPD)`);
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Banner: Inventory Quota Exception if Shortfall (matches screenshot) */}
      {isShortfall && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between gap-4 text-xs sm:text-sm shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <strong className="font-bold text-rose-900">Inventory Quota Exception: </strong>
              Requested quantity ({reqQty} {currentItem?.unit}) exceeds the aggregate shelf inventory ({availableBalance} {currentItem?.unit}). Stock release blocked.
            </div>
          </div>
          <span className="font-mono font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded text-xs shrink-0 uppercase tracking-wide">
            SHORTFALL: -{shortfallAmount} {currentItem?.unit?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Breadcrumb & Screen Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            OPERATIONS &gt; DISPENSE &gt; <span className="text-teal-600">OUTWARD DISPENSE</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Dispense Medication
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Issue stock against prescription or ward requisition with automated FEFO batch allocation.
          </p>
        </div>

        {/* Top Badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Standard FEFO Protocol Active</span>
          </div>
          <button
            onClick={() => setActiveScreen('bincard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 font-medium shadow-xs"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Dispense Log</span>
          </button>
        </div>
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
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          {statusMessage.type === 'success' && (
            <button
              onClick={() => setActiveScreen('bincard')}
              className="text-xs font-semibold underline text-emerald-900 ml-4 shrink-0"
            >
              Inspect Bin Card Ledger →
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Left Dispense Details, Right Recent Dispenses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: 8 cols */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Dispense Details
                </h2>
                <p className="text-xs text-slate-500">
                  Enter issuance quantity and prescription or ward voucher reference
                </p>
              </div>
            </div>

            <span className="text-xs font-bold px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
              DISPENSARY OUTWARD
            </span>
          </div>

          <form onSubmit={handleDispenseSubmit} className="space-y-5">
            {/* Item Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  ● Available: {currentItem?.currentBalance} {currentItem?.unit}
                </span>
              </div>

              <div className="relative">
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                >
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} · SKU: {item.sku} ({item.currentBalance} {item.unit} available)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantity to Dispense */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Quantity to Dispense <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  Stock deducts instantly upon submission
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  value={quantityToDispense}
                  onChange={(e) => setQuantityToDispense(e.target.value)}
                  className={`w-full py-2.5 pl-3.5 pr-24 border rounded-lg text-lg font-mono font-bold focus:outline-none focus:ring-1 transition-colors ${
                    isShortfall 
                      ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500' 
                      : 'border-slate-200 bg-slate-50 text-slate-900 focus:ring-teal-500 focus:bg-white'
                  }`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase pointer-events-none">
                  {currentItem?.unit || 'TABLETS'}
                </span>
              </div>

              {isShortfall && (
                <div className="mt-1.5 text-xs text-rose-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Cannot dispense {reqQty} {currentItem?.unit}. Only {availableBalance} available. The maximum allocatable volume across all unexpired batches in this shelf location is {availableBalance} {currentItem?.unit}.
                  </span>
                </div>
              )}
            </div>

            {/* Reference (Prescription No. / Ward Requisition) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reference (Prescription No. / Ward Requisition) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. RX-2026-9814 (Outpatient OPD)"
                  className="w-full py-2.5 pl-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
                <ShieldCheck className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Enter formal prescription ID, clinic transfer code, or ward voucher
              </p>
            </div>

            {/* Automated Batch Allocation (FEFO Policy) Box */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-700" />
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Automated Batch Allocation (FEFO Policy)
                    </span>
                    <span className="text-[11px] text-slate-500 ml-2 hidden sm:inline">
                      Earliest expiry dispensed first
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                  Auto-Ranked
                </span>
              </div>

              {/* Batches draw allocations */}
              <div className="space-y-2.5">
                {allocations.map(({ batch, rank, drawType, allocatedQty, allocatedPercent }) => (
                  <div 
                    key={batch.id} 
                    className="p-3 bg-white rounded-lg border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100">
                          {rank}
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          Batch: {batch.batchNo}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {batch.shelfLocation}
                        </span>
                        {batch.expiryDaysLeft <= 60 ? (
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            Expiring soon ({batch.expiryDaysLeft}d)
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Valid ({batch.expiryDate})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-500 text-[11px] mt-1.5 font-mono">
                        <span>AVAILABLE: <strong>{batch.currentQuantity} {currentItem?.unit}</strong></span>
                        <span>·</span>
                        <span className="text-teal-700 font-semibold">
                          ALLOCATED: {allocatedQty} {currentItem?.unit} ({allocatedPercent}%)
                        </span>
                      </div>
                    </div>

                    <div className="self-end sm:self-center">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded text-white ${
                        rank === '1st' ? 'bg-[#197882]' : 'bg-slate-700'
                      }`}>
                        {drawType} ({allocatedQty} {currentItem?.unit})
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Shortfall Alert with Adjust Button */}
              {isShortfall && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                  <div className="text-rose-800">
                    Total available across all active shelf batches: <strong>{availableBalance} {currentItem?.unit}</strong>.
                    <span className="text-rose-700 font-bold ml-1">Shortfall: {shortfallAmount} {currentItem?.unit}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdjustToMax}
                    className="px-2.5 py-1 bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 font-bold text-xs rounded transition-colors shadow-2xs shrink-0 cursor-pointer"
                  >
                    Adjust to Max ({availableBalance} {currentItem?.unit})
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Form Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Requires Pharmacist or Dispenser authorization
              </span>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveScreen('dashboard')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || isShortfall}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#197882] hover:bg-[#14646D] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Allocating...' : 'Dispense Stock'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Panel: Recent Dispenses & Health Metric (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-bold text-slate-900">Recent Dispenses</h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                4 Records
              </span>
            </div>

            <div className="space-y-3">
              {/* Record 1 */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-900">
                    Outpatient Dispensary (OPD #1098)
                  </span>
                  <span className="font-mono font-bold text-rose-600">
                    -100 tabs
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mb-1.5">
                  Post-discharge ambulatory issue
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>PRC-26H14 · Exp: 15/11/2026</span>
                  <span className="text-slate-600 font-medium">01/10/2026</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Recorded by: S. Jenkins, Pharmacist
                </div>
              </div>

              {/* Record 2 */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-900">
                    Ward 3 Clinic Transfer
                  </span>
                  <span className="font-mono font-bold text-rose-600">
                    -60 tabs
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mb-1.5">
                  Internal Requisition #W3-902
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>PRC-26H14 · Exp: 15/11/2026</span>
                  <span className="text-slate-600 font-medium">30/09/2026</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Recorded by: K. Mensah, Dispenser
                </div>
              </div>

              {/* Record 3 */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-900">
                    Community Prescription #7731
                  </span>
                  <span className="font-mono font-bold text-rose-600">
                    -100 tabs
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mb-1.5">
                  Direct ambulatory chronic care issue
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>PRC-26H14 · Exp: 15/11/2026</span>
                  <span className="text-slate-600 font-medium">28/09/2026</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Recorded by: M. Davis, Dispenser
                </div>
              </div>

              {/* Record 4 */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-900">
                    Adult Medical Ward Requisition
                  </span>
                  <span className="font-mono font-bold text-rose-600">
                    -200 tabs
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mb-1.5">
                  Requisition Ref: #AMW-441
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>PRC-26H14 · Exp: 15/11/2026</span>
                  <span className="text-slate-600 font-medium">25/09/2026</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Recorded by: A. Patel, Pharmacist
                </div>
              </div>
            </div>
          </div>

          {/* Bin Card Health Metric Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-xs">
            <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-2 flex items-center justify-between">
              <span>BIN CARD HEALTH METRIC</span>
              <span className="font-mono text-slate-600">PCM-500 TAB</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[11px] text-slate-500">Current Physical Balance</div>
                <div className="text-lg font-extrabold text-slate-900 font-mono tabular-nums">
                  {currentItem?.currentBalance} {currentItem?.unit}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Month-to-Date Issues</div>
                <div className="text-lg font-extrabold text-slate-900 font-mono tabular-nums">
                  100 {currentItem?.unit}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
