-- Add style-guide columns to reference templates for reusable design directives.
alter table if exists public.reference_templates
  add column if not exists visual_guide text,
  add column if not exists headline_style text,
  add column if not exists sub_text_style text,
  add column if not exists cta_style text;

