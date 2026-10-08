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

function validNumber(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min;
}

function validDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const profileColumns = 'id, owner_id, name, manager_name, inventory_size, stock_categories';

export function createApiApp(dependencies: ApiDependencies = {}) {
  const app = express();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase =
    dependencies.supabase ??
    (supabaseUrl && serviceRoleKey
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
    return supabase.from('pharmacies').select(profileColumns).eq('owner_id', userId).maybeSingle();
  }

  async function requirePharmacy(userId: string, res: Response) {
    const { data, error } = await pharmacyForUser(userId);
    if (error) {
      console.error('Pharmacy lookup failed:', error.message);
      res.status(500).json({ error: 'We could not load your pharmacy profile.' });
      return null;
    }
    if (!data) {
      res.status(409).json({ error: 'Complete pharmacy setup before using inventory.' });
      return null;
    }
    return data;
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'online', app: 'PharmaTrack' }));

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
        if (!error && data.user) userId = data.user.id;
      }
      if (!userId) {
        res.status(401).json({ error: 'Sign in failed. Verify your credentials and try again.' });
        return;
      }
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${signSession(userId, sessionSecret!, remember)}; ${cookieOptions(remember)}`);
      res.json({ authenticated: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/session', requireConfiguration, authenticate, (_req, res) => {
    res.json({ authenticated: true, userId: res.locals.userId });
  });

  app.delete('/api/auth/session', (_req, res) => {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${clearCookieOptions}`);
    res.status(204).end();
  });

  app.get('/api/pharmacy', requireConfiguration, authenticate, async (_req, res, next) => {
    try {
      const { data, error } = await pharmacyForUser(res.locals.userId as string);
      if (error) {
        console.error('Pharmacy lookup failed:', error.message);
        res.status(500).json({ error: 'We could not load your pharmacy profile.' });
        return;
      }
      res.json({ profile: data });
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
        console.error('Pharmacy creation failed:', error.message);
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
          batchNo: batch.batch_no,
          shelfLocation: batch.shelf_location,
          expiryDate: batch.expiry_date,
          expiryDaysLeft: Math.ceil((new Date(batch.expiry_date).getTime() - Date.now()) / 86400000),
          initialQuantity: batch.initial_quantity,
          currentQuantity: batch.current_quantity,
          costPriceGhc: Number(batch.cost_price_ghc),
          supplierName: batch.supplier_name,
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

  app.post('/api/inventory', requireConfiguration, authenticate, async (req, res, next) => {
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

  app.post('/api/inventory/:itemId/receive', requireConfiguration, authenticate, async (req, res, next) => {
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
        !validNumber(body.sellingPriceGhc)
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
      });
      if (error) {
        console.error('Stock receipt failed:', error.message);
        const message = error.message.toLowerCase();
        const userMessage = error.code === 'P0002'
          ? 'This medicine is not in your pharmacy inventory.'
          : message.includes('physical count')
            ? 'The entered physical count differs from the recorded balance. Reconcile stock before receiving this batch.'
            : message.includes('expiry')
              ? 'The expiry date must be in the future.'
              : 'We could not post this stock receipt. Check the quantity and batch details.';
        res.status(error.code === 'P0002' ? 404 : 400).json({ error: userMessage });
        return;
      }
      res.json({ success: true, message: `Stock receipt recorded. Shelf balance is now ${data}.` });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/inventory/:itemId/dispense', requireConfiguration, authenticate, async (req, res, next) => {
    try {
      const profile = await requirePharmacy(res.locals.userId as string, res);
      if (!profile) return;
      const body = req.body as Record<string, unknown>;
      if (
        !isRecord(body) ||
        !validNumber(body.quantityToDispense, 1) ||
        !Number.isInteger(body.quantityToDispense) ||
        !validText(body.referenceNo, 100) ||
        !validText(body.destinationOrPatient, 160)
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
      });
      if (error) {
        console.error('Stock dispensing failed:', error.message);
        const message = error.message.toLowerCase();
        const userMessage = error.code === 'P0002'
          ? 'This medicine is not in your pharmacy inventory.'
          : message.includes('batch')
            ? 'Available unexpired batches do not cover this dispense. Reconcile the stock balance before retrying.'
            : 'The dispense could not be authorized. Check the available stock and requested quantity.';
        res.status(error.code === 'P0002' ? 404 : 400).json({ error: userMessage });
        return;
      }
      res.json({ success: true, message: `Dispense recorded. Shelf balance is now ${data}.` });
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
