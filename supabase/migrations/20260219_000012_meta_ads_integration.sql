-- Meta Ads integration tables for per-user OAuth connection and publish logs.

create extension if not exists pgcrypto;

create table if not exists public.user_meta_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meta_user_id text,
  access_token text not null,
  token_expires_at timestamptz,
  ad_account_id text,
  page_id text,
  instagram_actor_id text,
  default_link_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_meta_connections_updated_at
  on public.user_meta_connections(updated_at desc);

create table if not exists public.studio_meta_publishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.studio_projects(id) on delete set null,
  generation_id uuid not null references public.studio_generations(id) on delete cascade,
  campaign_id text,
  adset_id text,
  creative_id text,
  ad_id text,
  status text not null default 'FAILED',
  error_message text,
  request_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_studio_meta_publishes_user_created_at
  on public.studio_meta_publishes(user_id, created_at desc);

create index if not exists idx_studio_meta_publishes_generation
  on public.studio_meta_publishes(generation_id);

grant select, insert, update, delete
  on table public.user_meta_connections
  to authenticated;

grant select, insert
  on table public.studio_meta_publishes
  to authenticated;

alter table public.user_meta_connections enable row level security;
alter table public.studio_meta_publishes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_meta_connections'
      and policyname = 'user_meta_connections_owner_all'
  ) then
    create policy user_meta_connections_owner_all
      on public.user_meta_connections
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_meta_publishes'
      and policyname = 'studio_meta_publishes_owner_select_insert'
  ) then
    create policy studio_meta_publishes_owner_select_insert
      on public.studio_meta_publishes
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_meta_publishes'
      and policyname = 'studio_meta_publishes_owner_insert'
  ) then
    create policy studio_meta_publishes_owner_insert
      on public.studio_meta_publishes
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_user_meta_connections_touch_updated_at'
  ) then
    create trigger trg_user_meta_connections_touch_updated_at
      before update on public.user_meta_connections
      for each row
      execute function public.touch_updated_at();
  end if;
end
$$;
