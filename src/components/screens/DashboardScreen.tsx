import React from 'react';
import {
  TrendingUp,
  Package,
  Receipt,
  Plus,
  ShoppingCart,
  Pill,
  UserPlus,
  ArrowRight,
  BarChart3,
  PieChart
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

export const DashboardScreen: React.FC = () => {
  const { items, setActiveScreen, setSelectedItemId } = usePharmacy();

  // Calculate metrics
  const totalSales = 152450.00;
  const totalPurchase = 98500.00;
  const totalReceipt = 53950.00;

  const handleOpenReceive = (itemId?: string) => {
    if (itemId) setSelectedItemId(itemId);
    setActiveScreen('receive');
  };

  const handleOpenDispense = (itemId?: string) => {
    if (itemId) setSelectedItemId(itemId);
    setActiveScreen('dispense');
  };

  const handleOpenInventory = () => {
    setActiveScreen('inventory');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back! Here's what's happening with your pharmacy today.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Sales */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              +12.5%
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            GH₵ {totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-slate-500">Total Sales</div>
        </div>

        {/* Purchase */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              +8.2%
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            GH₵ {totalPurchase.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-slate-500">Purchase</div>
        </div>

        {/* Receipt */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
              +15.3%
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            GH₵ {totalReceipt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-slate-500">Receipt</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Action</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleOpenDispense()}
            className="flex flex-col items-center gap-3 p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center group-hover:bg-teal-200 transition-colors">
              <ShoppingCart className="w-6 h-6 text-teal-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 group-hover:text-teal-700">New Sale</span>
          </button>

          <button
            onClick={() => handleOpenReceive()}
            className="flex flex-col items-center gap-3 p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">New Purchase</span>
          </button>

          <button
            onClick={handleOpenInventory}
            className="flex flex-col items-center gap-3 p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-purple-500 hover:bg-purple-50 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Pill className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 group-hover:text-purple-700">Add Medicine</span>
          </button>

          <button
            className="flex flex-col items-center gap-3 p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
              <UserPlus className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 group-hover:text-amber-700">Add Customer</span>
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Medicine */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">Top Selling Medicine</h2>
            <button className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {[
              { name: 'Paracetamol 500mg', sales: 1250, percentage: 85 },
              { name: 'Amoxicillin 250mg', sales: 980, percentage: 72 },
              { name: 'Ibuprofen 400mg', sales: 850, percentage: 65 },
              { name: 'Omeprazole 20mg', sales: 720, percentage: 55 },
              { name: 'Metformin 500mg', sales: 650, percentage: 48 },
            ].map((medicine, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{medicine.name}</span>
                  <span className="text-sm font-semibold text-slate-900">{medicine.sales} units</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-teal-500 h-2 rounded-full transition-all"
                    style={{ width: `${medicine.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Medicine Categories */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">Medicine Categories</h2>
            <button className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {[
              { name: 'Antibiotics', count: 245, color: 'bg-emerald-500' },
              { name: 'Pain Relief', count: 189, color: 'bg-blue-500' },
              { name: 'Cardiovascular', count: 156, color: 'bg-purple-500' },
              { name: 'Diabetes', count: 134, color: 'bg-amber-500' },
              { name: 'Vitamins', count: 98, color: 'bg-rose-500' },
            ].map((category, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                  <span className="text-sm font-medium text-slate-700">{category.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{category.count} items</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
