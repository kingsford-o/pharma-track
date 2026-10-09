# PharmAsyst

PharmAsyst is a pharmacy management system for Ghanaian pharmacies. It uses React, TypeScript, Express, and Supabase PostgreSQL. Pharmacy profiles, inventory, batches, dispensing, and financial records are persisted in Supabase; the dashboard does not load sample sales or sample stock.

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

   `VITE_SUPABASE_URL` and `SUPABASE_URL` must point to the same Supabase project. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used only for Supabase Auth in the browser. Keep `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and `MANAGER_APPROVAL_PASSWORD` server-side; never prefix them with `VITE_` or commit them.
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

Deploy the Node/Express server and built React app together on a Node.js host, or deploy to Vercel, where `api/[...path].ts` serves the Express API. Configure the same environment variables in the hosting provider. Production session cookies are `HttpOnly`, `Secure`, and `SameSite=Strict`.

## Authentication and data protection

- Supabase Auth verifies credentials. The browser sends its short-lived Supabase access token once to `POST /api/auth/session`.
- Passwords are managed only by Supabase Auth in `auth.users`; `public.user_profiles` stores profile information linked by the auth user ID, never passwords. The schema creates profiles for new and existing auth users.
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

## Management hub

The sidebar links directly to Data Insights, Safety Monitoring, Supplier Management, Access Control, Patient Management, Barcode Scanning, and Multi-Location Support. These open the corresponding tabs in the Management hub. The hub provides saved-data insights (inventory value, dispense velocity, and stock adjustments), expiry monitoring and recall blocking, supplier contacts and delivery tracking, threshold-based reorder suggestions, staff role assignment, patient/prescription history, multiple store/storage locations with location-specific receiving and dispensing plus auditable stock transfers, and barcode/SKU lookup with supported device-camera scanning. Dispenses can print a browser-formatted receipt, and inventory SKUs can print as labels.

Run the updated [`supabase/schema.sql`](./supabase/schema.sql) migration before using the hub. Existing pharmacies receive a primary "Main store" location; existing batches are associated with it. New staff must first create a PharmAsyst account, after which an administrator can assign a role. The owner is the administrator. Patients and prescriptions are restricted to pharmacist and administrator roles; store patient information only as operationally necessary and follow applicable privacy, retention, and clinical record requirements. This feature set does not claim regulatory certification.

Barcode scanning matches the scanned value to the item's SKU. Receipt and SKU-label printing use the browser print dialog; encoded barcode label artwork and printer-specific layouts are not included.

## API overview

- `POST /api/auth/session`, `GET /api/auth/session`, `DELETE /api/auth/session` — establish, inspect, and clear the secure session.
- `GET /api/users/me`, `PATCH /api/users/me` — read or update the signed-in user's profile.
- `GET /api/pharmacy`, `POST /api/pharmacy` — read or create the signed-in user's pharmacy profile.
- `GET /api/inventory`, `POST /api/inventory` — read inventory and add a formulary item.
- `GET /api/locations` — list the signed-in pharmacy's locations for local receiving and dispensing.
- `POST /api/inventory/:itemId/receive`, `POST /api/inventory/:itemId/dispense` — transactionally update batches, stock ledger, and financial transactions.
- `GET /api/transactions`, `GET /api/market-prices` — retrieve the signed-in pharmacy's transactions or configured market benchmarks.
- `/api/management/*` — pharmacy insights, staff roles, patient/prescription records, suppliers, delivery tracking, locations, stock transfers, and batch recalls. Patient routes are restricted to pharmacists and administrators; staff and location administration is restricted to administrators.
- `GET /api/health` — service health check.

## Tests and what they verify

Run with `npm test`.

- **Login — valid token:** verifies a Supabase-verified access token can be exchanged for a signed, `HttpOnly`, `SameSite=Strict` session cookie.
- **Login — invalid token:** verifies an unverified token is rejected with `401` and does not create a session.
- **Access control:** verifies protected pharmacy reads reject anonymous requests and return only the pharmacy whose owner matches the authenticated session.
