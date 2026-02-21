-- Runtime hotfixes for production:
-- 1) Two-tier model mapping (basic / advanced)
-- 2) Prompt override persistence table (for read-only serverless filesystem)
-- 3) SEO settings table bootstrap
-- 4) Credit RPC ambiguity fix (studio_add_credit / studio_consume_credit)

-- ------------------------------------------------------------
-- 1) Model tiers (basic/advanced only)
-- ------------------------------------------------------------
create table if not exists public.studio_model_tier_settings (
  tier_id text primary key,
  display_name text not null,
  image_model_id text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Remove legacy tier rows before tightening constraint.
delete from public.studio_model_tier_settings
where tier_id not in ('basic', 'advanced');

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'studio_model_tier_settings_tier_id_check'
  ) then
    alter table public.studio_model_tier_settings
      drop constraint studio_model_tier_settings_tier_id_check;
  end if;

  alter table public.studio_model_tier_settings
    add constraint studio_model_tier_settings_tier_id_check
    check (tier_id in ('basic', 'advanced'));
exception
  when duplicate_object then
    null;
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

insert into public.studio_model_tier_settings (tier_id, display_name, image_model_id)
values
  ('basic', '기본', 'imagen-4.0-fast-generate-001'),
  ('advanced', '상위버전', 'imagen-4.0-generate-001')
on conflict (tier_id) do update
set
  display_name = excluded.display_name,
  image_model_id = excluded.image_model_id;

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

-- ------------------------------------------------------------
-- 2) Prompt overrides (DB-backed prompt editing)
-- ------------------------------------------------------------
create table if not exists public.prompt_overrides (
  filename text primary key,
  content text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.prompt_overrides_touch_updated_at()
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
    select 1 from pg_trigger where tgname = 'trg_prompt_overrides_touch_updated_at'
  ) then
    create trigger trg_prompt_overrides_touch_updated_at
      before update on public.prompt_overrides
      for each row execute function public.prompt_overrides_touch_updated_at();
  end if;
end
$$;

grant select, insert, update, delete on table public.prompt_overrides to authenticated;
grant select, insert, update, delete on table public.prompt_overrides to service_role;

-- ------------------------------------------------------------
-- 3) SEO settings bootstrap
-- ------------------------------------------------------------
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

grant select, insert, update, delete on table public.seo_settings to authenticated;
grant select, insert, update, delete on table public.seo_settings to service_role;

-- ------------------------------------------------------------
-- 4) Credit function ambiguity fix
-- ------------------------------------------------------------
create or replace function public.studio_consume_credit(
  p_user_id uuid,
  p_image_model_id text,
  p_ref_id uuid default null
)
returns table (
  ok boolean,
  balance integer,
  error text,
  ledger_id uuid
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_balance integer;
  v_ledger_id uuid;
begin
  insert into public.user_model_credits (user_id, image_model_id, balance)
  values (p_user_id, p_image_model_id, 0)
  on conflict (user_id, image_model_id) do nothing;

  select c.balance
    into v_balance
  from public.user_model_credits as c
  where c.user_id = p_user_id
    and c.image_model_id = p_image_model_id
  for update;

  if coalesce(v_balance, 0) < 1 then
    insert into public.credit_ledger (
      user_id,
      image_model_id,
      delta,
      reason,
      ref_id,
      meta_json
    ) values (
      p_user_id,
      p_image_model_id,
      0,
      'GENERATE',
      p_ref_id,
      jsonb_build_object('status', 'insufficient')
    )
    returning id into v_ledger_id;

    return query select false, coalesce(v_balance, 0), 'INSUFFICIENT_CREDIT', v_ledger_id;
    return;
  end if;

  update public.user_model_credits as c
  set balance = c.balance - 1,
      updated_at = timezone('utc', now())
  where c.user_id = p_user_id
    and c.image_model_id = p_image_model_id
  returning c.balance into v_balance;

  insert into public.credit_ledger (
    user_id,
    image_model_id,
    delta,
    reason,
    ref_id,
    meta_json
  ) values (
    p_user_id,
    p_image_model_id,
    -1,
    'GENERATE',
    p_ref_id,
    '{}'::jsonb
  )
  returning id into v_ledger_id;

  return query select true, v_balance, null::text, v_ledger_id;
end;
$fn$;

create or replace function public.studio_add_credit(
  p_user_id uuid,
  p_image_model_id text,
  p_delta integer,
  p_reason text,
  p_ref_id uuid default null
)
returns table (
  balance integer,
  ledger_id uuid
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_balance integer;
  v_ledger_id uuid;
begin
  if p_delta = 0 then
    raise exception 'p_delta must not be 0';
  end if;

  if p_reason not in ('PURCHASE', 'GENERATE', 'REFUND', 'ADMIN') then
    raise exception 'invalid reason: %', p_reason;
  end if;

  insert into public.user_model_credits (user_id, image_model_id, balance)
  values (p_user_id, p_image_model_id, 0)
  on conflict (user_id, image_model_id) do nothing;

  update public.user_model_credits as c
  set balance = greatest(c.balance + p_delta, 0),
      updated_at = timezone('utc', now())
  where c.user_id = p_user_id
    and c.image_model_id = p_image_model_id
  returning c.balance into v_balance;

  insert into public.credit_ledger (
    user_id,
    image_model_id,
    delta,
    reason,
    ref_id,
    meta_json
  ) values (
    p_user_id,
    p_image_model_id,
    p_delta,
    p_reason,
    p_ref_id,
    '{}'::jsonb
  )
  returning id into v_ledger_id;

  return query select v_balance, v_ledger_id;
end;
$fn$;

grant execute on function public.studio_consume_credit(uuid, text, uuid) to authenticated;
grant execute on function public.studio_consume_credit(uuid, text, uuid) to service_role;
grant execute on function public.studio_add_credit(uuid, text, integer, text, uuid) to authenticated;
grant execute on function public.studio_add_credit(uuid, text, integer, text, uuid) to service_role;
