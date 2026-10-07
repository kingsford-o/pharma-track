import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { LoginScreen } from './screens/LoginScreen';
import { AccountCreationScreen } from './screens/AccountCreationScreen';
import { ProfileProvider, ProfileGate } from '../context/ProfileContext';

/**
 * Wrap your app with this. Flow: login -> pharmacy onboarding (first time) -> your app.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (checking) return null;

  if (!session) {
    if (creatingAccount) {
      return (
        <AccountCreationScreen
          onBackToLogin={() => setCreatingAccount(false)}
          onSubmit={async (email, password, approvalPassword) => {
            const response = await fetch('/api/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, approvalPassword }),
            });
            const result = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(result.error || 'We could not create your account. Please try again.');

            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
          }}
        />
      );
    }

    return (
      <LoginScreen
        onCreateAccount={() => setCreatingAccount(true)}
        onSubmit={async (email, password) => {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }}
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
    );
  }

  return (
    <ProfileProvider userId={session.user.id}>
      <ProfileGate>{children}</ProfileGate>
    </ProfileProvider>
  );
};
