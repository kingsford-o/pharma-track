import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Plus, 
  Minus, 
  Info, 
  Layers, 
  Calendar, 
  Printer, 
  Download,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

export const BinCardScreen: React.FC<{ controlledRegister?: boolean }> = ({ controlledRegister = false }) => {
  const { 
    items, 
    ledger, 
    selectedItemId, 
    setSelectedItemId, 
    setActiveScreen 
  } = usePharmacy();

  const [filterType, setFilterType] = useState<'All' | 'Received' | 'Dispensed'>('All');

  const currentItem = items.find(i => i.id === selectedItemId) || items[0];
  const isThresholdBreached = currentItem ? currentItem.currentBalance < currentItem.minThreshold : false;

  // Filter transactions for this specific item
  const itemLedger = ledger.filter(tx => {
    if (filterType === 'All') return true;
    return tx.type === filterType;
  });

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Supplier / Customer', 'Reference', 'Batch', 'Expiry', 'Qty In', 'Qty Out', 'Balance', 'Recorded By'];
    const rows = itemLedger.map(tx => [
      tx.date,
      tx.type,
      `"${tx.supplierOrCustomer.replace(/"/g, '""')}"`,
      `"${(tx.referenceDetails || '').replace(/"/g, '""')}"`,
      tx.batchNo,
      tx.expiryLabel,
      tx.qtyIn ?? '',
      tx.qtyOut ?? '',
      tx.balanceAfter,
      `"${tx.recordedBy}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bincard_${currentItem?.sku || 'med'}_ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="cursor-pointer hover:text-slate-800" onClick={() => setActiveScreen('inventory')}>
            Inventory
          </span>
          <span>&gt;</span>
          <span className="cursor-pointer hover:text-slate-800" onClick={() => setActiveScreen('inventory')}>
            {controlledRegister ? 'Controlled drug register' : 'Bin Cards'}
          </span>
          <span>&gt;</span>
          <span className="font-bold text-slate-900">{currentItem?.name}</span>
        </div>

        {controlledRegister && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Controlled drug movements are shown in the stock ledger below. Record each receipt and dispensing transaction to maintain this register.
          </div>
        )}

        {/* Drug Selector Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-500 font-medium">Switch Formulary:</span>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="text-xs py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {items.map(i => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.currentBalance} {i.unit})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Threshold Warning Banner (Matches Screenshot) */}
      {isThresholdBreached && (
        <div className="bg-amber-50/80 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Low Inventory Threshold Breached: </strong>
            Current balance of <span className="font-bold font-mono">{currentItem?.currentBalance} {currentItem?.unit}</span> is below the minimum reorder level of <span className="font-bold font-mono">{currentItem?.minThreshold} {currentItem?.unit}</span>.
          </div>
        </div>
      )}

      {/* Item Summary Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 mt-0.5">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="9" y1="16" x2="13" y2="16" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {currentItem?.name}
              </h1>
              {isThresholdBreached && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  Below Minimum Level
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Current Balance: <strong className="text-amber-800 font-mono font-bold">{currentItem?.currentBalance} {currentItem?.unit}</strong>
              </span>
              <span>·</span>
              <span>
                Minimum Level: <strong className="font-mono text-slate-800">{currentItem?.minThreshold} {currentItem?.unit}</strong>
              </span>
              <span>·</span>
              <span>
                Shelf Location: <strong className="text-slate-800">{currentItem?.shelfLocation}</strong>
              </span>
              <span>·</span>
              <span>
                Form: <span className="text-slate-600">{currentItem?.formDescription}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => setActiveScreen('receive')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#197882] hover:bg-[#14646D] rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Receive Stock</span>
          </button>

          <button
            onClick={() => setActiveScreen('dispense')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>- Dispense Item</span>
          </button>
        </div>
      </div>

      {/* Batches in Shelf Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Layers className="w-4 h-4 text-teal-600" />
            <span>BATCHES IN {currentItem?.shelfLocation?.toUpperCase()}:</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Policy: Dispense strictly by <strong>FEFO</strong> (First Expired, First Out)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {currentItem?.batches.map((batch, index) => {
            const isExpSoon = batch.expiryDaysLeft <= 60;
            return (
              <div 
                key={batch.id} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono"
              >
                <span className="font-bold text-slate-800">{batch.batchNo}</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600 font-medium">{batch.currentQuantity} tabs</span>
                <span className="text-slate-400">|</span>
                {isExpSoon ? (
                  <span className="text-rose-700 bg-rose-50 border border-rose-200 font-bold px-1.5 py-0.5 rounded text-[11px]">
                    Exp: {batch.expiryDate} ({batch.expiryDaysLeft}d)
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-1.5 py-0.5 rounded text-[11px]">
                    Exp: Aug 2027
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stock Movement Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900">
              Stock Movement Ledger
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Live Audit Trail
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded text-xs">
              <button
                onClick={() => setFilterType('All')}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  filterType === 'All' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('Received')}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  filterType === 'Received' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                Received
              </button>
              <button
                onClick={() => setFilterType('Dispensed')}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  filterType === 'Dispensed' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                Dispensed
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-2xs cursor-pointer"
              title="Export Ledger to CSV"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <span className="text-xs text-slate-400 font-medium ml-2">
              As of 01 Oct 2026
            </span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Date</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-4">Supplier / Customer</th>
                <th className="py-3 px-3">Batch</th>
                <th className="py-3 px-3">Expiry</th>
                <th className="py-3 px-3 text-right">Qty In</th>
                <th className="py-3 px-3 text-right">Qty Out</th>
                <th className="py-3 px-4 text-center">Balance</th>
                <th className="py-3 px-4 sm:px-6">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemLedger.map((tx) => {
                const isReceived = tx.type === 'Received';
                const isHighlight = tx.isHighlight;

                return (
                  <tr 
                    key={tx.id} 
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isHighlight ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {isHighlight && (
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0"></span>
                        )}
                        <span>{tx.date}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {isReceived ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Received
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                          Dispensed
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {tx.supplierOrCustomer}
                      </div>
                      {tx.referenceDetails && (
                        <div className="text-[11px] text-slate-500">
                          {tx.referenceDetails}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                      {tx.batchNo}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {tx.expiryLabel === 'Aug 2027' ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {tx.expiryLabel}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                          {tx.expiryLabel}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs font-bold text-emerald-600">
                      {tx.qtyIn ? `+ ${tx.qtyIn.toLocaleString()}` : '—'}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs font-bold text-slate-800">
                      {tx.qtyOut ? tx.qtyOut.toLocaleString() : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded ${
                        tx.balanceAfter < 500 
                          ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                          : 'text-slate-800'
                      }`}>
                        {tx.balanceAfter.toLocaleString()}
                        {tx.balanceAfter < 500 && (
                          <span className="text-[10px] text-amber-700">⚠️</span>
                        )}
                        {tx.isHighlight && (
                          <span className="text-[10px] text-amber-700">⬇️</span>
                        )}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-xs text-slate-600 whitespace-nowrap">
                      {tx.recordedBy}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
