import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurationError = !url || !anonKey
  ? 'Supabase sign-in is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend environment.'
  : (() => {
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'https:' || (parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname))
          ? ''
          : 'Supabase sign-in must use HTTPS outside local development.';
      } catch {
        return 'VITE_SUPABASE_URL is not a valid Supabase project URL.';
      }
    })();

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: true,
  },
});
