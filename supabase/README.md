# PharmaTrack Dispensary OS - Supabase Setup Guide

## 1. Quick Setup in Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project (e.g. `pharmatrack-os`).
2. Navigate to the **SQL Editor** tab on the left navigation bar.
3. Click **New Query**, paste the contents of `supabase/schema.sql`, and click **Run**.
4. All tables (`formulary_items`, `batches`, `stock_ledger`, `market_benchmarks`), views (`v_low_stock_items`, `v_expiring_batches`), and seed records will be created automatically.

## 2. Environment Variables (.env)
Add your Supabase credentials to `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. GitHub & VS Code Compatibility
This repository is configured with:
- Standard Vite + React 19 + TypeScript configuration
- Full `.gitignore` covering `node_modules`, `.env`, build artifacts
- Express backend in `server.ts` with API proxy routes
- Clean architecture separating UI, store, API services, and database scripts
