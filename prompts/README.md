# Prompt Library (Single Source of Truth)

This folder contains prompt templates used by MakeDoc Studio generation and analysis.

## Files

- `background_only.md`
  - Purpose: Generate a clean background only. The model must not render any text.

- `full_creative.md`
  - Purpose: Generate the full creative including exact text rendering inside locked layout boxes.

- `studio_analysis_and_prompts.md`
  - Purpose: Analyze one reference image and produce structured analysis + three role-based prompt drafts.

- `studio_image_generation.md`
  - Purpose: Build the final single-image generation prompt by combining analysis, prompt blocks, text mode, and ratio.

- `style_fusion_v2.md`
  - Purpose: Generate with reference style/layout preservation + new copy replacement (typography lock).

- `ref_text_replace_v2.md`
  - Purpose: Edit reference-like poster by changing copy only while keeping style/composition fixed.

- `studio_direct_generation.md`
  - Purpose: Build the final single-image generation prompt from direct user inputs (without reference analysis).

- `cardnews_plan_v1.md`
  - Purpose: Generate a slide-by-slide card-news plan (story flow + copy + visual directions).

- `reference_analysis_v4.md`
  - Purpose: Analyze reference and output stronger typography/style-transfer-ready structured JSON.

- `reference_to_triple_prompts.md`
  - Purpose: Produce reference evidence + role-specific decision package + execution prompt + validation checklist in one JSON.

- `no_ref_concept_v2.md`
  - Purpose: Generate 3-direction concepts + template recommendations when no reference is provided.

## Variables

Templates use `{{VAR}}` placeholders.

### Legacy variables (`background_only.md`, `full_creative.md`)

- `VISUAL_GUIDE`, `ASPECT_RATIO`, `WIDTH`, `HEIGHT`
- `MAIN_HEADLINE`, `SUB_TEXT`, `CTA_TEXT`, `BADGE_TEXT`, `LEGAL_TEXT`
- `HEADLINE_BOX`, `SUBTEXT_BOX`, `CTA_BOX`, `BADGE_BOX`, `LEGAL_BOX`
- `HEADLINE_MAX_LINES`, `SUB_MAX_LINES`, `BADGE_MAX_LINES`, `LEGAL_MAX_LINES`

### Studio variables (`studio_analysis_and_prompts.md`, `studio_image_generation.md`)

- `PRODUCT_CONTEXT_JSON`
- `REFERENCE_ANALYSIS`
- `PROMPT_ROLE`, `PROMPT_TITLE`
- `HEADLINE`, `SUBHEAD`, `CTA`, `BADGES`
- `SCENE`, `COMPOSITION`, `STYLE`, `LIGHTING`, `COLOR_PALETTE_HINT`
- `ASPECT_RATIO`, `TEXT_MODE`, `PRODUCT_CONTEXT`, `NEGATIVE`

### Style fusion / retext variables (`style_fusion_v2.md`, `ref_text_replace_v2.md`)

- `VISUAL_GUIDE`, `TYPOGRAPHY_HINT`
- `MAIN_HEADLINE`, `SUB_TEXT`, `CTA_TEXT`, `BADGES`
- `ASPECT_RATIO`, `TEXT_ACCURACY_MODE`
- `PRODUCT_CONTEXT`, `NEGATIVE`

### Studio direct variables (`studio_direct_generation.md`)

- `DIRECT_VISUAL`
- `HEADLINE`, `SUBHEAD`, `CTA`
- `EXTRA_TEXTS`
- `PRODUCT_CONTEXT`
- `ASPECT_RATIO`, `TEXT_MODE`, `NEGATIVE`

## Versioning rule

If you change any prompt:

1. Update the relevant `.md` file in this folder.
2. Add a short change note to the top of the changed prompt file (date + summary).
3. Keep `lib/*prompt*.ts` free of hardcoded prompt bodies; it should only load templates from `/prompts` and inject variables.
