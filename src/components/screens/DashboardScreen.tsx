import React from 'react';
import { 
  RefreshCw, 
  Plus, 
  ArrowUpRight, 
  AlertTriangle, 
  Clock, 
  AlertCircle,
  Bell,
  ArrowRight,
  Send
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

export const DashboardScreen: React.FC = () => {
  const { 
    items, 
    setActiveScreen, 
    setSelectedItemId, 
    syncTimestamp, 
    refreshLedgerSync 
  } = usePharmacy();

  // Compute metrics dynamically from current inventory
  const lowStockItems = items.filter(item => item.currentBalance > 0 && item.currentBalance <= item.minThreshold);
  const outOfStockItems = items.filter(item => item.currentBalance === 0);

  // Compute batches expiring in <= 90 days
  const expiringBatchesList: {
    itemId: string;
    itemName: string;
    presentation: string;
    batchNo: string;
    expiryDateFormatted: string;
    daysLeft: number;
    stockQty: number;
    unit: string;
    protocol: 'Dispense First' | 'Next in Queue' | 'Monitored';
    isEarliest?: boolean;
  }[] = [];

  items.forEach(item => {
    item.batches.forEach(batch => {
      if (batch.currentQuantity > 0 && batch.expiryDaysLeft <= 90) {
        let protocol: 'Dispense First' | 'Next in Queue' | 'Monitored' = 'Monitored';
        if (batch.expiryDaysLeft <= 45) protocol = 'Dispense First';
        else if (batch.expiryDaysLeft <= 60) protocol = 'Next in Queue';

        const parts = batch.expiryDate.split('-');
        const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : batch.expiryDate;

        expiringBatchesList.push({
          itemId: item.id,
          itemName: item.name,
          presentation: item.presentation,
          batchNo: batch.batchNo,
          expiryDateFormatted: dateStr,
          daysLeft: batch.expiryDaysLeft,
          stockQty: batch.currentQuantity,
          unit: item.unit,
          protocol,
        });
      }
    });
  });

  // Sort earliest expiry first
  expiringBatchesList.sort((a, b) => a.daysLeft - b.daysLeft);
  if (expiringBatchesList.length > 0) {
    expiringBatchesList[0].isEarliest = true;
  }

  // Estimated expiring inventory cost
  const estimatedExpiringCost = expiringBatchesList.reduce((acc, curr) => {
    const item = items.find(i => i.id === curr.itemId);
    return acc + (curr.stockQty * (item?.costPriceGhc || 0.25));
  }, 0);

  const handleOpenBinCard = (itemId: string) => {
    setSelectedItemId(itemId);
    setActiveScreen('bincard');
  };

  const handleOpenReceive = (itemId?: string) => {
    if (itemId) setSelectedItemId(itemId);
    setActiveScreen('receive');
  };

  const handleOpenDispense = (itemId?: string) => {
    if (itemId) setSelectedItemId(itemId);
    setActiveScreen('dispense');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumb & Header Title Area */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          OPERATIONS &gt; <span className="text-teal-600">DASHBOARD</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Dispensary Operations Dashboard
              </h1>
              <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Active Store: Central Dispensary
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Real-time stock alert overview, critical minimum thresholds, and FEFO expiry horizons as of 01/10/2026.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={refreshLedgerSync}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm"
              title="Refresh ledger state"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Ledger Sync: {syncTimestamp}</span>
            </button>

            <button
              onClick={() => handleOpenReceive()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-300/80 rounded-lg hover:bg-teal-100/70 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Receive Stock</span>
            </button>

            <button
              onClick={() => handleOpenDispense()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#197882] hover:bg-[#15666f] rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Dispense Item</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Metric Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Low-Stock Items */}
        <div className="bg-white border-2 border-amber-300/80 rounded-xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              LOW-STOCK ITEMS
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              ● Action Required
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
                {lowStockItems.length}
              </span>
              <span className="text-sm font-semibold text-slate-700">
                SKUs deficient
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Below established minimum reorder buffer. Lead time replenishment cycle critical.
            </p>
          </div>

          <button
            onClick={() => setActiveScreen('inventory')}
            className="flex items-center justify-between text-xs font-semibold text-amber-800 hover:text-amber-900 pt-3 border-t border-amber-100/80 group"
          >
            <span>Priority: Essential Oral Antibiotics & Analgesics</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Card 2: Expiring Within 90 Days */}
        <div className="bg-white border-2 border-rose-300/80 rounded-xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              EXPIRING WITHIN 90 DAYS
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              FEFO Active
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-rose-600 font-mono tabular-nums">
                {expiringBatchesList.length}
              </span>
              <span className="text-sm font-semibold text-slate-700">
                batches at risk
              </span>
            </div>
            <div className="text-xs text-slate-600 mb-4">
              Estimated Expiring Value: <span className="font-bold text-rose-700 font-mono">GH₵ {estimatedExpiringCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 pt-3 border-t border-rose-100">
            <span className="flex items-center gap-1.5">
              Earliest expiry: <span className="font-mono text-rose-800">15/11/2026 (45 days)</span>
            </span>
            <Bell className="w-4 h-4 text-rose-500 animate-bounce" />
          </div>
        </div>

        {/* Card 3: Out of Stock */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              OUT OF STOCK
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Zero Shelf
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
                {outOfStockItems.length}
              </span>
              <span className="text-sm font-semibold text-slate-700">
                formulary items empty
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Immediate stock-out — 0 balance on shelf. Directing prescribers to therapeutic alternatives.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-rose-700 pt-3 border-t border-slate-100">
            <span>Critical: Zinc Sulfate 20mg, Cefuroxime 500mg</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Section 1: Low-Stock Items Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Low-Stock Items
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {lowStockItems.length} Items
            </span>
          </div>

          <button
            onClick={() => setActiveScreen('inventory')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Full Inventory</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-2 bg-slate-50/50 text-xs text-slate-500 border-b border-slate-100">
          Items dipping below designated safety buffer. Reorder or request replenishment.
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Item &amp; Presentation</th>
                <th className="py-3 px-4 text-center">Current Balance</th>
                <th className="py-3 px-4 text-center">Min Threshold</th>
                <th className="py-3 px-4 sm:px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStockItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 sm:px-6">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{item.name}</span>
                      {item.matchedSku && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                          MATCHED SKU
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Dispensing Unit: {item.presentation} ({item.unit})
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold font-mono tabular-nums text-xs">
                      {item.currentBalance} {item.unit}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-600 text-xs font-medium">
                    {item.minThreshold} {item.unit}
                  </td>

                  <td className="py-3 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenBinCard(item.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors"
                      >
                        Bin Card
                      </button>
                      <button
                        onClick={() => handleOpenReceive(item.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Receive</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Displaying {lowStockItems.length} threshold alerts</span>
          <span className="font-medium text-slate-600">Reorder Lead Time Avg: 48h</span>
        </div>
      </div>

      {/* Section 2: Expiring Soon (Within 90 Days) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Expiring Soon (Within 90 Days)
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
              {expiringBatchesList.length} Batches
            </span>
          </div>

          <span className="text-xs font-bold text-rose-600 flex items-center gap-1.5 self-start sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse"></span>
            FEFO Priority Queue
          </span>
        </div>

        <div className="px-4 sm:px-6 py-2 bg-slate-50/50 text-xs text-slate-500 border-b border-slate-100">
          Prioritize via FEFO protocols before expiry to minimize loss.
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Item &amp; Presentation</th>
                <th className="py-3 px-4">Batch No.</th>
                <th className="py-3 px-4">Expiry (Horizon)</th>
                <th className="py-3 px-4 text-center">Stock Qty</th>
                <th className="py-3 px-4 sm:px-6 text-right">Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expiringBatchesList.map((batch, idx) => (
                <tr key={`${batch.batchNo}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 sm:px-6">
                    <div className="font-semibold text-slate-900">{batch.itemName}</div>
                    {batch.isEarliest ? (
                      <span className="text-[11px] font-bold text-rose-600">
                        Earliest expiring batch
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {batch.presentation}
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 font-mono text-xs font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">
                      {batch.batchNo}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-mono text-xs font-bold text-rose-600">
                      {batch.expiryDateFormatted}
                    </div>
                    <div className="text-[11px] text-rose-600 font-medium">
                      {batch.daysLeft} days left
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center font-mono tabular-nums text-xs font-semibold text-slate-700">
                    {batch.stockQty} {batch.unit}
                  </td>

                  <td className="py-3 px-4 sm:px-6 text-right">
                    {batch.protocol === 'Dispense First' ? (
                      <button
                        onClick={() => handleOpenDispense(batch.itemId)}
                        className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors shadow-xs cursor-pointer"
                      >
                        Dispense First
                      </button>
                    ) : batch.protocol === 'Next in Queue' ? (
                      <button
                        onClick={() => handleOpenDispense(batch.itemId)}
                        className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded transition-colors"
                      >
                        Next in Queue
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded">
                        Monitored
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>FEFO enforcement strictly active across all POS terminals</span>
          <button
            onClick={() => setActiveScreen('dispense')}
            className="font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Go to Dispense</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
