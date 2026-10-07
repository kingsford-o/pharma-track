import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AccountCreationScreenProps {
  onSubmit: (email: string, password: string, approvalPassword: string) => Promise<void>;
  onBackToLogin: () => void;
}

const inputClass =
  'h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export const AccountCreationScreen: React.FC<AccountCreationScreenProps> = ({ onSubmit, onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || password.length < 8 || !approvalPassword) {
      setError('Enter an email, a password with at least 8 characters, and the manager approval password.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(email.trim(), password, approvalPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not create your account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z" />
            </svg>
          </div>
          <div className="text-lg font-bold text-slate-900">Axelle MD</div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
        <p className="mt-1.5 text-sm text-slate-500">Ask your manager for the approval password to get started.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <input
              id="signup-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="approval-password" className="mb-1.5 block text-sm font-medium text-slate-700">Manager approval password</label>
            <input
              id="approval-password"
              type="password"
              required
              autoComplete="off"
              value={approvalPassword}
              onChange={(event) => setApprovalPassword(event.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Creating account' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <button onClick={onBackToLogin} className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
