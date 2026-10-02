import React, { useState } from 'react';
import { 
  Search, 
  Building2, 
  ChevronDown, 
  Menu,
  Database,
  Check,
  Sparkles
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { items, setSelectedItemId, setActiveScreen, setIsSchemaModalOpen } = usePharmacy();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const [activeFacility, setActiveFacility] = useState('St. Jude Community Pharmacy');
  const [activeUser, setActiveUser] = useState({
    name: 'Sarah Jenkins',
    role: 'Pharmacist',
    license: 'GPC-2024-8891'
  });

  const filteredItems = searchTerm.trim() 
    ? items.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.batches.some(b => b.batchNo.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  const handleSelectSearchResult = (itemId: string) => {
    setSelectedItemId(itemId);
    setActiveScreen('bincard');
    setSearchTerm('');
    setSearchResultsOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
      {/* Mobile Drawer Trigger & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Drug / Batch Search */}
        <div className="relative flex-1">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search drug, batch or code (⌘K)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchResultsOpen(true);
              }}
              onFocus={() => setSearchResultsOpen(true)}
              className="w-full pl-9 pr-12 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white transition-colors"
            />
            <span className="hidden sm:inline-block absolute right-2.5 text-[10px] font-mono text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">
              ⌘K
            </span>
          </div>

          {/* Search Dropdown Results */}
          {searchResultsOpen && searchTerm.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item.id)}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-teal-50/60 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-teal-800">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.presentation} · SKU: {item.sku} · Shelf: {item.shelfLocation}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold font-mono tabular-nums ${
                        item.currentBalance === 0 ? 'text-rose-600' :
                        item.currentBalance <= item.minThreshold ? 'text-amber-600' : 'text-slate-700'
                      }`}>
                        {item.currentBalance} {item.unit}
                      </span>
                      <div className="text-[10px] text-slate-400">View Bin Card →</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-xs text-slate-500 text-center">
                  No matching drug or batch found for "{searchTerm}".
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Facility Badge, Supabase Button & Pharmacist Profile */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Supabase Quick Code Button */}
        <button
          onClick={() => setIsSchemaModalOpen(true)}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200/80 cursor-pointer"
          title="View & Copy Supabase PostgreSQL Schema"
        >
          <Database className="w-3.5 h-3.5 text-teal-600" />
          <span>Supabase SQL</span>
        </button>

        {/* Facility Selector */}
        <div className="relative">
          <button
            onClick={() => setFacilityOpen(!facilityOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-sky-50/60 border border-sky-100 rounded-lg hover:bg-sky-100/60 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline font-semibold">{activeFacility}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {facilityOpen && (
            <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-1.5 text-xs divide-y divide-slate-100">
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Assigned Dispensaries
              </div>
              <button
                onClick={() => { setActiveFacility('St. Jude Community Pharmacy'); setFacilityOpen(false); }}
                className="w-full flex items-center justify-between px-2.5 py-2 text-left hover:bg-slate-50 rounded"
              >
                <div>
                  <div className="font-semibold text-slate-800">St. Jude Community Pharmacy</div>
                  <div className="text-[10px] text-slate-500">Central Dispensary · Accra</div>
                </div>
                {activeFacility === 'St. Jude Community Pharmacy' && <Check className="w-4 h-4 text-teal-600" />}
              </button>
              <button
                onClick={() => { setActiveFacility('Ridge Regional Satellite'); setFacilityOpen(false); }}
                className="w-full flex items-center justify-between px-2.5 py-2 text-left hover:bg-slate-50 rounded"
              >
                <div>
                  <div className="font-semibold text-slate-800">Ridge Regional Satellite</div>
                  <div className="text-[10px] text-slate-500">Outpatient Depot #2</div>
                </div>
                {activeFacility === 'Ridge Regional Satellite' && <Check className="w-4 h-4 text-teal-600" />}
              </button>
            </div>
          )}
        </div>

        {/* Pharmacist User Profile Badge */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2.5 text-xs text-slate-600 hover:text-slate-900 group"
          >
            {/* User Avatar */}
            <div className="relative w-8 h-8 rounded-full bg-slate-200 ring-2 ring-teal-500/30 overflow-hidden flex items-center justify-center font-bold text-teal-800 text-xs shadow-inner">
              <span className="sr-only">{activeUser.name}</span>
              SJ
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-[10px] text-slate-400 leading-none">Using as:</div>
              <div className="font-semibold text-slate-800 leading-tight">
                {activeUser.name}, {activeUser.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2 text-xs">
              <div className="px-2 py-1.5 border-b border-slate-100">
                <div className="font-bold text-slate-800">{activeUser.name}</div>
                <div className="text-[11px] text-teal-600 font-medium">Licensed {activeUser.role}</div>
                <div className="text-[10px] text-slate-400 font-mono">Reg: {activeUser.license}</div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setActiveUser({ name: 'A. Patel', role: 'Pharmacist', license: 'GPC-2022-4410' });
                    setUserDropdownOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded text-slate-700"
                >
                  Switch to A. Patel, Pharmacist
                </button>
                <button
                  onClick={() => {
                    setActiveUser({ name: 'M. Davis', role: 'Dispenser', license: 'GPC-2025-1033' });
                    setUserDropdownOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded text-slate-700"
                >
                  Switch to M. Davis, Dispenser
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
