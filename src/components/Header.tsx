import React, { useEffect, useRef, useState } from 'react';
import { Search, Building2, ChevronDown, Menu, Database, LogOut, X, AlertCircle } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useProfile } from '../context/ProfileContext';
import { supabase } from '../lib/supabaseClient';
import { apiRequest } from '../services/api';

interface HeaderProps {
  onMenuClick: () => void;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { items, setSelectedItemId, setActiveScreen, setIsSchemaModalOpen } = usePharmacy();
  const { profile } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const searchRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const signOut = async () => {
    try {
      await apiRequest<void>('/api/auth/session', { method: 'DELETE' });
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.reload();
    } catch (error) {
      console.error('Could not complete secure sign-out:', error);
      setSignOutError('Secure sign-out could not be completed. Check your connection and try again.');
    }
  };

  useClickOutside(searchRef, () => setSearchOpen(false));
  useClickOutside(userRef, () => setUserOpen(false));

  // Ctrl/Cmd + K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const term = searchTerm.trim().toLowerCase();
  const filteredItems = term
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          i.sku.toLowerCase().includes(term) ||
          i.batches.some((b) => b.batchNo.toLowerCase().includes(term)),
      )
    : [];

  const handleSelectSearchResult = (itemId: string) => {
    setSelectedItemId(itemId);
    setActiveScreen('bincard');
    setSearchTerm('');
    setSearchOpen(false);
  };

  const managerName = profile?.manager_name ?? '';
  const initials = managerName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      {/* Menu + search */}
      <div className="flex max-w-xl flex-1 items-center gap-2">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative flex-1" ref={searchRef}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search drug, batch or code"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-14 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-block">
            Ctrl K
          </kbd>

          {searchOpen && term && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item.id)}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-brand-50/60"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{item.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {item.presentation} · SKU {item.sku} · Shelf {item.shelfLocation}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          item.currentBalance === 0
                            ? 'text-rose-600'
                            : item.currentBalance <= item.minThreshold
                              ? 'text-amber-600'
                              : 'text-slate-700'
                        }`}
                      >
                        {item.currentBalance} {item.unit}
                      </div>
                      <div className="text-[11px] text-slate-400">Open bin card</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-4 text-center text-sm text-slate-500">
                  No drug or batch matches "{searchTerm}". Check the spelling or try the SKU.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pharmacy + user */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 md:flex">
          <Building2 className="h-4 w-4 text-brand-600" />
          <span className="max-w-50 truncate">{profile?.name}</span>
        </div>

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((o) => !o)}
            aria-expanded={userOpen}
            className="flex items-center gap-2.5 rounded-lg p-1 pr-2 hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {initials}
            </span>
            <span className="hidden text-left lg:block">
              <span className="block text-sm font-semibold leading-tight text-slate-800">{managerName}</span>
              <span className="block text-xs text-slate-500">Manager</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>

          {userOpen && (
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <div className="border-b border-slate-100 px-2.5 py-2">
                <div className="text-sm font-bold text-slate-800">{managerName}</div>
                <div className="text-xs text-slate-500">{profile?.name}</div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsSchemaModalOpen(true);
                    setUserOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                >
                  <Database className="h-4 w-4" />
                  Database schema
                </button>
                <button
                  onClick={() => void signOut()}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
    {signOutError && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
        <section role="alertdialog" aria-modal="true" aria-labelledby="signout-error-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-300" />
              <h2 id="signout-error-title" className="font-bold">Could not sign out</h2>
            </div>
            <button type="button" onClick={() => setSignOutError('')} aria-label="Close message" className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="space-y-4 p-6">
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800">{signOutError}</p>
            <div className="flex justify-end">
              <button type="button" onClick={() => setSignOutError('')} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Close</button>
            </div>
          </div>
        </section>
      </div>
    )}
    </>
  );
};
