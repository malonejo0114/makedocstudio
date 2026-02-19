-- AdGenius Pro core schema additions
-- Safe to run on fresh DB and on partially existing DB objects.

create extension if not exists pgcrypto;

create table if not exists public.reference_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  image_url text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  used_reference_id uuid,
  scenario text not null default 'CASE_8_NOREF_NOPROD_AUTO',
  text_mode text not null default 'auto',
  headline text not null default '',
  sub_text text not null default '',
  cta text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.generations
  add column if not exists used_reference_id uuid,
  add column if not exists scenario text not null default 'CASE_8_NOREF_NOPROD_AUTO',
  add column if not exists text_mode text not null default 'auto',
  add column if not exists headline text not null default '',
  add column if not exists sub_text text not null default '',
  add column if not exists cta text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generations_used_reference_id_fkey'
  ) then
    alter table public.generations
      add constraint generations_used_reference_id_fkey
      foreign key (used_reference_id)
      references public.reference_templates(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generations_text_mode_check'
  ) then
    alter table public.generations
      add constraint generations_text_mode_check
      check (text_mode in ('auto', 'custom'));
  end if;
end
$$;

create index if not exists idx_reference_templates_category
  on public.reference_templates(category);

create index if not exists idx_reference_templates_created_at
  on public.reference_templates(created_at desc);

create index if not exists idx_generations_used_reference_id
  on public.generations(used_reference_id);

create index if not exists idx_generations_created_at
  on public.generations(created_at desc);

grant usage on schema public to anon, authenticated;
grant select on table public.reference_templates to anon, authenticated;
grant select, insert on table public.generations to anon, authenticated;

alter table public.reference_templates enable row level security;
alter table public.generations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_templates'
      and policyname = 'reference_templates_select_public'
  ) then
    create policy reference_templates_select_public
      on public.reference_templates
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_templates'
      and policyname = 'reference_templates_write_authenticated'
  ) then
    create policy reference_templates_write_authenticated
      on public.reference_templates
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'generations'
      and policyname = 'generations_insert_public'
  ) then
    drop policy generations_insert_public on public.generations;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'generations'
      and policyname = 'generations_insert_public'
  ) then
    create policy generations_insert_public
      on public.generations
      for insert
      to anon, authenticated
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'generations'
      and policyname = 'generations_select_authenticated'
  ) then
    create policy generations_select_authenticated
      on public.generations
      for select
      to authenticated
      using (true);
  end if;
end
$$;
