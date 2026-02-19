-- Fix ambiguous column references in credit RPC functions.

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
