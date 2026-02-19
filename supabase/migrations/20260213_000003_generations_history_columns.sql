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
