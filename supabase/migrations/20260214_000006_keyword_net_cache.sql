-- MKDoc keyword net cache (Naver Local + SearchAd)
-- Server-only cache table. Service role bypasses RLS.

create table if not exists public.keyword_net_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_keyword_net_cache_key
  on public.keyword_net_cache(cache_key);

create index if not exists idx_keyword_net_cache_created_at
  on public.keyword_net_cache(created_at desc);

alter table public.keyword_net_cache enable row level security;

