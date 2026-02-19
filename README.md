# MKDoc (마케닥) – Nano Banana Ad Creative Studio

Next.js 14 + TypeScript + Tailwind 기반의 광고 소재 생성 스튜디오입니다.

핵심 기능:

- 레퍼런스 이미지(선택) + 비주얼 가이드 + 카피(헤드/서브/CTA)로 광고 이미지 생성
- 생성 전에 **레이아웃 편집 모달**에서 박스(HEADLINE/SUB/CTA)를 드래그/리사이즈
- **Guide Overlay PNG(투명)** + **Layout JSON(정규화 좌표)** Export
- 기본 모드: **배경만 생성(background_only) + 텍스트/CTA는 캔버스에서 결정론 합성**
  - 텍스트 오타/깨짐/위치 튐을 크게 줄이는 목적
- 옵션 모드: **모델이 텍스트 포함(full_creative)** (빠른 시안용)

## Local Run

1. 환경변수 준비

```bash
cp .env.example .env.local
```

`.env.local`에 최소 아래를 채우세요:

- `GEMINI_API_KEY`
- (선택) `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (운영/로그 저장용)
- (선택, 요식업 진단 확장) 네이버 키워드 그물망:
  - `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
  - `NAVER_SEARCHAD_ACCESS_LICENSE`, `NAVER_SEARCHAD_SECRET_KEY`, `NAVER_SEARCHAD_CUSTOMER_ID`

2. 설치/실행

```bash
npm install
npm run dev
```

브라우저에서:

- `http://localhost:3000` (마케닥 랜딩)
- `http://localhost:3000/login` (로그인)
- `http://localhost:3000/creative` (Nano Banana 광고소재 스튜디오)
- `http://localhost:3000/diagnosis` (요식업 진단 MVP)

## How To Use (Creative)

1. (선택) 레퍼런스 이미지 업로드 (최대 5장)
2. 헤드/서브/CTA 텍스트 입력 (비우면 이미지 전용으로 처리)
3. **생성 설정**
   - 사이즈 프리셋: `1:1 / 4:5 / 9:16`
   - 렌더 모드:
     - Mode B: 배경만 생성 + 텍스트는 결정론 오버레이 (기본)
     - Mode A: 텍스트 포함 생성 (시안용)
   - 모델 선택: Flash / 3 Pro 등
4. `레이아웃 편집(팝업)`에서 박스 위치/크기 조정 후 `적용`
5. `생성` 버튼 클릭
   - Mode B: 배경 생성 → 텍스트/CTA 결정론 합성 → 최종 PNG 다운로드

## Prompt Library

프롬프트는 코드에 하드코딩하지 않고 `/prompts` 폴더를 단일 진실(SOT)로 사용합니다.

- `prompts/background_only.md`
- `prompts/full_creative.md`
- `prompts/README.md`

## API

- `POST /api/generate`
  - `Content-Type: application/json`일 때 Nano Banana JSON 요청을 처리합니다.
  - 기존 `multipart/form-data` 요청도 유지됩니다(레거시).

- `POST /api/overlay`
  - Layout JSON → Guide Overlay PNG(base64) 생성

- `POST /api/prompt`
  - 현재 입력값 기반으로 프롬프트 문자열만 생성(미리보기/복사용)

## Tests

```bash
npm test
```

포함 테스트:

- 좌표 normalize/denormalize
- 텍스트 오토핏(박스 내부 항상 유지)
- 오버레이 PNG 생성(크기/알파 메타 확인)

## Watermark Policy

생성 결과에는 SynthID 워터마크가 포함될 수 있습니다(시각적으로 보이지 않을 수 있음).

- 워터마크 제거 기능은 구현하지 않습니다.
- 대신 프롬프트에서 로고/서명/워터마크/UI/랜덤 텍스트 생성을 금지합니다.

## MKDoc Diagnosis MVP

주요 플로우:

1. `/diagnosis`: 플레이스(자동/수동) + 사진 업로드 + 무료 6문항 → 미리보기 리포트 생성
2. `/report/[requestId]`: 결제 전에는 점수/병목 1개만 공개
3. `/checkout?request=[requestId]`: Toss 결제 위젯(키가 없으면 개발용 결제) → 결제 승인 → 리포트로 이동
4. 결제 후 추가 6문항 입력 → `/api/mkdoc/diagnosis/report/generate` 로 풀 리포트 생성

결제(실제 Toss) 사용 시 필요한 env:

- `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- `TOSS_SECRET_KEY`
