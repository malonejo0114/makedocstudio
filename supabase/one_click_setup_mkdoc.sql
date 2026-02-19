-- One-click setup for MKDoc (요식업 진단)
-- Run this entire file in Supabase SQL Editor.
-- Safe to run multiple times.

-- 1) Keyword net cache (optional, but recommended)
create extension if not exists pgcrypto;

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

-- 2) MKDoc diagnosis requests + report tables
create table if not exists public.diagnosis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'preview', -- preview | paid | report_ready
  place_raw_input text,
  place_resolved_json jsonb not null default '{}'::jsonb,
  answers_json jsonb not null default '{}'::jsonb,
  uploads_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_diagnosis_requests_user_id
  on public.diagnosis_requests(user_id);

create index if not exists idx_diagnosis_requests_created_at
  on public.diagnosis_requests(created_at desc);

create table if not exists public.keyword_metrics (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.diagnosis_requests(id) on delete cascade,
  keyword text not null,
  pc_volume int not null default 0,
  m_volume int not null default 0,
  pc_ctr numeric,
  m_ctr numeric,
  comp_idx text,
  est_bid_p1 int,
  est_bid_p2 int,
  est_bid_p3 int,
  est_bid_p4 int,
  est_bid_p5 int,
  cluster text,
  intent text,
  priority numeric,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_keyword_metrics_request_id
  on public.keyword_metrics(request_id);

create index if not exists idx_keyword_metrics_priority
  on public.keyword_metrics(priority desc);

create table if not exists public.mkdoc_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.diagnosis_requests(id) on delete cascade,
  total_score int not null default 0,
  axis_scores_json jsonb not null default '{}'::jsonb,
  main_type text,
  sub_tags_json jsonb not null default '[]'::jsonb,
  report_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_mkdoc_reports_created_at
  on public.mkdoc_reports(created_at desc);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.mkdoc_reports(id) on delete cascade,
  primary_products_json jsonb not null default '[]'::jsonb,
  optional_products_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_recommendations_report_id
  on public.recommendations(report_id);

-- RLS
alter table public.diagnosis_requests enable row level security;
alter table public.keyword_metrics enable row level security;
alter table public.mkdoc_reports enable row level security;
alter table public.recommendations enable row level security;

-- Policies (owners)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='diagnosis_requests' and policyname='diagnosis_requests_owner_all'
  ) then
    create policy diagnosis_requests_owner_all
      on public.diagnosis_requests
      for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='keyword_metrics' and policyname='keyword_metrics_owner_select'
  ) then
    create policy keyword_metrics_owner_select
      on public.keyword_metrics
      for select
      to authenticated
      using (
        exists (
          select 1 from public.diagnosis_requests dr
          where dr.id = keyword_metrics.request_id and dr.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='mkdoc_reports' and policyname='mkdoc_reports_owner_select'
  ) then
    create policy mkdoc_reports_owner_select
      on public.mkdoc_reports
      for select
      to authenticated
      using (
        exists (
          select 1 from public.diagnosis_requests dr
          where dr.id = mkdoc_reports.request_id and dr.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='recommendations' and policyname='recommendations_owner_select'
  ) then
    create policy recommendations_owner_select
      on public.recommendations
      for select
      to authenticated
      using (
        exists (
          select 1 from public.mkdoc_reports mr
          join public.diagnosis_requests dr on dr.id = mr.request_id
          where mr.id = recommendations.report_id and dr.user_id = auth.uid()
        )
      );
  end if;
end
$$;

-- Trigger to update updated_at
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'mkdoc_touch_updated_at'
  ) then
    create function public.mkdoc_touch_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = timezone('utc', now());
      return new;
    end;
    $fn$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_diagnosis_requests_touch'
  ) then
    create trigger trg_diagnosis_requests_touch
      before update on public.diagnosis_requests
      for each row execute function public.mkdoc_touch_updated_at();
  end if;
end
$$;

-- 3) Storage bucket for MKDoc uploads
insert into storage.buckets (id, name, public)
values
  ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_public_read_store_assets'
  ) then
    create policy storage_objects_public_read_store_assets
      on storage.objects
      for select
      using (bucket_id in ('store-assets'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_auth_insert_store_assets'
  ) then
    create policy storage_objects_auth_insert_store_assets
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id in ('store-assets'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_auth_update_store_assets'
  ) then
    create policy storage_objects_auth_update_store_assets
      on storage.objects
      for update
      to authenticated
      using (bucket_id in ('store-assets'))
      with check (bucket_id in ('store-assets'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_auth_delete_store_assets'
  ) then
    create policy storage_objects_auth_delete_store_assets
      on storage.objects
      for delete
      to authenticated
      using (bucket_id in ('store-assets'));
  end if;
end
$$;

