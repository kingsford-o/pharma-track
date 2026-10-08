import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiApp } from '../server/api';

const pharmacies = [
  { id: 'pharmacy-a', owner_id: 'user-a', name: 'A Pharmacy', manager_name: 'Manager A', inventory_size: 'small', stock_categories: ['over_the_counter'] },
  { id: 'pharmacy-b', owner_id: 'user-b', name: 'B Pharmacy', manager_name: 'Manager B', inventory_size: 'large', stock_categories: ['prescription_medicines'] },
];

function mockSupabase() {
  return {
    from: (table: string) => ({
      filters: {} as Record<string, unknown>,
      select() {
        return this;
      },
      eq(column: string, value: unknown) {
        this.filters[column] = value;
        return this;
      },
      async maybeSingle() {
        const row = table === 'pharmacies'
          ? pharmacies.find((pharmacy) => Object.entries(this.filters).every(([key, value]) => pharmacy[key as keyof typeof pharmacy] === value)) ?? null
          : null;
        return { data: row, error: null };
      },
    }),
  } as unknown as SupabaseClient;
}

let server: Server;
let baseUrl: string;

before(async () => {
  const app = createApiApp({
    supabase: mockSupabase(),
    sessionSecret: 'test-only-session-secret-with-at-least-32-characters',
    verifyAccessToken: async (token) => (token === 'valid-token-a' ? 'user-a' : token === 'valid-token-b' ? 'user-b' : null),
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
  assert.deepEqual(await response.json(), { authenticated: true });
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^pharmatrack_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
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

