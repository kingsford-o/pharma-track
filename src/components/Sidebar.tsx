import React from 'react';
import { 
  LayoutDashboard, 
  Inbox, 
  Send, 
  Layers, 
  FileText, 
  CheckCircle2, 
  Database,
  X
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { ActiveScreen } from '../types/pharmacy';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { activeScreen, setActiveScreen, setIsSchemaModalOpen } = usePharmacy();

  const navItems: { id: ActiveScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'receive', label: 'Receive Stock', icon: <Inbox className="w-4 h-4" /> },
    { id: 'dispense', label: 'Dispense', icon: <Send className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Layers className="w-4 h-4" /> },
    { id: 'bincard', label: 'Bin Card', icon: <FileText className="w-4 h-4" /> },
  ];

  const handleNavClick = (screen: ActiveScreen) => {
    setActiveScreen(screen);
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <aside 
      className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#1E293B] text-slate-300 flex flex-col justify-between border-r border-slate-700/60
        transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            {/* PharmaTrack Brand Logo */}
            <div className="w-9 h-9 rounded-lg bg-[#197882] flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z" rx="1" />
                <circle cx="12" cy="12" r="1.5" fill="#A4D7DC" />
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight tracking-tight">
                PharmaTrack
              </div>
              <div className="text-[10px] uppercase tracking-wider text-teal-400 font-semibold">
                Dispensary OS
              </div>
            </div>
          </div>

          {/* Mobile close */}
          {setMobileOpen && (
            <button 
              onClick={() => setMobileOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Category */}
        <div className="px-5 pt-6 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Operations
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all text-left
                  ${isActive 
                    ? 'bg-[#1F8592] text-white shadow-sm font-semibold' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'}
                `}
              >
                <span className={isActive ? 'text-white' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status & Supabase SQL Hub */}
      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={() => setIsSchemaModalOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700 text-xs text-slate-300 transition-colors group"
          title="Click to view Supabase SQL schema and configuration"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-200 group-hover:text-white">
              Database Synced
            </span>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </button>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-teal-400" />
            Supabase Ready
          </span>
          <button 
            onClick={() => setIsSchemaModalOpen(true)}
            className="text-teal-400 hover:text-teal-300 underline font-medium cursor-pointer"
          >
            SQL Codes
          </button>
        </div>
      </div>
    </aside>
  );
};
