-- ============================================================
-- TankRate SUPABASE SCHEMA
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Note: pgcron is NOT available on Supabase Free tier.
-- Scheduled refreshes are handled via an external cron service
-- (e.g. cron-job.org) calling the Edge Functions with ?refresh=true
-- See CRON-SETUP.md for instructions.

-- ============================================================
-- 1. PRICES_CACHE
-- ============================================================
create table if not exists public.prices_cache (
  id            uuid primary key default gen_random_uuid(),
  country_code  text not null,
  fuel_type     text not null check (fuel_type in ('petrol','diesel','lpg')),
  price         numeric(10,3) not null,
  currency      text not null default 'USD',
  price_usd     numeric(10,3) not null,
  unit          text not null default 'litre',
  updated_at    timestamptz not null default now()
);

create index if not exists idx_prices_cache_country
  on public.prices_cache (country_code);
create index if not exists idx_prices_cache_updated
  on public.prices_cache (updated_at);

-- ============================================================
-- 2. PRICE_HISTORY
-- ============================================================
create table if not exists public.price_history (
  id            uuid primary key default gen_random_uuid(),
  country_code  text not null,
  fuel_type     text not null check (fuel_type in ('petrol','diesel','lpg')),
  price         numeric(10,3) not null,
  price_usd     numeric(10,3) not null,
  currency      text not null,
  recorded_date date not null default current_date,
  created_at    timestamptz not null default now()
);

create unique index if not exists uq_price_history_country_fuel_date
  on public.price_history (country_code, fuel_type, recorded_date);
create index if not exists idx_price_history_country
  on public.price_history (country_code, fuel_type, recorded_date);

-- ============================================================
-- 3. EXCHANGE_RATES_CACHE
-- ============================================================
create table if not exists public.exchange_rates_cache (
  id         uuid primary key default gen_random_uuid(),
  base       text not null default 'USD',
  rates      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4. NEWS_CACHE
-- ============================================================
create table if not exists public.news_cache (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  url          text not null,
  source       text,
  description  text,
  image_url    text,
  published_at timestamptz,
  fetched_at   timestamptz not null default now()
);

create index if not exists idx_news_cache_published
  on public.news_cache (published_at desc);

-- ============================================================
-- 5. SUBSCRIBERS
-- ============================================================
create table if not exists public.subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  country_code  text not null,
  fuel_types    text[] not null default '{}',
  confirmed     boolean not null default false,
  created_at    timestamptz not null default now()
);

create unique index if not exists uq_subscribers_email
  on public.subscribers (email);

-- ============================================================
-- 6. COUNTRY_STATS
-- ============================================================
create table if not exists public.country_stats (
  id             uuid primary key default gen_random_uuid(),
  country_code   text not null unique,
  country_name   text not null,
  flag_emoji     text not null default '',
  currency_code  text not null default 'USD',
  currency_symbol text not null default '$',
  unit_default   text not null default 'litre'
);
alter table public.country_stats
  add constraint chk_unit_default check (unit_default in ('litre','gallon'));

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table public.prices_cache        enable row level security;
alter table public.price_history      enable row level security;
alter table public.exchange_rates_cache enable row level security;
alter table public.news_cache         enable row level security;
alter table public.subscribers        enable row level security;
alter table public.country_stats      enable row level security;

create policy "Allow public read prices_cache"
  on public.prices_cache for select
  using (true);

create policy "Allow service role write prices_cache"
  on public.prices_cache for all
  using (auth.role() = 'service_role');

create policy "Allow public read price_history"
  on public.price_history for select
  using (true);

create policy "Allow service role write price_history"
  on public.price_history for all
  using (auth.role() = 'service_role');

create policy "Allow public read exchange_rates_cache"
  on public.exchange_rates_cache for select
  using (true);

create policy "Allow service role write exchange_rates_cache"
  on public.exchange_rates_cache for all
  using (auth.role() = 'service_role');

create policy "Allow public read news_cache"
  on public.news_cache for select
  using (true);

create policy "Allow service role write news_cache"
  on public.news_cache for all
  using (auth.role() = 'service_role');

create policy "Allow public read country_stats"
  on public.country_stats for select
  using (true);

create policy "Allow service role write country_stats"
  on public.country_stats for all
  using (auth.role() = 'service_role');

create policy "Allow public insert subscribers"
  on public.subscribers for insert
  with check (true);

create policy "Allow service role read subscribers"
  on public.subscribers for select
  using (auth.role() = 'service_role');

create policy "Allow service role write subscribers"
  on public.subscribers for update
  using (auth.role() = 'service_role');
