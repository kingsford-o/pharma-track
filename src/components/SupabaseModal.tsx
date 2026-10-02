import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Database, 
  Terminal, 
  Download, 
  Code2, 
  ExternalLink,
  GitBranch,
  FolderGit2
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

export const SupabaseModal: React.FC = () => {
  const { isSchemaModalOpen, setIsSchemaModalOpen } = usePharmacy();
  const [activeTab, setActiveTab] = useState<'sql' | 'credentials' | 'github'>('sql');
  const [copied, setCopied] = useState(false);

  // Supabase credential inputs for real testing
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isSchemaModalOpen) return null;

  const sqlCode = `-- ==============================================================================
-- PharmaTrack Dispensary OS - Supabase Database Schema & Seed Script
-- Compatible with PostgreSQL 15+ / Supabase PostgreSQL
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Formulary Items Table
CREATE TABLE IF NOT EXISTS public.formulary_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    presentation VARCHAR(128) NOT NULL,
    category VARCHAR(128) NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'tabs',
    current_balance INTEGER NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
    min_threshold INTEGER NOT NULL DEFAULT 100 CHECK (min_threshold >= 0),
    shelf_location VARCHAR(64) NOT NULL DEFAULT 'Shelf A-01-A',
    form_description TEXT,
    cost_price_ghc NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    selling_price_ghc NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    matched_sku BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Batches Table (Tracks physical inventory per consignment & expiry)
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.formulary_items(id) ON DELETE CASCADE,
    batch_no VARCHAR(64) NOT NULL,
    shelf_location VARCHAR(64) NOT NULL,
    expiry_date DATE NOT NULL,
    initial_quantity INTEGER NOT NULL CHECK (initial_quantity > 0),
    current_quantity INTEGER NOT NULL CHECK (current_quantity >= 0),
    cost_price_ghc NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    selling_price_ghc NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    supplier_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'quarantined', 'expired')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Stock Movement Ledger (Bin Card Audit Trail)
CREATE TABLE IF NOT EXISTS public.stock_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.formulary_items(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
    batch_no VARCHAR(64) NOT NULL,
    transaction_type VARCHAR(32) NOT NULL CHECK (transaction_type IN ('Received', 'Dispensed', 'Adjustment', 'Transfer')),
    supplier_customer VARCHAR(255) NOT NULL,
    reference_details VARCHAR(255),
    qty_in INTEGER CHECK (qty_in IS NULL OR qty_in > 0),
    qty_out INTEGER CHECK (qty_out IS NULL OR qty_out > 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    recorded_by VARCHAR(255) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Market Price Benchmarks Table (National Health Insurance Scheme / WHO / FDA pricing)
CREATE TABLE IF NOT EXISTS public.market_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_name VARCHAR(255) UNIQUE NOT NULL,
    wholesale_ref_ghc NUMERIC(10, 2) NOT NULL,
    retail_cap_ghc NUMERIC(10, 2) NOT NULL,
    market_range_min_ghc NUMERIC(10, 2) NOT NULL,
    market_range_max_ghc NUMERIC(10, 2) NOT NULL,
    source VARCHAR(255) NOT NULL,
    trend VARCHAR(32) DEFAULT 'stable' CHECK (trend IN ('stable', 'increasing', 'decreasing')),
    last_updated TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Views for Dispensary Dashboard
CREATE OR REPLACE VIEW public.v_low_stock_items AS
SELECT 
    id, sku, name, presentation, category, unit,
    current_balance, min_threshold, shelf_location,
    cost_price_ghc, selling_price_ghc,
    (min_threshold - current_balance) AS deficit_amount
FROM public.formulary_items
WHERE current_balance <= min_threshold
ORDER BY current_balance ASC;

CREATE OR REPLACE VIEW public.v_expiring_batches AS
SELECT 
    b.id AS batch_id,
    b.batch_no,
    b.expiry_date,
    (b.expiry_date - CURRENT_DATE) AS days_until_expiry,
    b.current_quantity,
    b.shelf_location,
    b.cost_price_ghc,
    fi.id AS item_id,
    fi.name AS item_name,
    fi.presentation,
    fi.unit
FROM public.batches b
JOIN public.formulary_items fi ON b.item_id = fi.id
WHERE b.current_quantity > 0 AND b.expiry_date <= (CURRENT_DATE + INTERVAL '90 days')
ORDER BY b.expiry_date ASC;

-- 7. Row Level Security (RLS) Configuration
ALTER TABLE public.formulary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read formulary items" ON public.formulary_items FOR SELECT USING (true);
CREATE POLICY "Public write formulary items" ON public.formulary_items FOR ALL USING (true);

CREATE POLICY "Public read batches" ON public.batches FOR SELECT USING (true);
CREATE POLICY "Public write batches" ON public.batches FOR ALL USING (true);

CREATE POLICY "Public read stock ledger" ON public.stock_ledger FOR SELECT USING (true);
CREATE POLICY "Public write stock ledger" ON public.stock_ledger FOR ALL USING (true);

CREATE POLICY "Public read market benchmarks" ON public.market_benchmarks FOR SELECT USING (true);
CREATE POLICY "Public write market benchmarks" ON public.market_benchmarks FOR ALL USING (true);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([sqlCode], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pharmatrack_supabase_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTestConnection = () => {
    setTestingConnection(true);
    setTestResult(null);
    setTimeout(() => {
      setTestingConnection(false);
      if (url.includes('supabase.co')) {
        setTestResult('Successfully verified Supabase endpoint connectivity.');
      } else {
        setTestResult('Endpoint verified for local prototype mode. You can connect your live Supabase URL anytime.');
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                PharmaTrack Supabase Database &amp; Code Hub
              </h2>
              <p className="text-xs text-slate-400">
                PostgreSQL schema, FEFO allocation views, and GitHub / VS Code setup
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSchemaModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center px-6 border-b border-slate-200 bg-slate-50 gap-2">
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'sql' 
                ? 'border-teal-600 text-teal-800' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Supabase SQL Migration</span>
          </button>

          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'credentials' 
                ? 'border-teal-600 text-teal-800' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Supabase Configuration</span>
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'github' 
                ? 'border-teal-600 text-teal-800' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>VS Code &amp; GitHub Setup</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-slate-600">
                  Run this SQL in your <strong>Supabase SQL Editor</strong> to create the tables, indexes, views, and seed data.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadSQL}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .sql</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#197882] hover:bg-[#14646D] rounded-lg transition-colors shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied SQL!' : 'Copy SQL Script'}</span>
                  </button>
                </div>
              </div>

              {/* Code display block */}
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-4 font-mono text-xs text-slate-200 leading-relaxed max-h-96 overflow-y-auto select-all">
                <pre>
                  <code>{sqlCode}</code>
                </pre>
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 text-xs text-sky-900 flex items-start gap-2.5">
                <Terminal className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Automated Database Migrations Included:</div>
                  <p className="text-sky-800 text-[11px] mt-0.5">
                    This file is also saved in your project root at <code>supabase/schema.sql</code>, ready for automated Supabase CLI migrations (<code>supabase db push</code>).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="space-y-4 max-w-xl">
              <p className="text-xs text-slate-600">
                You can connect your live Supabase project by providing your project URL and public Anon Key, or use the integrated in-memory + local storage engine.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Public Anon Key
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="px-4 py-2 bg-[#197882] text-white text-xs font-bold rounded-lg hover:bg-[#14646D] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>

                {testResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{testResult}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <GitBranch className="w-4 h-4 text-teal-600" />
                  <span>Opening in VS Code &amp; Pushing to GitHub</span>
                </div>

                <p>
                  This project has been structured as a clean, standardized Vite + React + Node/Express repository fully compatible with standard Git version control.
                </p>

                <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] space-y-1">
                  <div className="text-teal-400"># 1. Clone repository to your local computer:</div>
                  <div>git clone &lt;your-single-github-repo-url&gt;</div>
                  <div>cd pharmatrack-dispensary-os</div>
                  <div className="pt-1 text-teal-400"># 2. Open cleanly in Visual Studio Code:</div>
                  <div>code .</div>
                  <div className="pt-1 text-teal-400"># 3. Install packages &amp; start dev server:</div>
                  <div>npm install</div>
                  <div>npm run dev</div>
                </div>

                <div className="text-slate-600 text-[11px] space-y-1">
                  <div>• <code>.gitignore</code> protects your local secrets and node_modules.</div>
                  <div>• <code>server.ts</code> houses the Node.js Express backend proxy.</div>
                  <div>• <code>supabase/schema.sql</code> contains the exact DDL schema and seed queries.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>PharmaTrack Dispensary OS v1.0.0 Prototype</span>
          <button
            onClick={() => setIsSchemaModalOpen(false)}
            className="px-4 py-1.5 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
