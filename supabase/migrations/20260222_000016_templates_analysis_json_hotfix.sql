-- Ensure templates.analysis_json exists for admin template save/update APIs.
alter table if exists public.templates
  add column if not exists analysis_json jsonb;

-- Trigger PostgREST schema cache refresh.
notify pgrst, 'reload schema';
