# AdGenius Pro Runbook

## 1) Environment

Create `.env.local` from `.env.example` and set real values.

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) (for `/api/admin/*` upload/sync/template update)
- `GEMINI_API_KEY`
- `ADMIN_PASSWORD` (for `/admin` access)

Optional:
- `GEMINI_TEXT_MODEL`
- `GEMINI_IMAGE_MODELS`
- `GEMINI_TIMEOUT_MS` (default `45000`)
- `ADMIN_AUTH_SECRET`
- (Diagnosis keyword net) `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- (Diagnosis keyword net) `NAVER_SEARCHAD_ACCESS_LICENSE`, `NAVER_SEARCHAD_SECRET_KEY`, `NAVER_SEARCHAD_CUSTOMER_ID`
- (MKDoc checkout) `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`

## 2) Supabase SQL Apply Order

Run in Supabase SQL editor:

1. `supabase/migrations/20260213_000001_adgenius_init.sql`
2. `supabase/migrations/20260213_000002_storage_buckets.sql`
3. `supabase/migrations/20260213_000003_generations_history_columns.sql`
4. `supabase/migrations/20260213_000004_reference_templates_style_columns.sql`
5. `supabase/seed/reference_templates.sample.sql` (after replacing sample URLs)
6. `supabase/migrations/20260214_000005_diagnosis_mvp.sql` (요식업 진단/주문/온보딩/자동화 확장용)
7. `supabase/migrations/20260214_000006_keyword_net_cache.sql` (키워드 그물망 캐시)
8. `supabase/migrations/20260214_000007_makedoc_diagnosis_requests.sql` (진단 요청/키워드 메트릭/리포트)
9. `supabase/migrations/20260214_000008_store_assets_bucket.sql` (진단용 업로드 버킷)

## 3) Local Validation Helpers

- `node scripts/check-env.mjs`
- `node scripts/case-matrix.mjs`
- `npm run dev` then open `http://localhost:3000`
- If style/layout breaks or chunk module errors appear, run:
  `npm run dev:reset`

Quick manual flow:
1. Generate one ad on `/`
2. Download image from result card
3. Open `/history` and confirm record exists
4. Click regenerate for records with prompt data

Admin template flow:
1. Open `/admin`
0. If redirected, login at `/admin/login`
2. Upload reference image
3. Save visual guide + headline/sub/cta style guides
4. Go back to `/`, pick that reference in "추천 레퍼런스"
5. Enter product/text and generate (template style guides are auto-injected)

Note:
- Post-edit canvas is temporarily paused in UI (to be re-enabled later).
- Dev and build now use separate output dirs (`.next-dev`, `.next-build`) to avoid chunk collisions.
- `POST /api/generate` is rate-limited (12 req / 60s per IP in app memory).

## 4) Quick API Checks

### Analyze API
- Endpoint: `POST /api/analyze`
- FormData:
  - `referenceImage` (File) or `referenceImageUrl` (string)

### Generate API
- Endpoint: `POST /api/generate`
- FormData:
  - optional `referenceImage` (File)
  - optional `referenceImageUrl` (string)
  - optional `productImage` (File)
  - `textMode` (`auto` | `custom`)
  - optional `headline`, `subText`, `cta` (for `custom`)
  - optional `width`, `height`
  - optional `usedReferenceId`

Response includes:
- `scenario`, `scenarioDesc`
- `model`
- `generatedImage` (data URL)

### Keyword Net API (Diagnosis)
- Endpoint: `POST /api/diagnosis/keyword-net`
- JSON:
  - `storeName`, `area`, `bizType` (required)
  - `placeUrl`, `device`, `selectedPlaceLink` (optional)

## 5) Production Prompt Replacement

Replace placeholder prompts in:
- `lib/prompts.ts`

Use your full benchmark and generation prompt texts, preserving slots:
- `{{WIDTH}}`
- `{{HEIGHT}}`
- `{{VISUAL_GUIDE}}`
- `{{HEADLINE}}`
- `{{SUB_TEXT}}`
- `{{CTA}}`
