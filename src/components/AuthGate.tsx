import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LoginScreen } from './screens/LoginScreen';
import { AccountCreationScreen } from './screens/AccountCreationScreen';
import { ProfileProvider, ProfileGate } from '../context/ProfileContext';
import { ApiError, apiGet, apiPost } from '../services/api';

/** Uses the signed HttpOnly server cookie as the persistent app session. */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    apiGet<{ authenticated: true; userId: string }>('/api/auth/session')
      .then((session) => setUserId(session.userId))
      .catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 401) {
          setSessionError(error instanceof Error ? error.message : 'We could not verify your secure session.');
        }
      })
      .finally(() => setChecking(false));
  }, []);

  const establishSession = async (email: string, password: string, remember = true) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Sign in succeeded but no authentication token was returned.');
    const session = await apiPost<{ authenticated: true; userId: string }>('/api/auth/session', {
      accessToken: data.session.access_token,
      remember,
    });
    setSessionError('');
    setUserId(session.userId);
  };

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Checking your secure session</div>;
  }

  if (!userId) {
    const warning = sessionError && (
      <div role="alert" className="mx-auto max-w-xl border-b border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
        {sessionError}
      </div>
    );
    if (creatingAccount) {
      return (
        <>
          {warning}
          <AccountCreationScreen
            onBackToLogin={() => setCreatingAccount(false)}
            onSubmit={async (email, password, approvalPassword) => {
              const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ email, password, approvalPassword }),
              });
              const result = (await response.json()) as { error?: string };
              if (!response.ok) throw new Error(result.error || 'We could not create your account. Please try again.');
              await establishSession(email, password);
            }}
          />
        </>
      );
    }

    return (
      <>
        {warning}
        <LoginScreen
          onCreateAccount={() => setCreatingAccount(true)}
          onSubmit={establishSession}
          onForgotPassword={async () => {
            const email = window.prompt('Enter your account email');
            if (!email) return;
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
            window.alert(
              error
                ? 'We could not send the reset email. Check the address and try again.'
                : 'Check your email for a reset link.',
            );
          }}
        />
      </>
    );
  }

  return (
    <ProfileProvider userId={userId}>
      <ProfileGate>{children}</ProfileGate>
    </ProfileProvider>
  );
};
