-- ==============================================================================
-- PharmaTrack Dispensary OS - Supabase Database Schema & Seed Script
-- Compatible with PostgreSQL 15+ / Supabase PostgreSQL
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean teardown if needed (for fresh migrations)
-- DROP TABLE IF EXISTS public.stock_ledger CASCADE;
-- DROP TABLE IF EXISTS public.batches CASCADE;
-- DROP TABLE IF EXISTS public.market_benchmarks CASCADE;
-- DROP TABLE IF EXISTS public.formulary_items CASCADE;

-- 3. Formulary Items Table
CREATE TABLE IF NOT EXISTS public.formulary_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    presentation VARCHAR(128) NOT NULL,
    category VARCHAR(128) NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'tabs',
    current_balance INTEGER NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
    min_threshold INTEGER NOT NULL DEFAULT 100 CHECK (min_threshold >= 0),
    shelf_location VARCHAR(64) NOT NULL DEFAULT 'Shelf A-01-A',
    form_description TEXT,
    cost_price_ghc NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    selling_price_ghc NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    matched_sku BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Batches Table (Tracks physical inventory per consignment & expiry)
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.formulary_items(id) ON DELETE CASCADE,
    batch_no VARCHAR(64) NOT NULL,
    shelf_location VARCHAR(64) NOT NULL,
    expiry_date DATE NOT NULL,
    initial_quantity INTEGER NOT NULL CHECK (initial_quantity > 0),
    current_quantity INTEGER NOT NULL CHECK (current_quantity >= 0),
    cost_price_ghc NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    selling_price_ghc NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    supplier_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'quarantined', 'expired')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Stock Movement Ledger (Bin Card Audit Trail)
CREATE TABLE IF NOT EXISTS public.stock_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.formulary_items(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
    batch_no VARCHAR(64) NOT NULL,
    transaction_type VARCHAR(32) NOT NULL CHECK (transaction_type IN ('Received', 'Dispensed', 'Adjustment', 'Transfer')),
    supplier_customer VARCHAR(255) NOT NULL,
    reference_details VARCHAR(255),
    qty_in INTEGER CHECK (qty_in IS NULL OR qty_in > 0),
    qty_out INTEGER CHECK (qty_out IS NULL OR qty_out > 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    recorded_by VARCHAR(255) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Market Price Benchmarks Table (National Health Insurance Scheme / WHO / FDA pricing)
CREATE TABLE IF NOT EXISTS public.market_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_name VARCHAR(255) UNIQUE NOT NULL,
    wholesale_ref_ghc NUMERIC(10, 2) NOT NULL,
    retail_cap_ghc NUMERIC(10, 2) NOT NULL,
    market_range_min_ghc NUMERIC(10, 2) NOT NULL,
    market_range_max_ghc NUMERIC(10, 2) NOT NULL,
    source VARCHAR(255) NOT NULL,
    trend VARCHAR(32) DEFAULT 'stable' CHECK (trend IN ('stable', 'increasing', 'decreasing')),
    last_updated TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Views for Dispensary Dashboard
CREATE OR REPLACE VIEW public.v_low_stock_items AS
SELECT 
    id, sku, name, presentation, category, unit,
    current_balance, min_threshold, shelf_location,
    cost_price_ghc, selling_price_ghc,
    (min_threshold - current_balance) AS deficit_amount
FROM public.formulary_items
WHERE current_balance <= min_threshold
ORDER BY current_balance ASC;

CREATE OR REPLACE VIEW public.v_expiring_batches AS
SELECT 
    b.id AS batch_id,
    b.batch_no,
    b.expiry_date,
    (b.expiry_date - CURRENT_DATE) AS days_until_expiry,
    b.current_quantity,
    b.shelf_location,
    b.cost_price_ghc,
    fi.id AS item_id,
    fi.name AS item_name,
    fi.presentation,
    fi.unit
FROM public.batches b
JOIN public.formulary_items fi ON b.item_id = fi.id
WHERE b.current_quantity > 0 AND b.expiry_date <= (CURRENT_DATE + INTERVAL '90 days')
ORDER BY b.expiry_date ASC;

-- 8. Row Level Security (RLS) Configuration
ALTER TABLE public.formulary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_benchmarks ENABLE ROW LEVEL SECURITY;

-- Anonymous public read & write policies for prototype preview
CREATE POLICY "Public read formulary items" ON public.formulary_items FOR SELECT USING (true);
CREATE POLICY "Public write formulary items" ON public.formulary_items FOR ALL USING (true);

CREATE POLICY "Public read batches" ON public.batches FOR SELECT USING (true);
CREATE POLICY "Public write batches" ON public.batches FOR ALL USING (true);

CREATE POLICY "Public read stock ledger" ON public.stock_ledger FOR SELECT USING (true);
CREATE POLICY "Public write stock ledger" ON public.stock_ledger FOR ALL USING (true);

CREATE POLICY "Public read market benchmarks" ON public.market_benchmarks FOR SELECT USING (true);
CREATE POLICY "Public write market benchmarks" ON public.market_benchmarks FOR ALL USING (true);

-- ==============================================================================
-- 9. SEED DATA (Exact match to PharmaTrack Dispensary OS Screens)
-- ==============================================================================

-- Seed Market Benchmarks
INSERT INTO public.market_benchmarks (item_name, wholesale_ref_ghc, retail_cap_ghc, market_range_min_ghc, market_range_max_ghc, source, trend)
VALUES
('Paracetamol 500mg tablets', 0.25, 0.45, 0.22, 0.28, 'Ghana FDA / National Health Insurance Scheme (NHIS) Standard Formulary Benchmark', 'stable'),
('Amoxicillin 250mg capsules', 0.85, 1.40, 0.80, 0.95, 'Ghana Ministry of Health Wholesale Price Index', 'increasing'),
('Metformin 500mg tablets', 0.30, 0.60, 0.28, 0.35, 'WHO Essential Medicines Standard Pricing Board', 'stable'),
('Omeprazole 20mg capsules', 0.60, 1.15, 0.55, 0.68, 'Ghana Health Service Procurement Registry', 'stable'),
('Ibuprofen 400mg tablets', 0.20, 0.40, 0.18, 0.24, 'NHIS Tariff Index 2026', 'stable'),
('Oral Rehydration Salts (ORS)', 1.10, 1.90, 1.00, 1.25, 'UNICEF / WHO Essential Supplies Benchmark', 'decreasing'),
('Artemether / Lumefantrine 20/120', 4.50, 7.50, 4.20, 4.80, 'National Malaria Elimination Programme (NMEP) Benchmark', 'stable'),
('Ciprofloxacin 500mg tablets', 1.20, 2.10, 1.15, 1.35, 'National Essential Drugs List (NEDL)', 'increasing'),
('Zinc Sulfate 20mg dispersible tablets', 0.15, 0.35, 0.14, 0.18, 'Ghana Health Service Paediatric Drug Registry', 'stable'),
('Cefuroxime 500mg tablets', 3.20, 5.50, 3.00, 3.60, 'Ministry of Health Formulary Benchmark', 'increasing'),
('Amlodipine 5mg tablets', 0.35, 0.65, 0.32, 0.40, 'NHIS Tariff Index 2026', 'stable'),
('Loratadine 10mg tablets', 0.40, 0.75, 0.38, 0.45, 'Ghana FDA Registered Wholesalers Average', 'stable')
ON CONFLICT (item_name) DO NOTHING;

-- Seed Formulary Catalog
INSERT INTO public.formulary_items (id, sku, name, presentation, category, unit, current_balance, min_threshold, shelf_location, form_description, cost_price_ghc, selling_price_ghc, matched_sku)
VALUES
('00000000-0000-0000-0000-000000000001', 'MED-PCM-500', 'Paracetamol 500mg tablets', 'Solid Oral', 'Analgesics', 'tabs', 420, 500, 'Shelf B-04-A', 'Oral Tablets (Blister pack 10x10)', 0.25, 0.40, true),
('00000000-0000-0000-0000-000000000002', 'MED-AMX-250', 'Amoxicillin 250mg capsules', 'Antibiotic', 'Penicillin class', 'caps', 180, 400, 'Shelf A-02-C', 'Hard Gelatin Capsules (10x10 blister)', 0.85, 1.30, false),
('00000000-0000-0000-0000-000000000003', 'MED-MET-500', 'Metformin 500mg tablets', 'Antidiabetic', 'Chronic Care formulary', 'tabs', 150, 300, 'Shelf C-01-B', 'Film-coated Tablets', 0.30, 0.55, false),
('00000000-0000-0000-0000-000000000004', 'MED-OME-020', 'Omeprazole 20mg capsules', 'Gastrointestinal', 'Gastro-resistant enteric', 'caps', 90, 200, 'Shelf B-01-A', 'Enteric Coated Pellet Capsules', 0.60, 1.10, false),
('00000000-0000-0000-0000-000000000005', 'MED-IBU-400', 'Ibuprofen 400mg tablets', 'NSAID', 'NSAID Analgesic', 'tabs', 210, 350, 'Shelf B-03-D', 'Film-coated Tablets', 0.20, 0.35, false),
('00000000-0000-0000-0000-000000000006', 'MED-ORS-STD', 'Oral Rehydration Salts (ORS)', 'Hydration', 'WHO standard formula sachets', 'sachets', 45, 100, 'Shelf D-02-A', 'Powder for Oral Solution Sachet 20.5g', 1.10, 1.80, false),
('00000000-0000-0000-0000-000000000007', 'MED-ART-20', 'Artemether / Lumefantrine 20/120', 'Antimalarial', 'ACT Antimalarial', 'tabs', 140, 100, 'Shelf A-05-B', 'Yellow scored tablets 24s blister', 4.50, 7.00, false),
('00000000-0000-0000-0000-000000000008', 'MED-CIP-500', 'Ciprofloxacin 500mg tablets', 'Fluoroquinolone', 'Fluoroquinolone oral', 'tabs', 85, 60, 'Shelf A-03-B', 'White oval film-coated tablets 10x10', 1.20, 2.00, false),
('00000000-0000-0000-0000-000000000009', 'MED-ZIN-020', 'Zinc Sulfate 20mg dispersible tablets', 'Pediatric', 'Pediatric Mineral Supplement', 'tabs', 0, 50, 'Shelf D-01-B', 'Dispersible Tablets 10x10', 0.15, 0.30, false),
('00000000-0000-0000-0000-000000000010', 'MED-CEF-500', 'Cefuroxime 500mg tablets', 'Cephalosporin', 'Second-gen Cephalosporin', 'tabs', 0, 40, 'Shelf A-01-A', 'Film-coated tablets 10s pack', 3.20, 5.00, false),
('00000000-0000-0000-0000-000000000011', 'MED-AML-005', 'Amlodipine 5mg tablets', 'Antihypertensive', 'Calcium Channel Blocker', 'tabs', 600, 200, 'Shelf C-03-A', 'White round flat tablets', 0.35, 0.60, false),
('00000000-0000-0000-0000-000000000012', 'MED-LOR-010', 'Loratadine 10mg tablets', 'Antihistamine', 'Second-gen H1 Antihistamine', 'tabs', 320, 150, 'Shelf B-02-C', 'White micronized tablets', 0.40, 0.75, false)
ON CONFLICT (sku) DO NOTHING;

-- Seed Active Batches (FEFO priority queue)
INSERT INTO public.batches (id, item_id, batch_no, shelf_location, expiry_date, initial_quantity, current_quantity, cost_price_ghc, selling_price_ghc, supplier_name, status)
VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'PRC-26H14', 'Shelf B-04-A', '2026-11-15', 500, 220, 0.25, 0.40, 'PrimeCare Wholesale Ltd', 'active'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'PRC-26K02', 'Shelf B-04-A', '2027-08-31', 800, 200, 0.25, 0.40, 'PrimeCare Wholesale Ltd', 'active'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007', 'AL-26F02', 'Shelf A-05-B', '2026-11-28', 200, 140, 4.50, 7.00, 'Novartis Healthcare', 'active'),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008', 'CIP-26D19', 'Shelf A-03-B', '2026-12-12', 150, 85, 1.20, 2.00, 'Pharmanova Africa', 'active'),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'AMX-26G11', 'Shelf A-02-C', '2026-12-24', 300, 120, 0.85, 1.30, 'Medix Global Pharma', 'active')
ON CONFLICT (id) DO NOTHING;

-- Seed Bin Card Movement Ledger (Paracetamol 500mg historical trail)
INSERT INTO public.stock_ledger (item_id, batch_no, transaction_type, supplier_customer, reference_details, qty_in, qty_out, balance_after, recorded_by, transaction_date)
VALUES
('00000000-0000-0000-0000-000000000001', 'PRC-26H14', 'Dispensed', 'Ward 3 Internal Requisition', 'Requisition #W3-8820', NULL, 80, 260, 'S. Jenkins, Pharmacist', '2026-09-10'),
('00000000-0000-0000-0000-000000000001', 'PRC-26K02', 'Received', 'PrimeCare Wholesale Ltd', 'GRN #PRC-77192', 800, NULL, 1060, 'A. Patel, Pharmacist', '2026-09-14'),
('00000000-0000-0000-0000-000000000001', 'PRC-26H14', 'Dispensed', 'Outpatient Dispensary (OPD #1042)', 'Direct ambulatory dispense', NULL, 60, 1000, 'M. Davis, Dispenser', '2026-09-18'),
('00000000-0000-0000-0000-000000000001', 'PRC-26H14', 'Dispensed', 'Emergency Tray Restock', 'ER Crash Cart replenishment', NULL, 120, 880, 'S. Jenkins, Pharmacist', '2026-09-21'),
('00000000-0000-0000-0000-000000000001', 'PRC-26H14', 'Dispensed', 'Adult Medical Ward Requisition', 'Requisition #AMW-441', NULL, 200, 680, 'A. Patel, Pharmacist', '2026-09-25'),
('00000000-0000-0000-0000-000000000001', 'PRC-26H14', 'Dispensed', 'Community Prescription #7731', 'Direct ambulatory', NULL, 100, 580, 'M. Davis, Dispenser', '2026-09-28'),
('00000000-0000-0000-0000-000000000001', 'PRC-26H14', 'Dispensed', 'Ward 3 Clinic Transfer', 'Internal #W3-902', NULL, 60, 520, 'K. Mensah, Dispenser', '2026-09-30'),
('00000000-0000-0000-0000-000000000001', 'PRC-26H14', 'Dispensed', 'Outpatient Dispensary (OPD #1098)', 'Post-discharge ambulatory issue', NULL, 100, 420, 'S. Jenkins, Pharmacist', '2026-10-01');
