# MKDoc Engineering Notes (Agents)

## Prompt Library (MUST CHECK IN)

Prompts are the single source of truth and must live under:

- `/prompts/background_only.md`
- `/prompts/full_creative.md`
- `/prompts/README.md`

Rules:

- Do not hardcode long prompt bodies inside TypeScript files.
- `lib/*prompt*.ts` must load templates from `/prompts` and inject variables.
- When prompts change, record a short change note (date + summary) in the prompt file header.

## Safety / Watermark

- Generated images may include SynthID watermarks (not necessarily visible).
- Do NOT implement any "watermark removal" feature.
- Prompts may forbid visual watermarks, logos, signatures, app UI, random text.

