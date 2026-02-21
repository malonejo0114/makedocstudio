-- User-facing model tier mapping + signup credit bonus.
-- - studio_model_tier_settings: basic/advanced -> runtime model id mapping
-- - auth.users trigger: grants 10 unified credits on first signup

create table if not exists public.studio_model_tier_settings (
  tier_id text primary key,
  display_name text not null,
  image_model_id text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

delete from public.studio_model_tier_settings
where tier_id not in ('basic', 'advanced');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'studio_model_tier_settings_tier_id_check'
  ) then
    alter table public.studio_model_tier_settings
      add constraint studio_model_tier_settings_tier_id_check
      check (tier_id in ('basic', 'advanced'));
  end if;
end
$$;

create or replace function public.studio_model_tier_settings_touch_updated_at()
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
    select 1 from pg_trigger where tgname = 'trg_studio_model_tier_settings_touch_updated_at'
  ) then
    create trigger trg_studio_model_tier_settings_touch_updated_at
      before update on public.studio_model_tier_settings
      for each row execute function public.studio_model_tier_settings_touch_updated_at();
  end if;
end
$$;

delete from public.studio_model_tier_settings
where tier_id = 'premium';

insert into public.studio_model_tier_settings (tier_id, display_name, image_model_id)
values
  ('basic', '기본', 'imagen-4.0-fast-generate-001'),
  ('advanced', '상위버전', 'imagen-4.0-generate-001')
on conflict (tier_id) do nothing;

create or replace function public.studio_grant_signup_initial_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.user_model_credits (user_id, image_model_id, balance)
  values (new.id, 'KRW_100_CREDIT', 10)
  on conflict (user_id, image_model_id) do nothing;

  insert into public.credit_ledger (
    user_id,
    image_model_id,
    delta,
    reason,
    ref_id,
    meta_json
  ) values (
    new.id,
    'KRW_100_CREDIT',
    10,
    'ADMIN',
    null,
    jsonb_build_object('source', 'signup_bonus', 'policy', 'initial_10_credits')
  );

  return new;
exception
  when others then
    return new;
end;
$fn$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_auth_users_signup_initial_credits'
  ) then
    create trigger trg_auth_users_signup_initial_credits
      after insert on auth.users
      for each row execute function public.studio_grant_signup_initial_credits();
  end if;
end
$$;
