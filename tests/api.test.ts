import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPharmaTrackApp } from '../server/app';
import deploymentHandler from '../api/dispatch';

const pharmacies = [
  { id: 'pharmacy-a', owner_id: 'user-a', name: 'A Pharmacy', manager_name: 'Manager A', inventory_size: 'small', stock_categories: ['over_the_counter'] },
  { id: 'pharmacy-b', owner_id: 'user-b', name: 'B Pharmacy', manager_name: 'Manager B', inventory_size: 'large', stock_categories: ['prescription_medicines'] },
];
const staff = [
  { id: 'staff-c', pharmacy_id: 'pharmacy-a', user_id: 'user-c', email: 'cashier@example.test', role: 'cashier', active: true },
];
const userProfile = {
  id: 'user-a',
  email: 'manager@example.test',
  full_name: 'Manager A',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};
const inventoryItem = {
  id: 'item-a',
  pharmacy_id: 'pharmacy-a',
  sku: 'SKU-A',
  name: 'Paracetamol 500mg tablets',
  current_balance: 12,
  min_threshold: 10,
  status: 'In stock',
};
let pharmacyInsertError: { code: string; message: string; details?: string; hint?: string } | null = null;
let deletedInventoryItemId: string | null = null;
let requestedPasswordResetEmail: string | null = null;
let updatedPassword: string | null = null;
const stockAdjustmentCalls: { functionName: string; params: Record<string, unknown> }[] = [];

function mockSupabase() {
  return {
    auth: {
      async resetPasswordForEmail(email: string) {
        requestedPasswordResetEmail = email;
        return { data: {}, error: null };
      },
      async getUser(token: string) {
        return token === 'valid-recovery-token'
          ? { data: { user: { id: 'user-a' } }, error: null }
          : { data: { user: null }, error: new Error('Invalid token') };
      },
      admin: {
        async updateUserById(userId: string, attributes: { password: string }) {
          if (userId !== 'user-a') return { data: { user: null }, error: new Error('Unknown user') };
          updatedPassword = attributes.password;
          return { data: { user: { id: userId } }, error: null };
        },
      },
    },
    async rpc(functionName: string, params: Record<string, unknown>) {
      stockAdjustmentCalls.push({ functionName, params });
      return { data: params.p_target_quantity, error: null };
    },
    from: (table: string) => ({
      filters: {} as Record<string, unknown>,
      updates: {} as Record<string, unknown>,
      inserts: {} as Record<string, unknown>,
      deleting: false,
      select() {
        return this;
      },
      update(values: Record<string, unknown>) {
        this.updates = values;
        return this;
      },
      insert(values: Record<string, unknown>) {
        this.inserts = values;
        return this;
      },
      delete() {
        this.deleting = true;
        return this;
      },
      eq(column: string, value: unknown) {
        this.filters[column] = value;
        return this;
      },
      async maybeSingle() {
        if (table === 'formulary_items' && this.deleting) {
          const matches = Object.entries(this.filters).every(([key, value]) => inventoryItem[key as keyof typeof inventoryItem] === value);
          if (!matches) return { data: null, error: null };
          deletedInventoryItemId = inventoryItem.id;
          return { data: { id: inventoryItem.id }, error: null };
        }
        if (table === 'user_profiles' && this.filters.id === userProfile.id) {
          Object.assign(userProfile, this.updates);
        }
        if (
          table === 'formulary_items' &&
          Object.entries(this.filters).every(([key, value]) => inventoryItem[key as keyof typeof inventoryItem] === value)
        ) {
          Object.assign(inventoryItem, this.updates);
          return { data: inventoryItem, error: null };
        }
        const row = table === 'user_profiles'
          ? (userProfile.id === this.filters.id ? userProfile : null)
          : table === 'pharmacies'
          ? pharmacies.find((pharmacy) => Object.entries(this.filters).every(([key, value]) => pharmacy[key as keyof typeof pharmacy] === value)) ?? null
          : table === 'pharmacy_staff'
            ? staff.find((member) => Object.entries(this.filters).every(([key, value]) => member[key as keyof typeof member] === value)) ?? null
          : null;
        return { data: row, error: null };
      },
      async single() {
        if (table === 'pharmacies' && pharmacyInsertError) {
          return { data: null, error: pharmacyInsertError };
        }
        return { data: null, error: null };
      },
    }),
  } as unknown as SupabaseClient;
}

let server: Server;
let baseUrl: string;

async function postWithSupabaseUrls(serverUrl: string, browserUrl: string) {
  const previousServerUrl = process.env.SUPABASE_URL;
  const previousBrowserUrl = process.env.VITE_SUPABASE_URL;
  process.env.SUPABASE_URL = serverUrl;
  process.env.VITE_SUPABASE_URL = browserUrl;
  const app = createPharmaTrackApp({
    supabase: mockSupabase(),
    sessionSecret: 'test-only-session-secret-with-at-least-32-characters',
    verifyAccessToken: async () => 'user-a',
  });
  if (previousServerUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousServerUrl;
  if (previousBrowserUrl === undefined) delete process.env.VITE_SUPABASE_URL;
  else process.env.VITE_SUPABASE_URL = previousBrowserUrl;

  const testServer = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => testServer.once('listening', resolve));
  const address = testServer.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${address.port}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'valid-token-a' }),
    });
  } finally {
    await new Promise<void>((resolve, reject) => testServer.close((error) => error ? reject(error) : resolve()));
  }
}

before(async () => {
  const app = createPharmaTrackApp({
    supabase: mockSupabase(),
    sessionSecret: 'test-only-session-secret-with-at-least-32-characters',
    verifyAccessToken: async (token) => (token === 'valid-token-a' ? 'user-a' : token === 'valid-token-b' ? 'user-b' : token === 'valid-token-c' ? 'user-c' : null),
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('login exchanges a valid Supabase access token for an HttpOnly session cookie', async () => {
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-token-a' }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true, userId: 'user-a' });
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^pharmatrack_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);

  const session = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { Cookie: cookie.split(';')[0] },
  });
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { authenticated: true, userId: 'user-a' });
});

test('session check returns an unauthenticated result without a browser error when signed out', async () => {
  const response = await fetch(`${baseUrl}/api/auth/session`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test('login rejects an invalid Supabase access token', async () => {
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'not-a-valid-token' }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Sign in failed. Verify your credentials and try again.' });
});

test('login reports a clear error when browser and server Supabase URLs differ', async () => {
  const response = await postWithSupabaseUrls(
    'https://server-project.supabase.co',
    'https://browser-project.supabase.co',
  );
  assert.equal(response.status, 503);
  assert.match((await response.json() as { error: string }).error, /different Supabase projects/);
});

test('login reports a clear error for malformed Supabase URLs', async () => {
  const response = await postWithSupabaseUrls(
    'not-a-url',
    'https://browser-project.supabase.co',
  );
  assert.equal(response.status, 503);
  assert.match((await response.json() as { error: string }).error, /Supabase URL configuration is invalid/);
});

test('users can read and update only their own user profile', async () => {
  const login = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-token-a' }),
  });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];

  const anonymous = await fetch(`${baseUrl}/api/users/me`);
  assert.equal(anonymous.status, 401);

  const profile = await fetch(`${baseUrl}/api/users/me`, { headers: { Cookie: cookie } });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json() as { user: { email: string } }).user.email, 'manager@example.test');

  const updated = await fetch(`${baseUrl}/api/users/me`, {
    method: 'PATCH',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Updated Manager' }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json() as { user: { full_name: string } }).user.full_name, 'Updated Manager');
});

test('access control requires a session and scopes pharmacy reads to the session owner', async () => {
  const anonymous = await fetch(`${baseUrl}/api/pharmacy`);
  assert.equal(anonymous.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-token-a' }),
  });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  const response = await fetch(`${baseUrl}/api/pharmacy`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const result = await response.json() as { profile: { owner_id: string } | null };
  assert.equal(result.profile?.owner_id, 'user-a');
  assert.notEqual(result.profile?.owner_id, 'user-b');
});

test('pharmacy setup clears an invalid session when its owner is missing from Supabase Auth', async () => {
  pharmacyInsertError = {
    code: '23503',
    message: 'insert or update on table "pharmacies" violates foreign key constraint "pharmacies_owner_id_fkey"',
    details: 'Key (owner_id)=(user-a) is not present in table "users".',
  };
  try {
    const login = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'valid-token-a' }),
    });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
    const response = await fetch(`${baseUrl}/api/pharmacy`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Pharmacy',
        manager_name: 'Manager A',
        inventory_size: 'small',
        stock_categories: ['over_the_counter'],
      }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: 'Your sign-in is no longer valid for this Supabase project. Refresh the page and sign in again.',
    });
    assert.match(response.headers.get('set-cookie') ?? '', /pharmatrack_session=;.*Max-Age=0/);
  } finally {
    pharmacyInsertError = null;
  }
});

test('unknown API routes return JSON instead of the SPA HTML fallback', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'API endpoint not found.' });
});

test('Vercel forwards API routes through one dispatcher without rewriting the dispatcher recursively', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    outputDirectory: string;
    rewrites: Array<{ source: string; destination: string }>;
  };
  assert.equal(config.outputDirectory, 'dist');
  assert.deepEqual(config.rewrites, [{
    source: '/api/:path((?!dispatch(?:/|$)).*)',
    destination: '/api/dispatch?__axellePath=/api/:path',
  }]);
});

test('Vercel dispatcher preserves the nested auth session route', async () => {
  const deploymentServer = createServer(deploymentHandler);
  await new Promise<void>((resolve) => deploymentServer.listen(0, '127.0.0.1', resolve));
  const address = deploymentServer.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/dispatch?__axellePath=%2Fapi%2Fauth%2Fsession`, {
      headers: { Connection: 'close' },
    });
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.ok(response.status === 401 || response.status === 503);
    assert.equal(typeof (await response.json() as { error?: unknown }).error, 'string');
  } finally {
    await new Promise<void>((resolve, reject) =>
      deploymentServer.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test('Vercel dispatcher routes the health endpoint through the Express API app', async () => {
  const deploymentServer = createServer(deploymentHandler);
  await new Promise<void>((resolve) => deploymentServer.listen(0, '127.0.0.1', resolve));
  const address = deploymentServer.address() as AddressInfo;
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/dispatch?__axellePath=%2Fapi%2Fhealth`,
      { headers: { Connection: 'close' } },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'online', app: 'Axelle MD' });
  } finally {
    await new Promise<void>((resolve, reject) =>
      deploymentServer.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test('Vercel dispatcher preserves dynamic inventory routes and query strings', async () => {
  const deploymentServer = createServer(deploymentHandler);
  await new Promise<void>((resolve) => deploymentServer.listen(0, '127.0.0.1', resolve));
  const address = deploymentServer.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/dispatch?__axellePath=%2Fapi%2Finventory%2Fitem-123%2Freceive&location=main`, {
      method: 'POST',
      headers: { Connection: 'close' },
    });
    assert.ok(response.status === 401 || response.status === 503);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.equal(typeof (await response.json() as { error?: unknown }).error, 'string');
    const deleteResponse = await fetch(`http://127.0.0.1:${address.port}/api/dispatch?__axellePath=%2Fapi%2Finventory%2Fitem-123`, {
      method: 'DELETE',
      headers: { Connection: 'close' },
    });
    assert.ok(deleteResponse.status === 401 || deleteResponse.status === 503);
    assert.match(deleteResponse.headers.get('content-type') ?? '', /application\/json/);
    assert.notDeepEqual(await deleteResponse.json(), { error: 'API endpoint not found.' });
  } finally {
    await new Promise<void>((resolve, reject) =>
      deploymentServer.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test('Vercel dispatcher rejects a forwarded path outside the API', async () => {
  const deploymentServer = createServer(deploymentHandler);
  await new Promise<void>((resolve) => deploymentServer.listen(0, '127.0.0.1', resolve));
  const address = deploymentServer.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/dispatch?__axellePath=%2Fadmin`, {
      headers: { Connection: 'close' },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid API route forwarding request.' });
  } finally {
    await new Promise<void>((resolve, reject) =>
      deploymentServer.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test('patient records reject anonymous requests', async () => {
  const response = await fetch(`${baseUrl}/api/management/patients`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Sign in to continue.' });
});

test('staff role permissions block cashier access to administrator controls', async () => {
  const login = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-token-c' }),
  });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  const response = await fetch(`${baseUrl}/api/management/staff`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Your staff role does not have permission to perform this action.' });
  const inventoryWrite = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(inventoryWrite.status, 403);
  assert.deepEqual(await inventoryWrite.json(), { error: 'Your staff role does not have permission to perform this action.' });
  const inventoryEdit = await fetch(`${baseUrl}/api/inventory/item-123`, {
    method: 'PATCH',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(inventoryEdit.status, 403);
  assert.deepEqual(await inventoryEdit.json(), { error: 'Your staff role does not have permission to perform this action.' });
  const inventoryDelete = await fetch(`${baseUrl}/api/inventory/item-a`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  assert.equal(inventoryDelete.status, 403);
  assert.deepEqual(await inventoryDelete.json(), { error: 'Your staff role does not have permission to perform this action.' });
  const patientRecords = await fetch(`${baseUrl}/api/management/patients`, { headers: { Cookie: cookie } });
  assert.equal(patientRecords.status, 403);
  const managementRecords = await fetch(`${baseUrl}/api/management`, { headers: { Cookie: cookie } });
  assert.equal(managementRecords.status, 403);
});

test('inventory item edits save catalog details and grade against quantity remaining', async () => {
  const login = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-token-a' }),
  });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  const response = await fetch(`${baseUrl}/api/inventory/item-a`, {
    method: 'PATCH',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: 'SKU-A-UPDATED',
      name: 'Paracetamol 500mg',
      presentation: 'Solid Oral',
      category: 'Analgesic',
      minThreshold: 12,
      shelfLocation: 'Shelf A1',
      formDescription: 'Tablets',
      costPriceGhc: 1.25,
      sellingPriceGhc: 2.5,
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(inventoryItem.current_balance, 12);
  assert.equal(inventoryItem.min_threshold, 12);
  assert.equal(inventoryItem.status, 'Low stock');
  assert.equal(inventoryItem.name, 'Paracetamol 500mg');
});

test('inventory stock adjustments set an exact quantity and require batch details for increases', async () => {
  stockAdjustmentCalls.length = 0;
  const adjustmentDate = new Date().toISOString().slice(0, 10);
  const login = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-token-a' }),
  });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  const headers = { Cookie: cookie, 'Content-Type': 'application/json' };

  const missingBatch = await fetch(`${baseUrl}/api/inventory/item-a/adjust`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetQuantity: 15, adjustmentDate }),
  });
  assert.equal(missingBatch.status, 400);
  assert.deepEqual(await missingBatch.json(), {
    error: 'To increase stock, enter the new batch number and its future expiry date.',
  });
  assert.equal(stockAdjustmentCalls.length, 0);

  const response = await fetch(`${baseUrl}/api/inventory/item-a/adjust`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetQuantity: 0, adjustmentDate }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, quantity: 0 });
  assert.equal(stockAdjustmentCalls[0]?.functionName, 'adjust_stock');
  assert.deepEqual(stockAdjustmentCalls[0]?.params, {
    p_owner_id: 'user-a',
    p_pharmacy_id: 'pharmacy-a',
    p_item_id: 'item-a',
    p_target_quantity: 0,
    p_batch_no: '',
    p_expiry_date: null,
    p_adjustment_date: adjustmentDate,
    p_recorded_by: 'Manager A',
  });
});

test('inventory item deletion is pharmacy-scoped and returns success for an existing item', async () => {
  deletedInventoryItemId = null;
  const login = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-token-a' }),
  });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  const response = await fetch(`${baseUrl}/api/inventory/item-a`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(deletedInventoryItemId, 'item-a');

  const otherPharmacyLogin = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-token-b' }),
  });
  const otherPharmacyCookie = (otherPharmacyLogin.headers.get('set-cookie') ?? '').split(';')[0];
  const notOwned = await fetch(`${baseUrl}/api/inventory/item-a`, {
    method: 'DELETE',
    headers: { Cookie: otherPharmacyCookie },
  });
  assert.equal(notOwned.status, 404);
  assert.deepEqual(await notOwned.json(), { error: 'This medicine is not in your pharmacy inventory.' });
});

test('password recovery requests and updates are handled by the server API', async () => {
  requestedPasswordResetEmail = null;
  updatedPassword = null;
  const request = await fetch(`${baseUrl}/api/auth/password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@example.test' }),
  });
  assert.equal(request.status, 200);
  assert.deepEqual(await request.json(), { success: true });
  assert.equal(requestedPasswordResetEmail, 'manager@example.test');

  const update = await fetch(`${baseUrl}/api/auth/password-reset/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid-recovery-token', password: 'new-safe-password' }),
  });
  assert.equal(update.status, 200);
  assert.deepEqual(await update.json(), { authenticated: true, userId: 'user-a' });
  assert.match(update.headers.get('set-cookie') ?? '', /^pharmatrack_session=/);
  assert.equal(updatedPassword, 'new-safe-password');

  const invalid = await fetch(`${baseUrl}/api/auth/password-reset/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'invalid-token', password: 'new-safe-password' }),
  });
  assert.equal(invalid.status, 401);
});
