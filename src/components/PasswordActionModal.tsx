import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Loader2, X } from 'lucide-react';
import { apiPost } from '../services/api';

interface PasswordActionModalProps {
  mode: 'request' | 'reset';
  initialEmail?: string;
  accessToken?: string;
  onClose: () => void;
  onComplete: (userId: string) => void;
}

export const PasswordActionModal: React.FC<PasswordActionModalProps> = ({
  mode,
  initialEmail = '',
  accessToken,
  onClose,
  onComplete,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'reset' && password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'request') {
        await apiPost('/api/auth/password-reset', { email: email.trim() });
        setSubmitted(true);
      } else {
        if (!accessToken) throw new Error('The password reset link is invalid or has expired. Request a new link.');
        const result = await apiPost<{ userId: string }>('/api/auth/password-reset/complete', {
          accessToken,
          password,
        });
        onComplete(result.userId);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not complete this request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'request' ? 'Reset your password' : 'Choose a new password';
  const description = mode === 'request'
    ? 'Enter your account email and we will send a secure reset link if an account matches.'
    : 'Choose a new password for your account.';
  const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="password-action-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-400/30 bg-teal-500/20 text-teal-300">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 id="password-action-title" className="font-bold">{submitted ? 'Check your email' : title}</h2>
              <p className="mt-0.5 text-xs text-slate-300">{submitted ? 'Password recovery' : 'Secure account recovery'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close password recovery" className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-6">
          {submitted ? (
            <div className="space-y-5">
              <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800">
                If an account matches that email, a password reset link is on its way. Check your inbox and spam folder.
              </p>
              <button type="button" onClick={onClose} className="h-11 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700">
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-600">{description}</p>
              {mode === 'request' ? (
                <div>
                  <label htmlFor="recovery-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                  <input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
                    <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
                    <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
                    <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} />
                  </div>
                </>
              )}
              {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button type="button" onClick={onClose} className="inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
                <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Please wait…' : mode === 'request' ? 'Send reset link' : 'Update password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
