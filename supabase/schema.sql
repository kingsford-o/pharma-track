-- Run in Supabase SQL Editor. Safe to re-run.

create table if not exists public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  manager_name text not null,
  inventory_size text not null check (inventory_size in ('small', 'medium', 'large')),
  stock_categories text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.pharmacies enable row level security;
drop policy if exists "owner reads own pharmacy" on public.pharmacies;
drop policy if exists "owner creates own pharmacy" on public.pharmacies;
drop policy if exists "owner updates own pharmacy" on public.pharmacies;
create policy "owner reads own pharmacy" on public.pharmacies for select using (owner_id = auth.uid());
create policy "owner creates own pharmacy" on public.pharmacies for insert with check (owner_id = auth.uid());
create policy "owner updates own pharmacy" on public.pharmacies for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.formulary_items (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  sku text not null,
  name text not null,
  presentation text not null default '',
  category text not null,
  unit text not null,
  current_balance integer not null default 0 check (current_balance >= 0),
  min_threshold integer not null default 0 check (min_threshold >= 0),
  shelf_location text not null default '',
  form_description text not null default '',
  cost_price_ghc numeric(12,2) not null default 0 check (cost_price_ghc >= 0),
  selling_price_ghc numeric(12,2) not null default 0 check (selling_price_ghc >= 0),
  earliest_expiry date,
  status text not null default 'Out of stock' check (status in ('In stock', 'Low stock', 'Expiring soon', 'Out of stock')),
  created_at timestamptz not null default now(),
  unique (pharmacy_id, sku)
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  item_id uuid not null references public.formulary_items(id) on delete cascade,
  batch_no text not null,
  shelf_location text not null default '',
  expiry_date date not null,
  initial_quantity integer not null check (initial_quantity > 0),
  current_quantity integer not null check (current_quantity >= 0),
  cost_price_ghc numeric(12,2) not null check (cost_price_ghc >= 0),
  supplier_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_ledger (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  item_id uuid not null references public.formulary_items(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  type text not null check (type in ('Received', 'Dispensed', 'Adjustment', 'Transfer')),
  supplier_or_customer text not null default '',
  reference_details text not null default '',
  batch_no text not null default '',
  expiry_date date,
  qty_in integer,
  qty_out integer,
  balance_after integer not null check (balance_after >= 0),
  recorded_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  type text not null check (type in ('sale', 'purchase', 'receipt')),
  item_name text,
  quantity integer not null default 0 check (quantity >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.market_benchmarks (
  id uuid primary key default gen_random_uuid(),
  item_name text not null unique,
  wholesale_ref_ghc numeric(12,2) not null check (wholesale_ref_ghc >= 0),
  retail_cap_ghc numeric(12,2) not null check (retail_cap_ghc >= 0),
  market_range_min_ghc numeric(12,2) not null check (market_range_min_ghc >= 0),
  market_range_max_ghc numeric(12,2) not null check (market_range_max_ghc >= market_range_min_ghc),
  source text not null,
  trend text not null check (trend in ('stable', 'increasing', 'decreasing')),
  last_updated date not null default current_date
);

-- Compatibility for projects that ran the earlier unowned prototype schema.
alter table public.formulary_items add column if not exists pharmacy_id uuid references public.pharmacies(id) on delete cascade;
alter table public.formulary_items add column if not exists earliest_expiry date;
alter table public.formulary_items add column if not exists status text not null default 'Out of stock';
alter table public.batches add column if not exists pharmacy_id uuid references public.pharmacies(id) on delete cascade;
alter table public.stock_ledger add column if not exists pharmacy_id uuid references public.pharmacies(id) on delete cascade;
alter table public.stock_ledger add column if not exists type text not null default 'Adjustment';
alter table public.stock_ledger add column if not exists supplier_or_customer text not null default '';
alter table public.stock_ledger add column if not exists reference_details text not null default '';
alter table public.stock_ledger add column if not exists expiry_date date;
alter table public.stock_ledger add column if not exists recorded_by text not null default '';

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_ledger' and column_name = 'transaction_type') then
    alter table public.stock_ledger alter column transaction_type drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_ledger' and column_name = 'supplier_customer') then
    alter table public.stock_ledger alter column supplier_customer drop not null;
  end if;
end
$$;

create index if not exists formulary_items_pharmacy_idx on public.formulary_items (pharmacy_id, name);
create index if not exists batches_pharmacy_item_expiry_idx on public.batches (pharmacy_id, item_id, expiry_date);
create index if not exists stock_ledger_pharmacy_date_idx on public.stock_ledger (pharmacy_id, created_at desc);
create index if not exists transactions_pharmacy_date_idx on public.transactions (pharmacy_id, created_at desc);

alter table public.formulary_items enable row level security;
alter table public.batches enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.transactions enable row level security;
alter table public.market_benchmarks enable row level security;

drop policy if exists "Public read formulary items" on public.formulary_items;
drop policy if exists "Public write formulary items" on public.formulary_items;
drop policy if exists "Public read batches" on public.batches;
drop policy if exists "Public write batches" on public.batches;
drop policy if exists "Public read stock ledger" on public.stock_ledger;
drop policy if exists "Public write stock ledger" on public.stock_ledger;
drop policy if exists "Public read market benchmarks" on public.market_benchmarks;
drop policy if exists "Public write market benchmarks" on public.market_benchmarks;

drop policy if exists "owners manage own formulary" on public.formulary_items;
create policy "owners manage own formulary" on public.formulary_items for all
  using (pharmacy_id in (select id from public.pharmacies where owner_id = auth.uid()))
  with check (pharmacy_id in (select id from public.pharmacies where owner_id = auth.uid()));
drop policy if exists "owners manage own batches" on public.batches;
create policy "owners manage own batches" on public.batches for all
  using (pharmacy_id in (select id from public.pharmacies where owner_id = auth.uid()))
  with check (pharmacy_id in (select id from public.pharmacies where owner_id = auth.uid()));
drop policy if exists "owners manage own stock ledger" on public.stock_ledger;
create policy "owners manage own stock ledger" on public.stock_ledger for all
  using (pharmacy_id in (select id from public.pharmacies where owner_id = auth.uid()))
  with check (pharmacy_id in (select id from public.pharmacies where owner_id = auth.uid()));
drop policy if exists "owners manage own transactions" on public.transactions;
create policy "owners manage own transactions" on public.transactions for all
  using (pharmacy_id in (select id from public.pharmacies where owner_id = auth.uid()))
  with check (pharmacy_id in (select id from public.pharmacies where owner_id = auth.uid()));
drop policy if exists "benchmarks are readable by signed in users" on public.market_benchmarks;
create policy "benchmarks are readable by signed in users" on public.market_benchmarks for select to authenticated using (true);

create or replace function public.receive_stock(
  p_owner_id uuid,
  p_pharmacy_id uuid,
  p_item_id uuid,
  p_supplier text,
  p_batch_no text,
  p_expiry_date date,
  p_quantity integer,
  p_physical_count integer,
  p_cost_price numeric,
  p_selling_price numeric,
  p_recorded_by text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.formulary_items%rowtype;
  new_balance integer;
begin
  if not exists (select 1 from public.pharmacies where id = p_pharmacy_id and owner_id = p_owner_id) then
    raise exception 'Pharmacy access denied' using errcode = '42501';
  end if;
  select * into item_row from public.formulary_items
    where id = p_item_id and pharmacy_id = p_pharmacy_id for update;
  if not found then raise exception 'Medicine not found' using errcode = 'P0002'; end if;
  if p_physical_count <> item_row.current_balance then
    raise exception 'Physical count does not match recorded balance' using errcode = '22023';
  end if;
  if p_quantity <= 0 or p_expiry_date <= current_date then
    raise exception 'Quantity must be positive and expiry date must be in the future' using errcode = '22023';
  end if;
  new_balance := item_row.current_balance + p_quantity;
  insert into public.batches (pharmacy_id, item_id, batch_no, shelf_location, expiry_date, initial_quantity, current_quantity, cost_price_ghc, supplier_name)
  values (p_pharmacy_id, p_item_id, p_batch_no, item_row.shelf_location, p_expiry_date, p_quantity, p_quantity, p_cost_price, p_supplier);
  update public.formulary_items set current_balance = new_balance, cost_price_ghc = p_cost_price,
    selling_price_ghc = p_selling_price, earliest_expiry = (
      select min(expiry_date) from public.batches where item_id = p_item_id and current_quantity > 0
    ), status = case when new_balance <= item_row.min_threshold then 'Low stock' else 'In stock' end
    where id = p_item_id;
  insert into public.stock_ledger (pharmacy_id, item_id, type, supplier_or_customer, reference_details, batch_no, expiry_date, qty_in, balance_after, recorded_by)
  values (p_pharmacy_id, p_item_id, 'Received', p_supplier, 'GRN #' || p_batch_no, p_batch_no, p_expiry_date, p_quantity, new_balance, p_recorded_by);
  insert into public.transactions (pharmacy_id, type, item_name, quantity, amount)
  values (p_pharmacy_id, 'purchase', item_row.name, p_quantity, p_quantity * p_cost_price);
  return new_balance;
end;
$$;

create or replace function public.dispense_stock(
  p_owner_id uuid,
  p_pharmacy_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_reference text,
  p_destination text,
  p_recorded_by text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.formulary_items%rowtype;
  batch_row public.batches%rowtype;
  remaining integer;
  draw integer;
  new_balance integer;
  first_batch text := '';
  first_expiry date;
begin
  if not exists (select 1 from public.pharmacies where id = p_pharmacy_id and owner_id = p_owner_id) then
    raise exception 'Pharmacy access denied' using errcode = '42501';
  end if;
  select * into item_row from public.formulary_items
    where id = p_item_id and pharmacy_id = p_pharmacy_id for update;
  if not found then raise exception 'Medicine not found' using errcode = 'P0002'; end if;
  if p_quantity <= 0 or p_quantity > item_row.current_balance then
    raise exception 'Dispense quantity exceeds available balance' using errcode = '22023';
  end if;
  remaining := p_quantity;
  for batch_row in
    select * from public.batches
    where item_id = p_item_id and pharmacy_id = p_pharmacy_id and current_quantity > 0 and expiry_date > current_date
    order by expiry_date, created_at
    for update
  loop
    exit when remaining = 0;
    draw := least(remaining, batch_row.current_quantity);
    update public.batches set current_quantity = current_quantity - draw where id = batch_row.id;
    remaining := remaining - draw;
    if first_batch = '' then
      first_batch := batch_row.batch_no;
      first_expiry := batch_row.expiry_date;
    end if;
  end loop;
  if remaining > 0 then raise exception 'Recorded batches do not contain enough unexpired stock' using errcode = '22023'; end if;
  new_balance := item_row.current_balance - p_quantity;
  update public.formulary_items set current_balance = new_balance,
    earliest_expiry = (select min(expiry_date) from public.batches where item_id = p_item_id and current_quantity > 0),
    status = case when new_balance = 0 then 'Out of stock' when new_balance <= item_row.min_threshold then 'Low stock' else 'In stock' end
    where id = p_item_id;
  insert into public.stock_ledger (pharmacy_id, item_id, type, supplier_or_customer, reference_details, batch_no, expiry_date, qty_out, balance_after, recorded_by)
  values (p_pharmacy_id, p_item_id, 'Dispensed', p_destination, p_reference, first_batch, first_expiry, p_quantity, new_balance, p_recorded_by);
  insert into public.transactions (pharmacy_id, type, item_name, quantity, amount)
  values (p_pharmacy_id, 'sale', item_row.name, p_quantity, p_quantity * item_row.selling_price_ghc);
  return new_balance;
end;
$$;

create or replace function public.create_inventory_item(
  p_owner_id uuid,
  p_pharmacy_id uuid,
  p_sku text,
  p_name text,
  p_presentation text,
  p_category text,
  p_unit text,
  p_min_threshold integer,
  p_shelf_location text,
  p_form_description text,
  p_cost_price numeric,
  p_selling_price numeric,
  p_initial_quantity integer,
  p_batch_no text,
  p_expiry_date date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item_id uuid;
  item_status text;
begin
  if not exists (select 1 from public.pharmacies where id = p_pharmacy_id and owner_id = p_owner_id) then
    raise exception 'Pharmacy access denied' using errcode = '42501';
  end if;
  if p_initial_quantity < 0 or p_min_threshold < 0 or p_cost_price < 0 or p_selling_price < 0 then
    raise exception 'Inventory values must be non-negative' using errcode = '22023';
  end if;
  if p_initial_quantity > 0 and (coalesce(trim(p_batch_no), '') = '' or p_expiry_date is null or p_expiry_date <= current_date) then
    raise exception 'Opening stock requires a batch number and a future expiry date' using errcode = '22023';
  end if;
  item_status := case when p_initial_quantity = 0 then 'Out of stock'
    when p_initial_quantity <= p_min_threshold then 'Low stock' else 'In stock' end;
  insert into public.formulary_items (
    pharmacy_id, sku, name, presentation, category, unit, current_balance, min_threshold,
    shelf_location, form_description, cost_price_ghc, selling_price_ghc, earliest_expiry, status
  ) values (
    p_pharmacy_id, p_sku, p_name, p_presentation, p_category, p_unit, p_initial_quantity,
    p_min_threshold, p_shelf_location, p_form_description, p_cost_price, p_selling_price,
    case when p_initial_quantity > 0 then p_expiry_date else null end, item_status
  ) returning id into item_id;
  if p_initial_quantity > 0 then
    insert into public.batches (pharmacy_id, item_id, batch_no, shelf_location, expiry_date, initial_quantity, current_quantity, cost_price_ghc, supplier_name)
    values (p_pharmacy_id, item_id, p_batch_no, p_shelf_location, p_expiry_date, p_initial_quantity, p_initial_quantity, p_cost_price, 'Opening balance');
    insert into public.stock_ledger (pharmacy_id, item_id, type, supplier_or_customer, reference_details, batch_no, expiry_date, qty_in, balance_after, recorded_by)
    values (p_pharmacy_id, item_id, 'Received', 'Opening balance', 'Opening batch', p_batch_no, p_expiry_date, p_initial_quantity, p_initial_quantity, '');
    insert into public.transactions (pharmacy_id, type, item_name, quantity, amount)
    values (p_pharmacy_id, 'purchase', p_name, p_initial_quantity, p_initial_quantity * p_cost_price);
  end if;
  return item_id;
end;
$$;

revoke all on function public.receive_stock(uuid, uuid, uuid, text, text, date, integer, integer, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.dispense_stock(uuid, uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.create_inventory_item(uuid, uuid, text, text, text, text, text, integer, text, text, numeric, numeric, integer, text, date) from public, anon, authenticated;
grant execute on function public.receive_stock(uuid, uuid, uuid, text, text, date, integer, integer, numeric, numeric, text) to service_role;
grant execute on function public.dispense_stock(uuid, uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.create_inventory_item(uuid, uuid, text, text, text, text, text, integer, text, text, numeric, numeric, integer, text, date) to service_role;
