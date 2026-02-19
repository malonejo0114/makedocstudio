-- Add optional analysis_json payload to templates for instant layout application in Studio.
alter table if exists public.templates
  add column if not exists analysis_json jsonb;

