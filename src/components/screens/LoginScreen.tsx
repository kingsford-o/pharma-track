import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';

interface LoginScreenProps {
  onSubmit: (email: string, password: string, remember: boolean) => Promise<void>;
  onForgotPassword?: () => void;
  onCreateAccount?: () => void;
}

const POINTS = [
  'Low stock and expiry alerts, every day',
  'Every batch tracked from delivery to dispensing',
  'Works on your phone at the counter',
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSubmit, onForgotPassword, onCreateAccount }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(email.trim(), password, remember);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'We could not sign you in. Check your email and password and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden bg-surface px-4 py-10 sm:px-8">
      <svg
        className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] text-brand-600 opacity-[0.04]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z" />
      </svg>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
              <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">Axelle MD</div>
              <div className="text-sm font-medium text-slate-500">Pharmacy management</div>
            </div>
          </div>

          <h1 className="mt-8 text-3xl font-bold leading-tight tracking-tight text-brand-700 sm:text-4xl lg:mt-12">
            Know what is on every shelf.
          </h1>
          <p className="mt-4 max-w-md text-base text-slate-600">
            Sign in to manage stock, sales and expiry dates for your pharmacy.
          </p>

          <ul className="mt-8 hidden space-y-3 lg:block">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-slate-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="w-full max-w-md justify-self-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:justify-self-end">
          <h2 className="text-center text-xl font-bold text-brand-700">Sign in</h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pharmacy.com"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-3.5 pr-11 text-sm text-slate-900 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                />
                Remember me
              </label>
              {onForgotPassword && (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Forgot password?
                </button>
              )}
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
              {loading ? 'Signing in' : 'Log in'}
            </button>
          </form>

          {onCreateAccount && (
            <p className="mt-6 text-center text-sm text-slate-600">
              Don't have an account?{' '}
              <button onClick={onCreateAccount} className="font-semibold text-brand-600 hover:text-brand-700">
                Create your account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
