# PharmaTrack Dispensary OS

A clinical pharmacy dispensary and perpetual inventory ledger OS prototype designed for hospital and community pharmacies. Built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Express.js**, with **Supabase PostgreSQL** schema and migration scripts.

---

## 🏥 Core Workflows & Features

1. **Dispensary Operations Dashboard** (`/`)
   - Low-Stock Items summary alert with designated safety reorder thresholds.
   - Expiring batches within 90 days with automated FEFO prioritization and expiring cost estimations.
   - Stock-out monitoring for critical formulary medicines.
   - Quick action shortcuts for inward stock reception and outward dispensing.

2. **Receive Stock (Stock Inward)**
   - **Clinical Stock Verification Step**: Prompts the pharmacist to verify the actual physical shelf count before inward delivery addition.
   - **Real-Time Market Data Verification**: Verifies supplier wholesale unit cost against national drug formulary and wholesale benchmarks (Ghana FDA / NHIS / WHO essential drug index) before saving to the ledger.
   - Calculates profit margin and markup in real time.
   - Posts new batches with expiry horizons and updates the perpetual bin card balance.

3. **Dispense Medication (Outward Dispense)**
   - **FEFO Batch Allocation**: Automatically allocates and ranks draws across earliest-expiring active batches (e.g. Primary Draw vs Secondary Draw).
   - **Inventory Quota Exception Prevention**: Blocks dispensing if requested quantity exceeds allocatable shelf inventory and provides an instant one-click *"Adjust to Max"* shortcut.
   - Logs formal prescription and ward requisition references.

4. **Formulary Inventory Catalog**
   - High-density data grid displaying all cataloged drugs, balance indicators, safety thresholds, and cost/selling prices.
   - Segmented filters for *All*, *Low stock*, *Expiring soon*, and *Out of stock*.
   - Total stock value at cost calculation.
   - Modal to enroll new formulary drugs and opening consignments.

5. **Bin Card & Stock Movement Ledger**
   - Perpetual digital bin card with full live audit trail (Date, Type, Supplier/Customer, Batch, Expiry, Qty In, Qty Out, Balance, Recorded By).
   - FEFO batch inventory on shelf.
   - Export ledger to CSV.

6. **Supabase Database & Code Hub**
   - One-click copy for the full Supabase PostgreSQL schema (`supabase/schema.sql`).
   - Tables: `formulary_items`, `batches`, `stock_ledger`, `market_benchmarks`.
   - Views: `v_low_stock_items`, `v_expiring_batches`.
   - Row Level Security (RLS) policies and complete seed data.

---

## 💻 Opening in VS Code & Git Setup

```bash
# 1. Clone your GitHub repository
git clone <your-repo-url>
cd pharmatrack-dispensary-os

# 2. Open cleanly in Visual Studio Code
code .

# 3. Install dependencies
npm install

# 4. Start the full-stack development server
npm run dev
```

---

## 🗄️ Supabase Setup
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste `supabase/schema.sql`, and execute it.
3. Add your project credentials to `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
