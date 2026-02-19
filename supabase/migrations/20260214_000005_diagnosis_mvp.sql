-- MKDoc Diagnosis MVP schema
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- 1) Core entities
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  business_type text,
  operation_mode text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_stores_user_id
  on public.stores(user_id);

create table if not exists public.diagnosis_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  version int not null default 12,
  result_type text,
  scores_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_diagnosis_sessions_store_id
  on public.diagnosis_sessions(store_id);

create index if not exists idx_diagnosis_sessions_created_at
  on public.diagnosis_sessions(created_at desc);

create table if not exists public.diagnosis_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.diagnosis_sessions(id) on delete cascade,
  question_id text not null,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_diagnosis_answers_session_id
  on public.diagnosis_answers(session_id);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  session_id uuid references public.diagnosis_sessions(id) on delete set null,
  category text not null,
  file_url text not null,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_uploads_user_id
  on public.uploads(user_id);

create index if not exists idx_uploads_store_id
  on public.uploads(store_id);

create index if not exists idx_uploads_session_id
  on public.uploads(session_id);

-- 2) Commerce/ops entities
create table if not exists public.products (
  code text primary key,
  name text not null,
  pricing_type text not null default 'fixed',
  price int,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_products_created_at
  on public.products(created_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  amount int not null default 0,
  status text not null default 'pending',
  toss_payment_key text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_orders_user_id
  on public.orders(user_id);

create index if not exists idx_orders_created_at
  on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_code text not null references public.products(code) on delete restrict,
  qty int not null default 1,
  unit_price int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_order_items_order_id
  on public.order_items(order_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  assignee text,
  status text not null default 'todo',
  due_date date,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tasks_order_id
  on public.tasks(order_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  file_url text not null,
  summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_reports_order_id
  on public.reports(order_id);

-- 3) Phase-2 placeholders (social automation)
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_account_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_social_accounts_user_id
  on public.social_accounts(user_id);

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  content text not null,
  media_urls text[] not null default '{}'::text[],
  scheduled_at timestamptz,
  status text not null default 'draft',
  remote_post_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_scheduled_posts_user_id
  on public.scheduled_posts(user_id);

create index if not exists idx_scheduled_posts_scheduled_at
  on public.scheduled_posts(scheduled_at);

-- Grants
grant usage on schema public to anon, authenticated;

grant select on table public.products to anon, authenticated;

grant select, insert, update, delete on table public.stores to authenticated;
grant select, insert, update, delete on table public.diagnosis_sessions to authenticated;
grant select, insert, update, delete on table public.diagnosis_answers to authenticated;
grant select, insert, update, delete on table public.uploads to authenticated;
grant select, insert, update, delete on table public.orders to authenticated;
grant select, insert, update, delete on table public.order_items to authenticated;

grant select on table public.tasks to authenticated;
grant select on table public.reports to authenticated;

grant select, insert, update, delete on table public.social_accounts to authenticated;
grant select, insert, update, delete on table public.scheduled_posts to authenticated;

-- RLS
alter table public.stores enable row level security;
alter table public.diagnosis_sessions enable row level security;
alter table public.diagnosis_answers enable row level security;
alter table public.uploads enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tasks enable row level security;
alter table public.reports enable row level security;
alter table public.social_accounts enable row level security;
alter table public.scheduled_posts enable row level security;

-- Policies (owners)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stores' and policyname='stores_owner_all'
  ) then
    create policy stores_owner_all
      on public.stores
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='diagnosis_sessions' and policyname='diagnosis_sessions_owner_all'
  ) then
    create policy diagnosis_sessions_owner_all
      on public.diagnosis_sessions
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.stores s
          where s.id = diagnosis_sessions.store_id
            and s.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.stores s
          where s.id = diagnosis_sessions.store_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='diagnosis_answers' and policyname='diagnosis_answers_owner_all'
  ) then
    create policy diagnosis_answers_owner_all
      on public.diagnosis_answers
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.diagnosis_sessions ds
          join public.stores s on s.id = ds.store_id
          where ds.id = diagnosis_answers.session_id
            and s.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.diagnosis_sessions ds
          join public.stores s on s.id = ds.store_id
          where ds.id = diagnosis_answers.session_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='uploads' and policyname='uploads_owner_all'
  ) then
    create policy uploads_owner_all
      on public.uploads
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_select_public'
  ) then
    create policy products_select_public
      on public.products
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_owner_all'
  ) then
    create policy orders_owner_all
      on public.orders
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='order_items' and policyname='order_items_owner_all'
  ) then
    create policy order_items_owner_all
      on public.order_items
      for all
      to authenticated
      using (
        exists (
          select 1 from public.orders o
          where o.id = order_items.order_id
            and o.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.orders o
          where o.id = order_items.order_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='tasks_select_owner'
  ) then
    create policy tasks_select_owner
      on public.tasks
      for select
      to authenticated
      using (
        exists (
          select 1 from public.orders o
          where o.id = tasks.order_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_select_owner'
  ) then
    create policy reports_select_owner
      on public.reports
      for select
      to authenticated
      using (
        exists (
          select 1 from public.orders o
          where o.id = reports.order_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='social_accounts' and policyname='social_accounts_owner_all'
  ) then
    create policy social_accounts_owner_all
      on public.social_accounts
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='scheduled_posts' and policyname='scheduled_posts_owner_all'
  ) then
    create policy scheduled_posts_owner_all
      on public.scheduled_posts
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

