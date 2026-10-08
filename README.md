# PharmaTrack

PharmaTrack is a pharmacy inventory and dispensing application for Ghanaian pharmacies. It uses React, TypeScript, Express, and Supabase PostgreSQL. Pharmacy profiles, inventory, batches, dispensing, and financial records are persisted in Supabase; the dashboard does not load sample sales or sample stock.

## Run locally

1. Install Node.js and dependencies:

   ```sh
   npm install
   ```

2. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL Editor.
3. Configure these environment variables in the server environment:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-public-anon-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
   SESSION_SECRET=generate-at-least-32-random-characters
   MANAGER_APPROVAL_PASSWORD=choose-a-long-private-approval-password
   ```

   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used only for Supabase Auth in the browser. Keep `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and `MANAGER_APPROVAL_PASSWORD` server-side; never prefix them with `VITE_` or commit them.
4. Start the full-stack server:

   ```sh
   npm run dev
   ```

5. Run checks:

   ```sh
   npm test
   npm run lint
   npm run build
   ```

If the app shows **“Secure API setup is incomplete”**, confirm the server has `SUPABASE_URL` (or `VITE_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, and a `SESSION_SECRET` containing at least 32 characters. After changing `.env`, stop and restart `npm run dev`. Get the service-role/secret key from your Supabase project's API settings; do not use the public anon key for `SUPABASE_SERVICE_ROLE_KEY`.

Deploy the Node/Express server and built React app together on a host that supports long-running Node.js applications. Configure the same environment variables in the hosting provider. Production session cookies are `HttpOnly`, `Secure`, and `SameSite=Strict`.

## Authentication and data protection

- Supabase Auth verifies credentials. The browser sends its short-lived Supabase access token once to `POST /api/auth/session`.
- New accounts require the server-side `MANAGER_APPROVAL_PASSWORD`; each user chooses a separate password for signing in.
- The server verifies that token with Supabase and returns a signed JWT in an `HttpOnly` cookie. The app does not persist Supabase access tokens in browser storage.
- Session cookies are short-lived unless “Remember me” is selected. The Express API checks the signed session on protected routes, scopes data queries to the authenticated user's pharmacy, and uses a server-only service role key.
- Database RLS policies scope pharmacy data to `auth.uid()`. Stock receipt and FEFO dispense operations run through database functions which lock and update records transactionally.
- The schema migration removes the earlier prototype's public inventory policies. Legacy inventory rows without an owning pharmacy are deliberately not exposed or adopted; reconcile them manually before deleting any old data.

## Pharmacy workflows

- Onboarding records the pharmacy and the stock categories selected by the manager.
- Dashboard starter-formulary suggestions are filtered by those categories. Adding a suggestion sends it to the inventory API as a new item with **zero opening stock** and no fabricated price. Suggestions are generic items only; verify choices, registration, and local suitability before dispensing.
- Dashboard KPIs, charts, restocking alerts, and category summaries use that pharmacy's actual saved inventory and transactions. Empty values are zero and empty states are explicit.
- Receiving stock records the supplier, batch, expiry, and quantity. Dispensing verifies stock and deducts earliest-expiry eligible batches first (FEFO).
- Sales, Finance, and Reconciliation are functional views backed by saved transactions and inventory/batch records.
- Market benchmarks are read from the `market_benchmarks` table; the app does not present hard-coded benchmark prices.

## API overview

- `POST /api/auth/session`, `GET /api/auth/session`, `DELETE /api/auth/session` — establish, inspect, and clear the secure session.
- `GET /api/pharmacy`, `POST /api/pharmacy` — read or create the signed-in user's pharmacy profile.
- `GET /api/inventory`, `POST /api/inventory` — read inventory and add a formulary item.
- `POST /api/inventory/:itemId/receive`, `POST /api/inventory/:itemId/dispense` — transactionally update batches, stock ledger, and financial transactions.
- `GET /api/transactions`, `GET /api/market-prices` — retrieve the signed-in pharmacy's transactions or configured market benchmarks.
- `GET /api/health` — service health check.

## Tests and what they verify

Run with `npm test`.

- **Login — valid token:** verifies a Supabase-verified access token can be exchanged for a signed, `HttpOnly`, `SameSite=Strict` session cookie.
- **Login — invalid token:** verifies an unverified token is rejected with `401` and does not create a session.
- **Access control:** verifies protected pharmacy reads reject anonymous requests and return only the pharmacy whose owner matches the authenticated session.
