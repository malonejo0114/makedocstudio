# MakeDoc Studio Handoff

## Repo
- GitHub: https://github.com/malonejo0114/makedocstudio
- Local: /Users/johanjin/Documents/마케닥_광고소재
- Current branch: `main`

## Run
```bash
cd /Users/johanjin/Documents/마케닥_광고소재
npm install
npm run dev
# http://localhost:3000
```

## Core env (required)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `USD_KRW_RATE` (default 1442)

## What is implemented (important)
1. Studio analyze flow with modal:
- "분석 중입니다" popup + estimated time + elapsed seconds
- File: `components/studio-ui/StudioWorkbench.tsx`

2. Missing input supplementation:
- "입력 보강 필요" fields editable
- Buttons: `다시 분석하기` / `그냥 진행하기`
- Reanalyze sends extra context to API

3. Analysis credit policy:
- reference analysis = 1 credit charged
- card-news planning analysis = 1 credit charged
- If user clicks supplemental reanalyze with filled supplementation: free
- On supplemental reanalyze response: missing-input warnings suppressed
- Files:
  - `app/api/studio/reference/analyze/route.ts`
  - `app/api/studio/cardnews/plan/route.ts`

4. Prompt warnings UX:
- Warnings moved to selected role prompt card area
- Global top warning box removed
- Prompt edit status badge added (`수정됨`, `수정되었습니다`, `저장 완료되었습니다`)

5. Admin prompt lab:
- Prompt file editor + test runner in admin
- APIs:
  - `/api/admin/prompts`
  - `/api/admin/prompt-lab`

6. Admin model tier manager:
- User-facing model labels are fixed to 2 tiers: `기본`, `상위버전`
- Actual runtime AI model mapping is configurable in admin
- APIs/files:
  - `/api/admin/model-tiers`
  - `components/studio-ui/AdminModelTierManager.tsx`
  - `lib/studio/modelTiers.ts`

7. Admin SEO manager:
- Meta title/description/robots/canonical/OG, search console verification,
  extra meta tags, head/body script injection managed in admin
- APIs/files:
  - `/api/admin/seo-settings`
  - `components/studio-ui/AdminSeoManager.tsx`
  - `lib/seo/settings.ts`

## Prompt SOT
- `/prompts` directory is source of truth
- Main files in use:
  - `reference_to_triple_prompts.md`
  - `no_ref_concept_v2.md`
  - `style_fusion_v2.md`
  - `ref_text_replace_v2.md`
  - `creative_background_v3.md`

## Current business rules
- Image generation uses unified KRW credit bucket (`KRW_100_CREDIT`)
- 1 credit = 100 KRW
- Signup initial credits = 10
- Reference analysis = 1 credit
- Card-news planning analysis = 1 credit
- Image generation = Basic 2 credits / Advanced 3 credits
- Public model UI exposes only 2 tiers; real model ids are admin-mapped

## Required migration (latest)
- Apply:
  - `supabase/migrations/20260222_000015_runtime_hotfixes.sql`
- This migration adds:
  - two-tier model mapping fix (`basic`, `advanced`)
  - `prompt_overrides` table for Vercel runtime prompt editing
  - `seo_settings` bootstrap table (if missing)
  - credit RPC ambiguity fix + signup bonus trigger safety

## Suggested next tasks
1. Card-news generator module (4~8 slides, template-based)
2. Meta Ads upload flow hardening (draft -> review -> publish)
3. Billing (Toss) production wiring
4. Analysis usage dashboard (token/cost telemetry)

## Continue prompt for any web AI/coding tool
"Read HANDOFF.md first, then continue implementing from current main branch without removing existing Studio behavior."
