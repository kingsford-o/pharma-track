-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run

create table if not exists pharmacies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  manager_name text not null,
  inventory_size text not null check (inventory_size in ('small', 'medium', 'large')),
  created_at timestamptz not null default now()
);

alter table pharmacies enable row level security;

create policy "owner reads own pharmacy" on pharmacies
  for select using (owner_id = auth.uid());
create policy "owner creates own pharmacy" on pharmacies
  for insert with check (owner_id = auth.uid());
create policy "owner updates own pharmacy" on pharmacies
  for update using (owner_id = auth.uid());

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references pharmacies(id) on delete cascade,
  type text not null check (type in ('sale', 'purchase', 'receipt')),
  item_name text,
  quantity integer not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists transactions_pharmacy_date_idx
  on transactions (pharmacy_id, created_at desc);

alter table transactions enable row level security;

create policy "owner manages own transactions" on transactions
  for all
  using (pharmacy_id in (select id from pharmacies where owner_id = auth.uid()))
  with check (pharmacy_id in (select id from pharmacies where owner_id = auth.uid()));

alter publication supabase_realtime add table transactions;
