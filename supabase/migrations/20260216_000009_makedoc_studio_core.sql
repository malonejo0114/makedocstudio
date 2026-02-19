-- MakeDoc Studio core schema
-- Adds studio projects/prompts/generations, model-based credits, template library,
-- and storage bucket for generated assets.

create extension if not exists pgcrypto;

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '새 프로젝트',
  reference_image_url text not null,
  product_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_studio_projects_user_id
  on public.studio_projects(user_id);

create index if not exists idx_studio_projects_created_at
  on public.studio_projects(created_at desc);

create table if not exists public.studio_reference_analysis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  analysis_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_studio_reference_analysis_project_id
  on public.studio_reference_analysis(project_id);

create index if not exists idx_studio_reference_analysis_created_at
  on public.studio_reference_analysis(created_at desc);

create table if not exists public.studio_prompts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  role text not null,
  title text not null,
  copy_json jsonb not null default '{}'::jsonb,
  visual_json jsonb not null default '{}'::jsonb,
  generation_hints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'studio_prompts_role_check'
  ) then
    alter table public.studio_prompts
      add constraint studio_prompts_role_check
      check (role in ('PLANNER', 'MARKETER', 'DESIGNER'));
  end if;
end
$$;

create index if not exists idx_studio_prompts_project_id
  on public.studio_prompts(project_id);

create index if not exists idx_studio_prompts_role
  on public.studio_prompts(role);

create table if not exists public.studio_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  prompt_id uuid not null references public.studio_prompts(id) on delete cascade,
  image_model_id text not null,
  image_url text not null,
  aspect_ratio text not null,
  cost_usd numeric(12, 6) not null default 0,
  cost_krw integer not null default 0,
  sell_krw integer not null default 0,
  text_fidelity_score integer,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'studio_generations_text_fidelity_score_check'
  ) then
    alter table public.studio_generations
      add constraint studio_generations_text_fidelity_score_check
      check (text_fidelity_score is null or (text_fidelity_score >= 0 and text_fidelity_score <= 100));
  end if;
end
$$;

create index if not exists idx_studio_generations_user_id
  on public.studio_generations(user_id);

create index if not exists idx_studio_generations_project_id
  on public.studio_generations(project_id);

create index if not exists idx_studio_generations_prompt_id
  on public.studio_generations(prompt_id);

create index if not exists idx_studio_generations_model_created_at
  on public.studio_generations(image_model_id, created_at desc);

create table if not exists public.user_model_credits (
  user_id uuid not null references auth.users(id) on delete cascade,
  image_model_id text not null,
  balance integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, image_model_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_model_credits_balance_check'
  ) then
    alter table public.user_model_credits
      add constraint user_model_credits_balance_check
      check (balance >= 0);
  end if;
end
$$;

create index if not exists idx_user_model_credits_user_id
  on public.user_model_credits(user_id);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_model_id text not null,
  delta integer not null,
  reason text not null,
  ref_id uuid,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'credit_ledger_reason_check'
  ) then
    alter table public.credit_ledger
      add constraint credit_ledger_reason_check
      check (reason in ('PURCHASE', 'GENERATE', 'REFUND', 'ADMIN'));
  end if;
end
$$;

create index if not exists idx_credit_ledger_user_created_at
  on public.credit_ledger(user_id, created_at desc);

create index if not exists idx_credit_ledger_model_created_at
  on public.credit_ledger(image_model_id, created_at desc);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tags text[] not null default '{}'::text[],
  image_url text not null,
  is_featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_templates_featured
  on public.templates(is_featured, created_at desc);

create index if not exists idx_templates_tags
  on public.templates using gin (tags);

-- shared updated_at trigger
create or replace function public.studio_touch_updated_at()
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
    select 1 from pg_trigger where tgname = 'trg_studio_prompts_touch_updated_at'
  ) then
    create trigger trg_studio_prompts_touch_updated_at
      before update on public.studio_prompts
      for each row execute function public.studio_touch_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_user_model_credits_touch_updated_at'
  ) then
    create trigger trg_user_model_credits_touch_updated_at
      before update on public.user_model_credits
      for each row execute function public.studio_touch_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_templates_touch_updated_at'
  ) then
    create trigger trg_templates_touch_updated_at
      before update on public.templates
      for each row execute function public.studio_touch_updated_at();
  end if;
end
$$;

-- Atomic credit consumption: deduct 1 if possible, and always write ledger.
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
  from public.user_model_credits c
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

  update public.user_model_credits
  set balance = balance - 1,
      updated_at = timezone('utc', now())
  where user_id = p_user_id
    and image_model_id = p_image_model_id
  returning user_model_credits.balance into v_balance;

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

-- Generic credit top-up/refund helper.
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

  update public.user_model_credits
  set balance = greatest(balance + p_delta, 0),
      updated_at = timezone('utc', now())
  where user_id = p_user_id
    and image_model_id = p_image_model_id
  returning user_model_credits.balance into v_balance;

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

grant usage on schema public to anon, authenticated;

grant select on table public.templates to anon, authenticated;
grant select, insert, update, delete on table public.studio_projects to authenticated;
grant select, insert, update, delete on table public.studio_reference_analysis to authenticated;
grant select, insert, update, delete on table public.studio_prompts to authenticated;
grant select, insert, update, delete on table public.studio_generations to authenticated;
grant select, insert, update, delete on table public.user_model_credits to authenticated;
grant select on table public.credit_ledger to authenticated;

grant execute on function public.studio_consume_credit(uuid, text, uuid) to authenticated;
grant execute on function public.studio_add_credit(uuid, text, integer, text, uuid) to authenticated;

alter table public.studio_projects enable row level security;
alter table public.studio_reference_analysis enable row level security;
alter table public.studio_prompts enable row level security;
alter table public.studio_generations enable row level security;
alter table public.user_model_credits enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_projects'
      and policyname = 'studio_projects_owner_all'
  ) then
    create policy studio_projects_owner_all
      on public.studio_projects
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
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_reference_analysis'
      and policyname = 'studio_reference_analysis_owner_all'
  ) then
    create policy studio_reference_analysis_owner_all
      on public.studio_reference_analysis
      for all
      to authenticated
      using (
        exists (
          select 1 from public.studio_projects p
          where p.id = studio_reference_analysis.project_id
            and p.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.studio_projects p
          where p.id = studio_reference_analysis.project_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_prompts'
      and policyname = 'studio_prompts_owner_all'
  ) then
    create policy studio_prompts_owner_all
      on public.studio_prompts
      for all
      to authenticated
      using (
        exists (
          select 1 from public.studio_projects p
          where p.id = studio_prompts.project_id
            and p.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.studio_projects p
          where p.id = studio_prompts.project_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_generations'
      and policyname = 'studio_generations_owner_all'
  ) then
    create policy studio_generations_owner_all
      on public.studio_generations
      for all
      to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.studio_projects p
          where p.id = studio_generations.project_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_model_credits'
      and policyname = 'user_model_credits_owner_all'
  ) then
    create policy user_model_credits_owner_all
      on public.user_model_credits
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
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'credit_ledger'
      and policyname = 'credit_ledger_owner_select'
  ) then
    create policy credit_ledger_owner_select
      on public.credit_ledger
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'templates'
      and policyname = 'templates_public_read'
  ) then
    create policy templates_public_read
      on public.templates
      for select
      using (true);
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_public_read_studio_assets'
  ) then
    create policy storage_objects_public_read_studio_assets
      on storage.objects
      for select
      using (bucket_id = 'studio-assets');
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
      and policyname = 'storage_objects_auth_insert_studio_assets'
  ) then
    create policy storage_objects_auth_insert_studio_assets
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'studio-assets');
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
      and policyname = 'storage_objects_auth_update_studio_assets'
  ) then
    create policy storage_objects_auth_update_studio_assets
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'studio-assets')
      with check (bucket_id = 'studio-assets');
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
      and policyname = 'storage_objects_auth_delete_studio_assets'
  ) then
    create policy storage_objects_auth_delete_studio_assets
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'studio-assets');
  end if;
end
$$;
