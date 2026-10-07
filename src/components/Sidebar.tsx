import React from 'react';
import {
  LayoutDashboard,
  Layers,
  ShoppingCart,
  DollarSign,
  RefreshCw,
  Database,
  X,
  ClipboardList,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useProfile } from '../context/ProfileContext';
import { ActiveScreen } from '../types/pharmacy';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

const navItems: { id: ActiveScreen; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Layers },
  { id: 'sales', label: 'Sales & Business', icon: ShoppingCart },
  { id: 'finance', label: 'Finance & Accounts', icon: DollarSign },
  { id: 'reconciliation', label: 'Reconciliation', icon: RefreshCw },
];

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { activeScreen, setActiveScreen, setIsSchemaModalOpen } = usePharmacy();
  const { profile } = useProfile();
  const visibleNavItems = profile?.stock_categories.includes('controlled_drugs')
    ? [...navItems, { id: 'controlled-register' as const, label: 'Controlled drug register', icon: ClipboardList }]
    : navItems;

  const handleNavClick = (screen: ActiveScreen) => {
    setActiveScreen(screen);
    setMobileOpen?.(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={() => setMobileOpen?.(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] transition-opacity lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex w-64 flex-col justify-between border-r border-slate-200 bg-white
          transition-transform duration-200 ease-out lg:static lg:h-screen lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div>
          {/* Brand */}
          <div className="flex h-16 items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z" />
                </svg>
              </div>
              <div>
                <div className="text-[15px] font-bold leading-tight tracking-tight text-slate-900">Axelle MD</div>
                <div className="text-[11px] font-medium text-slate-500">Pharmacy management</div>
              </div>
            </div>

            {setMobileOpen && (
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="mt-4 space-y-1 px-3" aria-label="Main">
            {visibleNavItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeScreen === id;
              return (
                <button
                  key={id}
                  onClick={() => handleNavClick(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-50 font-semibold text-brand-700'
                      : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer: plain-language status first, dev tools tucked away */}
        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            All changes saved
          </div>
          <button
            onClick={() => setIsSchemaModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-700"
          >
            <Database className="h-3.5 w-3.5" />
            Database schema
          </button>
        </div>
      </aside>
    </>
  );
};
