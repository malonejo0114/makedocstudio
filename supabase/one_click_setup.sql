-- One-click setup for AdGenius Pro
-- Run this entire file in Supabase SQL Editor.

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

-- Storage setup for AdGenius Pro assets.
-- Buckets:
-- - references: reference images for benchmarking/trending gallery
-- - products: product images uploaded by users

insert into storage.buckets (id, name, public)
values
  ('references', 'references', true),
  ('products', 'products', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_public_read_refs_products'
  ) then
    create policy storage_objects_public_read_refs_products
      on storage.objects
      for select
      using (bucket_id in ('references', 'products'));
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
      and policyname = 'storage_objects_auth_insert_refs_products'
  ) then
    create policy storage_objects_auth_insert_refs_products
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id in ('references', 'products'));
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
      and policyname = 'storage_objects_auth_update_refs_products'
  ) then
    create policy storage_objects_auth_update_refs_products
      on storage.objects
      for update
      to authenticated
      using (bucket_id in ('references', 'products'))
      with check (bucket_id in ('references', 'products'));
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
      and policyname = 'storage_objects_auth_delete_refs_products'
  ) then
    create policy storage_objects_auth_delete_refs_products
      on storage.objects
      for delete
      to authenticated
      using (bucket_id in ('references', 'products'));
  end if;
end
$$;

-- Add rich history columns for generations.

alter table public.generations
  add column if not exists scenario_desc text not null default '',
  add column if not exists output_mode text not null default 'image_with_text',
  add column if not exists width integer not null default 1080,
  add column if not exists height integer not null default 1080,
  add column if not exists visual_guide text not null default '',
  add column if not exists final_prompt text not null default '',
  add column if not exists model text not null default '',
  add column if not exists generated_image text not null default '',
  add column if not exists source_generation_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generations_source_generation_id_fkey'
  ) then
    alter table public.generations
      add constraint generations_source_generation_id_fkey
      foreign key (source_generation_id)
      references public.generations(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generations_output_mode_check'
  ) then
    alter table public.generations
      add constraint generations_output_mode_check
      check (output_mode in ('image_with_text', 'image_only'));
  end if;
end
$$;

create index if not exists idx_generations_source_generation_id
  on public.generations(source_generation_id);

-- Add style-guide columns for reference templates.
alter table if exists public.reference_templates
  add column if not exists visual_guide text,
  add column if not exists headline_style text,
  add column if not exists sub_text_style text,
  add column if not exists cta_style text;

-- Optional seed data (replace image_url values first)
-- Replace image_url values with your own CDN/storage URLs.
insert into public.reference_templates (category, image_url, description)
values
  ('뷰티', 'https://example.com/refs/beauty-01.jpg', '프리미엄 뷰티 제품 중심의 미니멀 하이엔드 톤'),
  ('뷰티', 'https://example.com/refs/beauty-02.jpg', '전후 비교형 구도와 클린 배경'),
  ('건기식', 'https://example.com/refs/health-01.jpg', '신뢰 강조형 의학적 무드와 성분 포인트'),
  ('건기식', 'https://example.com/refs/health-02.jpg', '효능 핵심문구 + 원료 클로즈업 구도'),
  ('리빙', 'https://example.com/refs/living-01.jpg', '라이프스타일 장면 중심의 자연광 연출'),
  ('리빙', 'https://example.com/refs/living-02.jpg', '문제-해결 메시지 구조의 전환형 레이아웃');
