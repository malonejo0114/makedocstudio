-- Admin-managed SEO runtime settings
-- Stores global meta/verification/script settings editable in /admin.

create table if not exists public.seo_settings (
  id text primary key default 'global',
  site_name text not null default 'MakeDoc Studio',
  default_title text not null default 'MakeDoc Studio',
  description text not null default 'AI ad creative studio for reference analysis, prompt editing, and image generation.',
  robots text not null default 'index,follow',
  canonical_base_url text,
  og_image_url text,
  google_site_verification text,
  naver_site_verification text,
  additional_meta_tags jsonb not null default '[]'::jsonb,
  head_script_urls jsonb not null default '[]'::jsonb,
  head_inline_script text,
  body_start_script_urls jsonb not null default '[]'::jsonb,
  body_start_inline_script text,
  body_end_script_urls jsonb not null default '[]'::jsonb,
  body_end_inline_script text,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.seo_settings_touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$fn$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_seo_settings_touch_updated_at'
  ) then
    create trigger trg_seo_settings_touch_updated_at
      before update on public.seo_settings
      for each row execute function public.seo_settings_touch_updated_at();
  end if;
end
$$;

insert into public.seo_settings (id)
values ('global')
on conflict (id) do nothing;

