import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

interface SignupRequest {
  method?: string;
  body?: unknown;
}

interface SignupResponse {
  status: (code: number) => SignupResponse;
  json: (body: { error?: string; message?: string }) => unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesManagerPassword(provided: string, approved: string): boolean {
  const providedBytes = Buffer.from(provided);
  const approvedBytes = Buffer.from(approved);
  return providedBytes.length === approvedBytes.length && timingSafeEqual(providedBytes, approvedBytes);
}

export async function handleSignup(req: SignupRequest, res: SignupResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const managerApprovalPassword = process.env.MANAGER_APPROVAL_PASSWORD;
  const serverSupabaseUrl = process.env.SUPABASE_URL?.trim();
  const browserSupabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  const supabaseUrl = serverSupabaseUrl || browserSupabaseUrl;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const normalizeSupabaseOrigin = (value: string | undefined) => {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return null;
      return url.origin.toLowerCase();
    } catch {
      return null;
    }
  };
  const invalidSupabaseUrl = [serverSupabaseUrl, browserSupabaseUrl]
    .some((value) => Boolean(value && !normalizeSupabaseOrigin(value)));
  if (invalidSupabaseUrl) {
    return res.status(503).json({ error: 'Supabase URL configuration is invalid. Use a valid project URL, and use HTTPS outside local development.' });
  }
  if (
    serverSupabaseUrl &&
    browserSupabaseUrl &&
    normalizeSupabaseOrigin(serverSupabaseUrl) !== normalizeSupabaseOrigin(browserSupabaseUrl)
  ) {
    return res.status(503).json({
      error: 'The browser and server are configured for different Supabase projects. Set VITE_SUPABASE_URL and SUPABASE_URL to the same project, then restart the server.',
    });
  }

  if (!managerApprovalPassword || !supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: 'Account creation is not configured on the server.' });
  }

  if (!isRecord(req.body)) {
    return res.status(400).json({ error: 'Enter a valid email, password, and manager approval password.' });
  }

  const { email, password, approvalPassword } = req.body;
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof approvalPassword !== 'string' ||
    !email.trim() ||
    password.length < 8 ||
    !matchesManagerPassword(approvalPassword, managerApprovalPassword)
  ) {
    return res.status(400).json({ error: 'Enter a valid email, a password of at least 8 characters, and the manager approval password.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    }
    console.error('Supabase account creation failed:', error.message);
    return res.status(400).json({ error: 'We could not create this account. Check the email and try again.' });
  }

  return res.status(201).json({ message: 'Account created. You can now sign in.' });
}
