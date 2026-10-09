import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SESSION_COOKIE = 'pharmatrack_session';
const SESSION_SECONDS = 60 * 60 * 8;
const REMEMBERED_SESSION_SECONDS = 60 * 60 * 24 * 30;

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

export interface ApiDependencies {
  supabase?: SupabaseClient;
  sessionSecret?: string;
  nodeEnv?: string;
  verifyAccessToken?: (token: string) => Promise<string | null>;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signSession(userId: string, secret: string, remember: boolean): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: userId, iat: now, exp: now + (remember ? REMEMBERED_SESSION_SECONDS : SESSION_SECONDS) });
  const content = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(content).digest('base64url');
  return `${content}.${signature}`;
}

function verifySession(token: string, secret: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const content = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', secret).update(content).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(parts[2], 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as SessionPayload;
    if (typeof payload.sub !== 'string' || !payload.sub || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maxLength = 200): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' &&
    value.trim().length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validNumber(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min;
}

function validDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const profileColumns = 'id, owner_id, name, manager_name, inventory_size, stock_categories';

function logPharmacyLookupFailure(error: { code?: string; message: string; details?: string; hint?: string }) {
  const cause = error.details?.split(/\r?\n/).find((line) => line.startsWith('Caused by: '));
  console.error('Pharmacy lookup failed:', {
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(cause ? { cause } : {}),
    ...(error.hint ? { hint: error.hint } : {}),
  });
}

export function createApiApp(dependencies: ApiDependencies = {}) {
  const app = express();
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
  const supabaseProjectMismatch = Boolean(
    serverSupabaseUrl && browserSupabaseUrl &&
    normalizeSupabaseOrigin(serverSupabaseUrl) &&
    normalizeSupabaseOrigin(browserSupabaseUrl) &&
    normalizeSupabaseOrigin(serverSupabaseUrl) !== normalizeSupabaseOrigin(browserSupabaseUrl),
  );
  const supabase =
    dependencies.supabase ??
    (supabaseUrl && serviceRoleKey && !invalidSupabaseUrl && !supabaseProjectMismatch
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : undefined);
  const sessionSecret = dependencies.sessionSecret ?? process.env.SESSION_SECRET;
  const nodeEnv = dependencies.nodeEnv ?? process.env.NODE_ENV;

  app.use(express.json({ limit: '32kb' }));

  const cookieOptions = (remember: boolean) =>
    `Path=/; HttpOnly; SameSite=Strict; Max-Age=${remember ? REMEMBERED_SESSION_SECONDS : SESSION_SECONDS}${nodeEnv === 'production' ? '; Secure' : ''}`;
  const clearCookieOptions = `Path=/; HttpOnly; SameSite=Strict; Max-Age=0${nodeEnv === 'production' ? '; Secure' : ''}`;

  const requireConfiguration = (_req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];
    if (!supabase) {
      if (!supabaseUrl) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
      if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    }
    if (!sessionSecret || sessionSecret.length < 32) missing.push('SESSION_SECRET (at least 32 characters)');
    if (invalidSupabaseUrl) {
      res.status(503).json({ error: 'Supabase URL configuration is invalid. Use a valid project URL, and use HTTPS outside local development.' });
      return;
    }
    if (supabaseProjectMismatch) {
      res.status(503).json({
        error: 'The browser and server are configured for different Supabase projects. Set VITE_SUPABASE_URL and SUPABASE_URL to the same project, then restart the server.',
      });
      return;
    }
    if (!dependencies.supabase && supabaseUrl && serviceRoleKey && !supabase) {
      res.status(503).json({ error: 'Supabase server configuration could not be initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
      return;
    }
    if (missing.length > 0) {
      res.status(503).json({
        error: `Secure API setup is incomplete. Add ${missing.join(' and ')} to the server .env file, then restart the server.`,
      });
      return;
    }
    next();
  };

  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const cookieHeader = req.headers.cookie ?? '';
    const cookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    const token = cookie?.slice(SESSION_COOKIE.length + 1);
    if (!token || !sessionSecret) {
      res.status(401).json({ error: 'Sign in to continue.' });
      return;
    }
    const payload = verifySession(token, sessionSecret);
    if (!payload) {
      res.status(401).json({ error: 'Your session has expired. Sign in again.' });
      return;
    }
    res.locals.userId = payload.sub;
    next();
  };

  async function pharmacyForUser(userId: string) {
    if (!supabase) throw new Error('Database is not configured.');
    const owned = await supabase.from('pharmacies').select(profileColumns).eq('owner_id', userId).maybeSingle();
    if (owned.error || owned.data) return owned;
    const membership = await supabase
      .from('pharmacy_staff')
      .select('pharmacy_id')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();
    if (membership.error || !membership.data) return { data: null, error: membership.error };
    return supabase.from('pharmacies').select(profileColumns).eq('id', membership.data.pharmacy_id).maybeSingle();
  }

  async function requirePharmacy(userId: string, res: Response) {
    const { data, error } = await pharmacyForUser(userId);
    if (error) {
      logPharmacyLookupFailure(error);
      res.status(500).json({ error: 'We could not load your pharmacy profile.' });
      return null;
    }
    if (!data) {
      res.status(409).json({ error: 'Complete pharmacy setup before using inventory.' });
      return null;
    }
    return data;
  }

  const requireRoles = (...roles: string[]) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      if (profile.owner_id === res.locals.userId) {
        next();
        return;
      }
      const { data, error } = await supabase!
        .from('pharmacy_staff')
        .select('role')
        .eq('pharmacy_id', profile.id)
        .eq('user_id', res.locals.userId)
        .eq('active', true)
        .maybeSingle();
      if (error) {
        console.error('Staff permission lookup failed:', error.message);
        res.status(500).json({ error: 'We could not verify your staff permissions.' });
        return;
      }
      if (!data || !roles.includes(data.role)) {
        res.status(403).json({ error: 'Your staff role does not have permission to perform this action.' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/health', (_req, res) => res.json({ status: 'online', app: 'Axelle MD' }));

  app.post('/api/auth/password-reset', requireConfiguration, async (req, res, next) => {
    try {
      const email = isRecord(req.body) ? req.body.email : undefined;
      if (!validEmail(email)) {
        res.status(400).json({ error: 'Enter a valid email address.' });
        return;
      }
      const { error } = await supabase!.auth.resetPasswordForEmail(email.trim());
      if (error) {
        console.error('Password reset email request failed:', error.message);
        res.status(500).json({ error: 'We could not send the reset email right now. Please try again.' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/password-reset/complete', requireConfiguration, async (req, res, next) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      if (!validText(body.accessToken, 8192) || !validText(body.password, 128) || body.password.length < 8) {
        res.status(400).json({ error: 'Provide a valid reset session and a password with at least 8 characters.' });
        return;
      }
      const { data: userData, error: tokenError } = await supabase!.auth.getUser(body.accessToken);
      if (tokenError || !userData.user) {
        res.status(401).json({ error: 'The password reset link is invalid or has expired. Request a new link.' });
        return;
      }
      const { error: updateError } = await supabase!.auth.admin.updateUserById(userData.user.id, {
        password: body.password,
      });
      if (updateError) {
        console.error('Password update failed:', updateError.message);
        res.status(400).json({ error: 'We could not update that password. Check your password requirements and try again.' });
        return;
      }
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${signSession(userData.user.id, sessionSecret!, true)}; ${cookieOptions(true)}`);
      res.json({ authenticated: true, userId: userData.user.id });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/session', requireConfiguration, async (req, res, next) => {
    try {
      const accessToken = isRecord(req.body) ? req.body.accessToken : undefined;
      if (typeof accessToken !== 'string' || !accessToken) {
        res.status(400).json({ error: 'A valid sign-in token is required.' });
        return;
      }
      const remember = isRecord(req.body) ? req.body.remember !== false : true;
      let userId: string | null = null;
      if (dependencies.verifyAccessToken) {
        userId = await dependencies.verifyAccessToken(accessToken);
      } else if (supabase) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (error) {
          console.error('Supabase access-token verification failed:', error.message);
          if ((error.status ?? 0) >= 500 || error.name === 'AuthRetryableFetchError') {
            res.status(503).json({ error: 'Supabase could not verify your sign-in right now. Check server connectivity and try again.' });
            return;
          }
        } else if (data.user) {
          userId = data.user.id;
        }
      }
      if (!userId) {
        res.status(401).json({ error: 'Sign in failed. Verify your credentials and try again.' });
        return;
      }
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${signSession(userId, sessionSecret!, remember)}; ${cookieOptions(remember)}`);
      res.json({ authenticated: true, userId });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/session', requireConfiguration, (req, res) => {
    const cookie = (req.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    const token = cookie?.slice(SESSION_COOKIE.length + 1);
    const payload = token && sessionSecret ? verifySession(token, sessionSecret) : null;
    if (!payload) {
      if (token) res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${clearCookieOptions}`);
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, userId: payload.sub });
  });

  app.get('/api/users/me', requireConfiguration, authenticate, async (_req, res, next) => {
    try {
      const { data, error } = await supabase!
        .from('user_profiles')
        .select('id, email, full_name, created_at, updated_at')
        .eq('id', res.locals.userId)
        .maybeSingle();
      if (error) {
        console.error('User profile loading failed:', error.message);
        res.status(500).json({ error: 'We could not load your user profile. Apply the latest Supabase schema migration.' });
        return;
      }
      if (!data) {
        res.status(404).json({ error: 'Your profile is not synchronized yet. Re-run the Supabase schema migration.' });
        return;
      }
      res.json({ user: data });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/users/me', requireConfiguration, authenticate, async (req, res, next) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      if (!validText(body.fullName, 160)) {
        res.status(400).json({ error: 'Enter a display name up to 160 characters.' });
        return;
      }
      const { data, error } = await supabase!
        .from('user_profiles')
        .update({ full_name: body.fullName.trim(), updated_at: new Date().toISOString() })
        .eq('id', res.locals.userId)
        .select('id, email, full_name, created_at, updated_at')
        .maybeSingle();
      if (error || !data) {
        if (error) console.error('User profile update failed:', error.message);
        res.status(error ? 500 : 404).json({ error: 'We could not update your profile. Apply the latest Supabase schema migration.' });
        return;
      }
      res.json({ user: data });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/auth/session', (_req, res) => {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${clearCookieOptions}`);
    res.status(204).end();
  });

  app.get('/api/pharmacy', requireConfiguration, authenticate, async (_req, res, next) => {
    try {
      const { data, error } = await pharmacyForUser(res.locals.userId as string);
      if (error) {
        logPharmacyLookupFailure(error);
        res.status(500).json({ error: 'We could not load your pharmacy profile.' });
        return;
      }
      if (!data) {
        res.json({ profile: null });
        return;
      }
      let role = 'admin';
      if (data.owner_id !== res.locals.userId) {
        const membership = await supabase!
          .from('pharmacy_staff')
          .select('role')
          .eq('pharmacy_id', data.id)
          .eq('user_id', res.locals.userId)
          .eq('active', true)
          .maybeSingle();
        if (membership.error || !membership.data) {
          if (membership.error) console.error('Staff role loading failed:', membership.error.message);
          res.status(500).json({ error: 'We could not load staff permissions.' });
          return;
        }
        role = membership.data.role;
      }
      res.json({ profile: { ...data, role } });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/pharmacy', requireConfiguration, authenticate, async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const validCategories = ['prescription_medicines', 'over_the_counter', 'controlled_drugs', 'herbal_and_supplements', 'medical_supplies'];
      if (
        !isRecord(body) ||
        !validText(body.name, 120) ||
        !validText(body.manager_name, 120) ||
        !['small', 'medium', 'large'].includes(String(body.inventory_size)) ||
        !Array.isArray(body.stock_categories) ||
        body.stock_categories.length === 0 ||
        !body.stock_categories.every((category) => typeof category === 'string' && validCategories.includes(category))
      ) {
        res.status(400).json({ error: 'Enter a pharmacy name, manager, inventory size, and valid stock categories.' });
        return;
      }
      const { data, error } = await supabase!
        .from('pharmacies')
        .insert({
          owner_id: res.locals.userId,
          name: body.name.trim(),
          manager_name: body.manager_name.trim(),
          inventory_size: body.inventory_size,
          stock_categories: body.stock_categories,
        })
        .select(profileColumns)
        .single();
      if (error) {
        if (error.code === '23505') {
          res.status(409).json({ error: 'Your account already has a pharmacy profile.' });
          return;
        }
        if (error.code === '23503' && error.message.includes('pharmacies_owner_id_fkey')) {
          console.error('Pharmacy creation failed because the session user is missing from this Supabase project:', {
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${clearCookieOptions}`);
          res.status(401).json({ error: 'Your sign-in is no longer valid for this Supabase project. Refresh the page and sign in again.' });
          return;
        }
        console.error('Pharmacy creation failed:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        res.status(500).json({ error: 'We could not save your pharmacy profile.' });
        return;
      }
      res.status(201).json({ profile: data });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/inventory', requireConfiguration, authenticate, async (_req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const pharmacyId = profile.id;
      const [itemsResult, batchesResult, ledgerResult] = await Promise.all([
        supabase!.from('formulary_items').select('*').eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false }),
        supabase!.from('batches').select('*').eq('pharmacy_id', pharmacyId).order('expiry_date'),
        supabase!.from('stock_ledger').select('*').eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false }).limit(1000),
      ]);
      const failure = itemsResult.error || batchesResult.error || ledgerResult.error;
      if (failure) {
        console.error('Inventory loading failed:', failure.message);
        res.status(500).json({ error: 'We could not load your inventory.' });
        return;
      }
      const batches = batchesResult.data ?? [];
      const items = (itemsResult.data ?? []).map((item) => {
        const itemBatches = batches.filter((batch) => batch.item_id === item.id);
        const currentBalance = Number(item.current_balance);
        const minThreshold = Number(item.min_threshold);
        const earliestBatch = itemBatches
          .filter((batch) => batch.current_quantity > 0)
          .sort((first, second) => first.expiry_date.localeCompare(second.expiry_date))[0];
        const expiresSoon = itemBatches.some((batch) => {
          const days = Math.ceil((new Date(batch.expiry_date).getTime() - Date.now()) / 86400000);
          return batch.current_quantity > 0 && days >= 0 && days <= 90;
        });
        return {
          id: item.id,
          sku: item.sku,
          name: item.name,
          presentation: item.presentation,
          category: item.category,
          unit: item.unit,
          currentBalance,
          minThreshold,
          shelfLocation: item.shelf_location,
          formDescription: item.form_description,
          costPriceGhc: Number(item.cost_price_ghc),
          sellingPriceGhc: Number(item.selling_price_ghc),
          earliestExpiry: earliestBatch?.expiry_date ?? 'None',
          status: currentBalance === 0 ? 'Out of stock' : currentBalance <= minThreshold ? 'Low stock' : expiresSoon ? 'Expiring soon' : 'In stock',
          batches: itemBatches.map((batch) => ({
          id: batch.id,
          locationId: batch.location_id ?? null,
          batchNo: batch.batch_no,
          shelfLocation: batch.shelf_location,
          expiryDate: batch.expiry_date,
          expiryDaysLeft: Math.ceil((new Date(batch.expiry_date).getTime() - Date.now()) / 86400000),
          initialQuantity: batch.initial_quantity,
          currentQuantity: batch.current_quantity,
          costPriceGhc: Number(batch.cost_price_ghc),
          supplierName: batch.supplier_name,
          isRecalled: Boolean(batch.is_recalled),
          })),
        };
      });
      const ledger = (ledgerResult.data ?? []).map((entry) => ({
        id: entry.id,
        itemId: entry.item_id,
        date: new Date(entry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        rawDate: entry.created_at,
        type: entry.type,
        supplierOrCustomer: entry.supplier_or_customer ?? '',
        referenceDetails: entry.reference_details ?? '',
        batchNo: entry.batch_no ?? '',
        expiryLabel: entry.expiry_date ? new Date(entry.expiry_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '',
        qtyIn: entry.qty_in,
        qtyOut: entry.qty_out,
        balanceAfter: entry.balance_after,
        recordedBy: entry.recorded_by ?? '',
      }));
      res.json({ items, ledger });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/inventory', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const body = req.body as Record<string, unknown>;
      if (
        !isRecord(body) ||
        !validText(body.name, 160) ||
        !validText(body.category, 100) ||
        !validText(body.unit, 30) ||
        !validNumber(body.minThreshold) ||
        !Number.isInteger(body.minThreshold) ||
        !validNumber(body.costPriceGhc) ||
        !validNumber(body.sellingPriceGhc)
      ) {
        res.status(400).json({ error: 'Enter valid medicine details and non-negative price and threshold values.' });
        return;
      }
      const initialQuantity = body.initialQuantity === undefined ? 0 : body.initialQuantity;
      if (
        !validNumber(initialQuantity) ||
        !Number.isInteger(initialQuantity) ||
        (initialQuantity > 0 &&
          (!validText(body.initialBatchNo, 80) ||
            !validDateOnly(body.initialExpiryDate) ||
            Date.parse(body.initialExpiryDate) <= Date.now()))
      ) {
        res.status(400).json({ error: 'Opening stock must be a non-negative whole number.' });
        return;
      }
      const { data, error } = await supabase!.rpc('create_inventory_item', {
        p_owner_id: res.locals.userId,
        p_pharmacy_id: profile.id,
        p_sku: validText(body.sku, 80) ? body.sku.trim() : `SKU-${randomUUID().slice(0, 12).toUpperCase()}`,
        p_name: body.name.trim(),
        p_presentation: validText(body.presentation, 100) ? body.presentation.trim() : '',
        p_category: body.category.trim(),
        p_unit: body.unit.trim(),
        p_min_threshold: body.minThreshold,
        p_shelf_location: validText(body.shelfLocation, 100) ? body.shelfLocation.trim() : '',
        p_form_description: validText(body.formDescription, 200) ? body.formDescription.trim() : '',
        p_cost_price: body.costPriceGhc,
        p_selling_price: body.sellingPriceGhc,
        p_initial_quantity: initialQuantity,
        p_batch_no: validText(body.initialBatchNo, 80) ? body.initialBatchNo.trim().toUpperCase() : null,
        p_expiry_date: typeof body.initialExpiryDate === 'string' ? body.initialExpiryDate : null,
      });
      if (error) {
        console.error('Inventory item creation failed:', error.message);
        res.status(500).json({ error: 'We could not add this medicine.' });
        return;
      }
      res.status(201).json({ id: data });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/inventory/:itemId', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const body = req.body as Record<string, unknown>;
      if (
        !isRecord(body) ||
        !validText(body.name, 160) ||
        !validText(body.sku, 80) ||
        !validText(body.category, 100) ||
        !validNumber(body.minThreshold) ||
        !Number.isInteger(body.minThreshold) ||
        !validNumber(body.costPriceGhc) ||
        !validNumber(body.sellingPriceGhc) ||
        typeof body.presentation !== 'string' ||
        body.presentation.length > 100 ||
        typeof body.shelfLocation !== 'string' ||
        body.shelfLocation.length > 100 ||
        typeof body.formDescription !== 'string' ||
        body.formDescription.length > 200
      ) {
        res.status(400).json({ error: 'Enter valid medicine details and non-negative price and threshold values.' });
        return;
      }

      const itemQuery = supabase!.from('formulary_items').select('current_balance')
        .eq('pharmacy_id', profile.id).eq('id', req.params.itemId);
      const { data: existingItem, error: lookupError } = await itemQuery.maybeSingle();
      if (lookupError) {
        console.error('Inventory item lookup failed:', lookupError.message);
        res.status(500).json({ error: 'We could not load this inventory item.' });
        return;
      }
      if (!existingItem) {
        res.status(404).json({ error: 'This medicine is not in your pharmacy inventory.' });
        return;
      }

      const currentBalance = Number(existingItem.current_balance);
      const status = currentBalance === 0 ? 'Out of stock' : currentBalance <= body.minThreshold ? 'Low stock' : 'In stock';
      const { data, error } = await supabase!.from('formulary_items').update({
        sku: body.sku.trim(),
        name: body.name.trim(),
        presentation: body.presentation.trim(),
        category: body.category.trim(),
        min_threshold: body.minThreshold,
        shelf_location: body.shelfLocation.trim(),
        form_description: body.formDescription.trim(),
        cost_price_ghc: body.costPriceGhc,
        selling_price_ghc: body.sellingPriceGhc,
        status,
      }).eq('pharmacy_id', profile.id).eq('id', req.params.itemId).select('id').maybeSingle();
      if (error) {
        if (error.code === '23505') {
          res.status(409).json({ error: 'That SKU is already in use by another inventory item.' });
          return;
        }
        console.error('Inventory item update failed:', error.message);
        res.status(500).json({ error: 'We could not update this medicine.' });
        return;
      }
      if (!data) {
        res.status(404).json({ error: 'This medicine is not in your pharmacy inventory.' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/inventory/:itemId/adjust', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const body = req.body as Record<string, unknown>;
      if (
        !isRecord(body) ||
        !validNumber(body.targetQuantity) ||
        !Number.isInteger(body.targetQuantity) ||
        !validDateOnly(body.adjustmentDate) ||
        (body.batchNo !== undefined && !validText(body.batchNo, 80)) ||
        (body.expiryDate !== undefined && !validDateOnly(body.expiryDate))
      ) {
        res.status(400).json({ error: 'Enter a valid non-negative whole-number stock quantity and adjustment date.' });
        return;
      }

      const { data: existingItem, error: lookupError } = await supabase!.from('formulary_items')
        .select('current_balance')
        .eq('pharmacy_id', profile.id)
        .eq('id', req.params.itemId)
        .maybeSingle();
      if (lookupError) {
        console.error('Stock adjustment item lookup failed:', lookupError.message);
        res.status(500).json({ error: 'We could not load this inventory item.' });
        return;
      }
      if (!existingItem) {
        res.status(404).json({ error: 'This medicine is not in your pharmacy inventory.' });
        return;
      }
      if (body.targetQuantity > Number(existingItem.current_balance) && (!body.batchNo || !body.expiryDate)) {
        res.status(400).json({ error: 'To increase stock, enter the new batch number and its future expiry date.' });
        return;
      }

      const { data, error } = await supabase!.rpc('adjust_stock', {
        p_owner_id: res.locals.userId,
        p_pharmacy_id: profile.id,
        p_item_id: req.params.itemId,
        p_target_quantity: body.targetQuantity,
        p_batch_no: typeof body.batchNo === 'string' ? body.batchNo.trim().toUpperCase() : '',
        p_expiry_date: typeof body.expiryDate === 'string' ? body.expiryDate : null,
        p_adjustment_date: body.adjustmentDate,
        p_recorded_by: profile.manager_name,
      });
      if (error) {
        console.error('Stock adjustment failed:', error.message);
        const message = error.message.toLowerCase();
        const userMessage = error.code === 'P0002'
          ? 'This medicine or its stock location could not be found.'
          : message.includes('adjustment date')
            ? 'The adjustment date cannot be in the future.'
            : message.includes('expiry')
              ? 'An increase requires a batch number and future expiry date.'
              : message.includes('batch stock')
                ? 'The recorded batch quantities do not cover the current stock balance. Reconcile batches before adjusting stock.'
                : 'We could not adjust this stock quantity. Check the amount and try again.';
        res.status(error.code === 'P0002' ? 404 : 400).json({ error: userMessage });
        return;
      }
      res.json({ success: true, quantity: data });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/inventory/:itemId', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { data, error } = await supabase!.from('formulary_items')
        .delete()
        .eq('pharmacy_id', profile.id)
        .eq('id', req.params.itemId)
        .select('id')
        .maybeSingle();
      if (error) {
        console.error('Inventory item deletion failed:', error.message);
        res.status(500).json({ error: 'We could not delete this medicine.' });
        return;
      }
      if (!data) {
        res.status(404).json({ error: 'This medicine is not in your pharmacy inventory.' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/inventory/:itemId/receive', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const body = req.body as Record<string, unknown>;
      if (
        !isRecord(body) ||
        !validText(body.supplier, 160) ||
        !validText(body.batchNo, 80) ||
        !validDateOnly(body.expiryDate) ||
        !validNumber(body.quantityReceived, 1) ||
        !Number.isInteger(body.quantityReceived) ||
        !validNumber(body.physicalCountBeforeReceipt) ||
        !Number.isInteger(body.physicalCountBeforeReceipt) ||
        !validNumber(body.costPriceGhc) ||
        !validNumber(body.sellingPriceGhc) ||
        (body.locationId !== undefined && !validText(body.locationId, 80))
      ) {
        res.status(400).json({ error: 'Enter valid delivery, expiry, quantity, and price details.' });
        return;
      }
      const { data, error } = await supabase!.rpc('receive_stock', {
        p_owner_id: res.locals.userId,
        p_pharmacy_id: profile.id,
        p_item_id: req.params.itemId,
        p_supplier: body.supplier.trim(),
        p_batch_no: body.batchNo.trim().toUpperCase(),
        p_expiry_date: body.expiryDate,
        p_quantity: body.quantityReceived,
        p_physical_count: body.physicalCountBeforeReceipt,
        p_cost_price: body.costPriceGhc,
        p_selling_price: body.sellingPriceGhc,
        p_recorded_by: profile.manager_name,
        p_location_id: typeof body.locationId === 'string' ? body.locationId : null,
      });
      if (error) {
        console.error('Stock receipt failed:', error.message);
        const message = error.message.toLowerCase();
        const userMessage = message.includes('location')
          ? 'Choose a stock location belonging to this pharmacy.'
          : error.code === 'P0002'
          ? 'This medicine is not in your pharmacy inventory.'
          : message.includes('physical count')
            ? 'The physical count differs from the recorded location balance. Reconcile stock before receiving this batch.'
            : message.includes('expiry')
              ? 'The expiry date must be in the future.'
              : 'We could not post this stock receipt. Check the quantity and batch details.';
        res.status(error.code === 'P0002' ? 404 : 400).json({ error: userMessage });
        return;
      }
      res.json({ success: true, message: `Stock receipt recorded. Pharmacy-wide balance is now ${data}.` });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/inventory/:itemId/dispense', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'cashier'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const body = req.body as Record<string, unknown>;
      if (
        !isRecord(body) ||
        !validNumber(body.quantityToDispense, 1) ||
        !Number.isInteger(body.quantityToDispense) ||
        !validText(body.referenceNo, 100) ||
        !validText(body.destinationOrPatient, 160) ||
        (body.locationId !== undefined && !validText(body.locationId, 80))
      ) {
        res.status(400).json({ error: 'Enter a valid dispensing quantity, reference, and destination.' });
        return;
      }
      const { data, error } = await supabase!.rpc('dispense_stock', {
        p_owner_id: res.locals.userId,
        p_pharmacy_id: profile.id,
        p_item_id: req.params.itemId,
        p_quantity: body.quantityToDispense,
        p_reference: [
          body.referenceNo.trim(),
          validText(body.prescriberName, 120) ? `Prescriber: ${body.prescriberName.trim()}` : '',
          validText(body.notes, 250) ? body.notes.trim() : '',
        ].filter(Boolean).join(' · '),
        p_destination: body.destinationOrPatient.trim(),
        p_recorded_by: profile.manager_name,
        p_location_id: typeof body.locationId === 'string' ? body.locationId : null,
      });
      if (error) {
        console.error('Stock dispensing failed:', error.message);
        const message = error.message.toLowerCase();
        const userMessage = message.includes('location')
          ? 'Choose a stock location belonging to this pharmacy.'
          : error.code === 'P0002'
          ? 'This medicine is not in your pharmacy inventory.'
          : message.includes('batch')
            ? 'Available unexpired batches do not cover this dispense. Reconcile the stock balance before retrying.'
            : 'The dispense could not be authorized. Check the available stock and requested quantity.';
        res.status(error.code === 'P0002' ? 404 : 400).json({ error: userMessage });
        return;
      }
      res.json({ success: true, message: `Dispense recorded. Pharmacy-wide balance is now ${data}.` });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/locations', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'cashier', 'inventory_clerk'), async (_req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { data, error } = await supabase!
        .from('pharmacy_locations')
        .select('id, name, address, is_primary')
        .eq('pharmacy_id', profile.id)
        .order('is_primary', { ascending: false })
        .order('name');
      if (error) {
        console.error('Pharmacy locations loading failed:', error.message);
        res.status(500).json({ error: 'We could not load pharmacy locations. Confirm the latest database migration has been applied.' });
        return;
      }
      res.json({ locations: data ?? [] });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/management', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (_req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const [items, batches, transactions, ledger, suppliers, deliveries, locations, recalls] = await Promise.all([
        supabase!.from('formulary_items').select('id, sku, name, current_balance, min_threshold, cost_price_ghc, selling_price_ghc').eq('pharmacy_id', profile.id),
        supabase!.from('batches').select('id, item_id, location_id, batch_no, expiry_date, current_quantity, cost_price_ghc, supplier_name, is_recalled').eq('pharmacy_id', profile.id).gt('current_quantity', 0),
        supabase!.from('transactions').select('type, item_name, quantity, amount, created_at').eq('pharmacy_id', profile.id).order('created_at', { ascending: false }).limit(1000),
        supabase!.from('stock_ledger').select('type, item_id, supplier_or_customer, qty_in, qty_out, balance_after, created_at').eq('pharmacy_id', profile.id).order('created_at', { ascending: false }).limit(1000),
        supabase!.from('suppliers').select('*').eq('pharmacy_id', profile.id).order('name'),
        supabase!.from('supplier_deliveries').select('*').eq('pharmacy_id', profile.id).order('expected_date'),
        supabase!.from('pharmacy_locations').select('*').eq('pharmacy_id', profile.id).order('name'),
        supabase!.from('recalled_batches').select('*').eq('pharmacy_id', profile.id).eq('active', true).order('recalled_at', { ascending: false }),
      ]);
      const failed = [items, batches, transactions, ledger, suppliers, deliveries, locations, recalls].find((result) => result.error);
      if (failed?.error) {
        console.error('Management data loading failed:', failed.error.message);
        res.status(500).json({ error: 'We could not load management data. Confirm the latest database migration has been applied.' });
        return;
      }
      res.json({
        items: items.data ?? [],
        batches: batches.data ?? [],
        transactions: transactions.data ?? [],
        ledger: ledger.data ?? [],
        suppliers: suppliers.data ?? [],
        deliveries: deliveries.data ?? [],
        locations: locations.data ?? [],
        recalls: recalls.data ?? [],
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/management/staff', requireConfiguration, authenticate, requireRoles('admin'), async (_req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { data, error } = await supabase!.from('pharmacy_staff').select('id, user_id, email, role, active, created_at').eq('pharmacy_id', profile.id).order('created_at');
      if (error) {
        console.error('Staff loading failed:', error.message);
        res.status(500).json({ error: 'We could not load staff access.' });
        return;
      }
      res.json({ staff: data ?? [] });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/management/staff', requireConfiguration, authenticate, requireRoles('admin'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { email, role } = isRecord(req.body) ? req.body : {};
      if (!validText(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !['pharmacist', 'cashier', 'inventory_clerk'].includes(String(role))) {
        res.status(400).json({ error: 'Enter an existing account email and a valid staff role.' });
        return;
      }
      const users = await supabase!.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (users.error) {
        console.error('Staff account lookup failed:', users.error.message);
        res.status(500).json({ error: 'We could not verify that staff account.' });
        return;
      }
      const account = users.data.users.find((user) => user.email?.toLowerCase() === email.trim().toLowerCase());
      if (!account) {
        res.status(404).json({ error: 'That email does not belong to an account yet. Ask the staff member to create an account first.' });
        return;
      }
      if (account.id === profile.owner_id) {
        res.status(400).json({ error: 'The pharmacy owner already has administrator access.' });
        return;
      }
      const { data, error } = await supabase!.from('pharmacy_staff').upsert({
        pharmacy_id: profile.id,
        user_id: account.id,
        email: account.email!,
        role,
        active: true,
      }, { onConflict: 'pharmacy_id,user_id' }).select('id, user_id, email, role, active, created_at').single();
      if (error) {
        console.error('Staff role assignment failed:', error.message);
        res.status(500).json({ error: 'We could not assign this staff role.' });
        return;
      }
      res.status(201).json({ staff: data });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/management/staff/:staffId', requireConfiguration, authenticate, requireRoles('admin'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { role, active } = isRecord(req.body) ? req.body : {};
      if ((role !== undefined && !['pharmacist', 'cashier', 'inventory_clerk'].includes(String(role))) ||
        (active !== undefined && typeof active !== 'boolean') ||
        (role === undefined && active === undefined)) {
        res.status(400).json({ error: 'Provide a valid staff role or active status.' });
        return;
      }
      const changes: Record<string, unknown> = {};
      if (role !== undefined) changes.role = role;
      if (active !== undefined) changes.active = active;
      const { data, error } = await supabase!.from('pharmacy_staff').update(changes).eq('id', req.params.staffId).eq('pharmacy_id', profile.id).select('id, email, role, active').maybeSingle();
      if (error || !data) {
        if (error) console.error('Staff permission update failed:', error.message);
        res.status(error ? 500 : 404).json({ error: 'We could not update this staff member.' });
        return;
      }
      res.json({ staff: data });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/management/patients', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist'), async (_req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const [patients, prescriptions] = await Promise.all([
        supabase!.from('patients').select('*').eq('pharmacy_id', profile.id).order('full_name'),
        supabase!.from('prescriptions').select('*').eq('pharmacy_id', profile.id).order('prescribed_on', { ascending: false }),
      ]);
      if (patients.error || prescriptions.error) {
        console.error('Patient records loading failed:', patients.error?.message ?? prescriptions.error?.message);
        res.status(500).json({ error: 'We could not load patient records. Confirm the latest database migration has been applied.' });
        return;
      }
      res.json({ patients: patients.data ?? [], prescriptions: prescriptions.data ?? [] });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/management/patients', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { fullName, dateOfBirth, phone } = isRecord(req.body) ? req.body : {};
      if (!validText(fullName, 160) || (phone !== undefined && typeof phone !== 'string') ||
        (dateOfBirth !== undefined && dateOfBirth !== '' && (!validDateOnly(dateOfBirth) || Date.parse(dateOfBirth) > Date.now()))) {
        res.status(400).json({ error: 'Enter a valid patient name, date of birth, and contact number.' });
        return;
      }
      const { data, error } = await supabase!.from('patients').insert({
        pharmacy_id: profile.id,
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth || null,
        phone: typeof phone === 'string' ? phone.trim().slice(0, 40) : '',
      }).select('*').single();
      if (error) {
        console.error('Patient creation failed:', error.message);
        res.status(500).json({ error: 'We could not save this patient record.' });
        return;
      }
      res.status(201).json({ patient: data });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/management/patients/:patientId/prescriptions', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { medicineName, dosage, prescriber, prescribedOn, notes } = isRecord(req.body) ? req.body : {};
      if (!validText(medicineName, 160) ||
        (dosage !== undefined && typeof dosage !== 'string') ||
        (prescriber !== undefined && typeof prescriber !== 'string') ||
        (prescribedOn !== undefined && (!validDateOnly(prescribedOn) || Date.parse(prescribedOn) > Date.now())) ||
        (notes !== undefined && typeof notes !== 'string')) {
        res.status(400).json({ error: 'Enter valid prescription details.' });
        return;
      }
      const { data: patient, error: patientError } = await supabase!
        .from('patients')
        .select('id')
        .eq('id', req.params.patientId)
        .eq('pharmacy_id', profile.id)
        .maybeSingle();
      if (patientError || !patient) {
        if (patientError) console.error('Prescription patient lookup failed:', patientError.message);
        res.status(patientError ? 500 : 404).json({ error: 'Patient record not found for this pharmacy.' });
        return;
      }
      const { data, error } = await supabase!.from('prescriptions').insert({
        pharmacy_id: profile.id,
        patient_id: req.params.patientId,
        medicine_name: medicineName.trim(),
        dosage: typeof dosage === 'string' ? dosage.trim().slice(0, 160) : '',
        prescriber: typeof prescriber === 'string' ? prescriber.trim().slice(0, 160) : '',
        prescribed_on: prescribedOn ?? new Date().toISOString().slice(0, 10),
        notes: typeof notes === 'string' ? notes.trim().slice(0, 1000) : '',
      }).select('*').single();
      if (error) {
        console.error('Prescription creation failed:', error.message);
        res.status(400).json({ error: 'We could not save this prescription. Verify the patient belongs to this pharmacy.' });
        return;
      }
      res.status(201).json({ prescription: data });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/management/prescriptions/:prescriptionId', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { active } = isRecord(req.body) ? req.body : {};
      if (typeof active !== 'boolean') {
        res.status(400).json({ error: 'Choose whether this medication is currently active.' });
        return;
      }
      const { data, error } = await supabase!.from('prescriptions').update({ active })
        .eq('id', req.params.prescriptionId)
        .eq('pharmacy_id', profile.id)
        .select('id, active')
        .maybeSingle();
      if (error || !data) {
        if (error) console.error('Medication status update failed:', error.message);
        res.status(error ? 500 : 404).json({ error: 'We could not update this medication record.' });
        return;
      }
      res.json({ prescription: data });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/management/suppliers', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { name, contactName, email, phone, notes } = isRecord(req.body) ? req.body : {};
      if (!validText(name, 160) || [contactName, email, phone, notes].some((value) => value !== undefined && typeof value !== 'string')) {
        res.status(400).json({ error: 'Enter a supplier name and valid contact details.' });
        return;
      }
      const { data, error } = await supabase!.from('suppliers').upsert({
        pharmacy_id: profile.id,
        name: name.trim(),
        contact_name: typeof contactName === 'string' ? contactName.trim().slice(0, 160) : '',
        email: typeof email === 'string' ? email.trim().slice(0, 254) : '',
        phone: typeof phone === 'string' ? phone.trim().slice(0, 40) : '',
        notes: typeof notes === 'string' ? notes.trim().slice(0, 1000) : '',
      }, { onConflict: 'pharmacy_id,name' }).select('*').single();
      if (error) {
        console.error('Supplier save failed:', error.message);
        res.status(500).json({ error: 'We could not save this supplier.' });
        return;
      }
      res.status(201).json({ supplier: data });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/management/deliveries', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { supplierId, reference, expectedDate, notes } = isRecord(req.body) ? req.body : {};
      if (!validText(supplierId, 80) || !validText(reference, 100) || !validDateOnly(expectedDate) || (notes !== undefined && typeof notes !== 'string')) {
        res.status(400).json({ error: 'Enter a supplier, delivery reference, and expected date.' });
        return;
      }
      const { data: supplier, error: supplierError } = await supabase!
        .from('suppliers')
        .select('id')
        .eq('id', supplierId)
        .eq('pharmacy_id', profile.id)
        .maybeSingle();
      if (supplierError || !supplier) {
        if (supplierError) console.error('Delivery supplier lookup failed:', supplierError.message);
        res.status(supplierError ? 500 : 404).json({ error: 'Supplier record not found for this pharmacy.' });
        return;
      }
      const { data, error } = await supabase!.from('supplier_deliveries').insert({
        pharmacy_id: profile.id,
        supplier_id: supplierId,
        reference: reference.trim(),
        expected_date: expectedDate,
        notes: typeof notes === 'string' ? notes.trim().slice(0, 1000) : '',
      }).select('*').single();
      if (error) {
        console.error('Delivery tracking failed:', error.message);
        res.status(400).json({ error: 'We could not track this delivery. Verify the supplier belongs to this pharmacy.' });
        return;
      }
      res.status(201).json({ delivery: data });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/management/deliveries/:deliveryId', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { status } = isRecord(req.body) ? req.body : {};
      if (!['pending', 'received', 'cancelled'].includes(String(status))) {
        res.status(400).json({ error: 'Choose pending, received, or cancelled.' });
        return;
      }
      const { data, error } = await supabase!.from('supplier_deliveries').update({ status }).eq('id', req.params.deliveryId).eq('pharmacy_id', profile.id).select('*').maybeSingle();
      if (error || !data) {
        if (error) console.error('Delivery status update failed:', error.message);
        res.status(error ? 500 : 404).json({ error: 'We could not update this delivery.' });
        return;
      }
      res.json({ delivery: data });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/management/locations', requireConfiguration, authenticate, requireRoles('admin'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { name, address } = isRecord(req.body) ? req.body : {};
      if (!validText(name, 120) || (address !== undefined && typeof address !== 'string')) {
        res.status(400).json({ error: 'Enter a valid location name and address.' });
        return;
      }
      const { data, error } = await supabase!.from('pharmacy_locations').insert({
        pharmacy_id: profile.id,
        name: name.trim(),
        address: typeof address === 'string' ? address.trim().slice(0, 300) : '',
      }).select('*').single();
      if (error) {
        console.error('Location creation failed:', error.message);
        res.status(400).json({ error: 'We could not add this location. Location names must be unique.' });
        return;
      }
      res.status(201).json({ location: data });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/management/transfers', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist', 'inventory_clerk'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { itemId, batchId, destinationLocationId, quantity } = isRecord(req.body) ? req.body : {};
      if (!validText(itemId, 80) || !validText(batchId, 80) || !validText(destinationLocationId, 80) ||
        !validNumber(quantity, 1) || !Number.isInteger(quantity)) {
        res.status(400).json({ error: 'Choose an item, batch, destination, and positive whole-number quantity.' });
        return;
      }
      const { error } = await supabase!.rpc('transfer_stock', {
        p_owner_id: res.locals.userId,
        p_pharmacy_id: profile.id,
        p_item_id: itemId,
        p_batch_id: batchId,
        p_destination_location_id: destinationLocationId,
        p_quantity: quantity,
        p_recorded_by: profile.manager_name,
      });
      if (error) {
        console.error('Stock transfer failed:', error.message);
        res.status(error.code === 'P0002' ? 404 : 400).json({ error: 'We could not transfer this stock. Check the batch balance, expiry, recall status, and destination.' });
        return;
      }
      res.json({ success: true, message: 'Stock transferred and ledger updated.' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/management/batches/:batchId/recall', requireConfiguration, authenticate, requireRoles('admin', 'pharmacist'), async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const { reason } = isRecord(req.body) ? req.body : {};
      if (!validText(reason, 1000)) {
        res.status(400).json({ error: 'Provide a recall reason.' });
        return;
      }
      const { data: batch, error: batchError } = await supabase!.from('batches').update({ is_recalled: true }).eq('id', req.params.batchId).eq('pharmacy_id', profile.id).select('id').maybeSingle();
      if (batchError || !batch) {
        if (batchError) console.error('Batch recall failed:', batchError.message);
        res.status(batchError ? 500 : 404).json({ error: 'We could not find this pharmacy batch.' });
        return;
      }
      const { error } = await supabase!.from('recalled_batches').upsert({
        pharmacy_id: profile.id,
        batch_id: batch.id,
        reason: reason.trim(),
        active: true,
      }, { onConflict: 'batch_id' });
      if (error) {
        console.error('Recall record save failed:', error.message);
        res.status(500).json({ error: 'The batch is blocked from dispensing, but we could not save the recall details. Contact an administrator.' });
        return;
      }
      res.status(201).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/transactions', requireConfiguration, authenticate, async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const since = typeof req.query.since === 'string' ? req.query.since : undefined;
      const query = supabase!
        .from('transactions')
        .select('id, type, item_name, quantity, amount, created_at')
        .eq('pharmacy_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1000);
      const { data, error } = since ? await query.gte('created_at', since) : await query;
      if (error) {
        console.error('Transaction loading failed:', error.message);
        res.status(500).json({ error: 'We could not load your transactions.' });
        return;
      }
      res.json({ transactions: data ?? [] });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/market-prices', requireConfiguration, authenticate, async (_req, res, next) => {
    try {
      const { data, error } = await supabase!.from('market_benchmarks').select('*').order('item_name');
      if (error) {
        console.error('Market benchmark loading failed:', error.message);
        res.status(500).json({ error: 'We could not load market benchmarks.' });
        return;
      }
      res.json(data ?? []);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}
