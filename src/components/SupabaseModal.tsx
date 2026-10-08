import React, { useEffect, useState } from 'react';
import { Check, Copy, Database, Download, X } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

export const SupabaseModal: React.FC = () => {
  const { isSchemaModalOpen, setIsSchemaModalOpen } = usePharmacy();
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isSchemaModalOpen) return;
    let active = true;
    setLoading(true);
    setError('');
    fetch('/api/supabase-schema')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the current Supabase migration.');
        return response.text();
      })
      .then((schema) => {
        if (active) setSql(schema);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load the migration.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isSchemaModalOpen]);

  if (!isSchemaModalOpen) return null;

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Clipboard access failed.');
    }
  };

  const downloadSql = () => {
    const file = URL.createObjectURL(new Blob([sql], { type: 'text/sql' }));
    const link = document.createElement('a');
    link.href = file;
    link.download = 'pharmatrack-supabase-schema.sql';
    link.click();
    URL.revokeObjectURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="schema-title" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-teal-300" />
            <div>
              <h2 id="schema-title" className="font-bold">Supabase database setup</h2>
              <p className="text-xs text-slate-300">Secure pharmacy profiles, inventory, batches, and audit records</p>
            </div>
          </div>
          <button onClick={() => setIsSchemaModalOpen(false)} aria-label="Close database setup" className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
          <p className="text-sm text-slate-600">
            Run this project migration in the Supabase SQL Editor. Inventory data is accessed through the authenticated Express API and protected by pharmacy ownership checks and database row-level security.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Configure the server-only Supabase service role key and a random session secret in your deployment environment.</li>
            <li>Keep the Supabase service role key off the browser and never prefix it with <code>VITE_</code>.</li>
            <li>Run <code>supabase/schema.sql</code> once against your Supabase project.</li>
          </ol>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button disabled={!sql || loading} onClick={downloadSql} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
              <Download className="mr-1.5 inline h-4 w-4" /> Download SQL
            </button>
            <button disabled={!sql || loading} onClick={() => void copySql()} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {copied ? <Check className="mr-1.5 inline h-4 w-4" /> : <Copy className="mr-1.5 inline h-4 w-4" />}
              {copied ? 'Copied' : 'Copy SQL'}
            </button>
          </div>
          <pre className="max-h-[45vh] overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
            <code>{loading ? 'Loading migration…' : sql || 'Migration unavailable.'}</code>
          </pre>
        </div>
      </section>
    </div>
  );
};
