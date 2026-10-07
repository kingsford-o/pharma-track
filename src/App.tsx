import React, { useState } from 'react';
import { PharmacyProvider, usePharmacy } from './context/PharmacyContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { ReceiveStockScreen } from './components/screens/ReceiveStockScreen';
import { DispenseScreen } from './components/screens/DispenseScreen';
import { InventoryScreen } from './components/screens/InventoryScreen';
import { BinCardScreen } from './components/screens/BinCardScreen';
import { SupabaseModal } from './components/SupabaseModal';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeScreen, notification, clearNotification } = usePharmacy();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* Responsive Left Navigation */}
      <Sidebar 
        mobileOpen={mobileMenuOpen} 
        setMobileOpen={setMobileMenuOpen} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        {/* Global Notification Banner */}
        {notification && (
          <div className="px-4 sm:px-6 pt-3">
            <div className={`p-3 rounded-xl flex items-center justify-between shadow-2xs text-xs sm:text-sm ${
              notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              notification.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
              'bg-teal-50 text-teal-800 border border-teal-200'
            }`}>
              <div className="flex items-center gap-2">
                {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                {notification.type === 'info' && <Info className="w-4 h-4 text-teal-600 shrink-0" />}
                <span>{notification.message}</span>
              </div>
              <button onClick={clearNotification} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Viewport View Switcher */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          {activeScreen === 'dashboard' && <DashboardScreen />}
          {activeScreen === 'receive' && <ReceiveStockScreen />}
          {activeScreen === 'dispense' && <DispenseScreen />}
          {activeScreen === 'inventory' && <InventoryScreen />}
          {activeScreen === 'bincard' && <BinCardScreen />}
          {activeScreen === 'sales' && <div className="text-center py-20 text-slate-500">Sales & Business - Coming Soon</div>}
          {activeScreen === 'finance' && <div className="text-center py-20 text-slate-500">Finance & Accounts - Coming Soon</div>}
          {activeScreen === 'reconciliation' && <div className="text-center py-20 text-slate-500">Reconciliation - Coming Soon</div>}
        </main>
      </div>

      {/* Supabase SQL Migration & Setup Hub Modal */}
      <SupabaseModal />
    </div>
  );
};

export default function App() {
  return (
    <PharmacyProvider>
      <MainLayout />
    </PharmacyProvider>
  );
}
