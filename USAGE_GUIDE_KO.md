# 마케닥(MKDoc) 사용 가이드 (2026-02-13 기준)

## 1) 시작 전 준비

### 필수 환경변수 (`.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (또는 `SUPABASE_SECRET_KEY`)
- `GEMINI_API_KEY`
- `ADMIN_PASSWORD`

### (선택) 키워드 그물망 기능용 네이버 API 키
진단 결과 화면에서 **키워드 수요/CTR/입찰가** 패널을 보려면 아래가 추가로 필요합니다.
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `NAVER_SEARCHAD_ACCESS_LICENSE`
- `NAVER_SEARCHAD_SECRET_KEY`
- `NAVER_SEARCHAD_CUSTOMER_ID`

### (선택) Toss 결제 위젯(실제 결제) 키
`/checkout`에서 Toss 결제를 실제로 붙이려면 아래를 추가하세요.
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- `TOSS_SECRET_KEY`

### 실행
```bash
npm install
npm run dev
```

접속 URL:
- 메인: `http://localhost:3000/`
- 유저 로그인: `http://localhost:3000/login`
- 관리자 로그인: `http://localhost:3000/admin/login`
- 히스토리: `http://localhost:3000/history`
- 요식업 진단(MKDoc MVP): `http://localhost:3000/diagnosis`
- (레거시) 요식업 진단 v1 시작: `http://localhost:3000/diagnosis/start` (현재 `/diagnosis`로 리다이렉트)
- 키워드 서치 엔진: `http://localhost:3000/diagnosis/keyword-net`

## 2) 일반 사용자 기능 사용법

### 로그인(유저)
- 로그인 화면에서 **이메일/비밀번호로 회원가입 후** 같은 값으로 로그인합니다.
- 기본 계정(ID/PW)은 제공하지 않습니다.

### A. 광고 생성
1. 메인 화면에서 레퍼런스 소스를 선택합니다.
- `직접 업로드`: 직접 레퍼런스 이미지를 넣기
- `추천 레퍼런스`: 저장된 템플릿 스타일 선택
2. 필요하면 제품 이미지를 업로드합니다.
3. 생성 제어에서 모드를 고릅니다.
- `텍스트 포함 생성`
- `이미지 전용 생성`
4. 카피 모드를 선택합니다.
- `AI 자동 카피`
- `직접 카피 입력` (헤드/서브/CTA 직접 입력)
5. 출력 사이즈 프리셋 선택
- 기본 추천: `1080 x 1080`
6. `광고 이미지 생성` 클릭
7. 결과 카드에서 다운로드 또는 히스토리 이동

### C. 요식업 진단(MKDoc MVP)
1. `http://localhost:3000/diagnosis` 접속 (로그인 필요)
2. 플레이스 입력:
   - 네이버 키가 있으면: placeInput 입력 → 매장 후보 선택
   - 네이버 키가 없으면: `수동 입력` 모드로 전환 → 매장명/주소 입력
3. 사진 업로드(최소 3장) → 무료 6문항 입력
3. `미리보기 리포트 생성` 클릭 → `http://localhost:3000/report/<requestId>`에서 미리보기 확인
4. `39,900원 결제하고 풀 리포트 받기` 클릭 → `http://localhost:3000/checkout?request=<requestId>`
5. 결제:
   - Toss 키가 있으면: 결제 위젯으로 실제 결제 → `/checkout/success`에서 승인 확인 후 리포트로 이동
   - Toss 키가 없으면: 개발용 결제(강제 결제 완료)로 진행 가능
6. 결제 완료 후: 추가 질문 6문항 입력 → `풀 리포트 생성`

레거시(v1) 진단은 현재 신규 플로우로 이동하도록 정리 중입니다.

### B. 생성 실패 시
- 에러 박스의 `같은 설정으로 다시 시도` 버튼으로 즉시 재실행
- 429가 뜨면 잠시 후 재시도 (현재 서버 메모리 기준 레이트리밋 적용)

## 3) 관리자 기능 사용법

### A. 로그인
1. `http://localhost:3000/admin/login` 접속
2. `ADMIN_PASSWORD` 입력

### B. 레퍼런스 업로드/스타일 저장
1. 저장 위치 선택: `Supabase` 또는 `Local`
2. 이미지 업로드
3. 스타일 입력
- 비주얼 가이드
- 헤드카피 스타일
- 서브카피 스타일
- CTA 스타일
4. `업로드 + 스타일 저장`

### C. 템플릿 편집
- `로컬 레퍼런스 스타일 편집`
- `Supabase 템플릿 스타일 편집`
- 수정 후 각각 저장 버튼 클릭

## 4) 현재 구현 완료 기능 목록

- 관리자 인증 보호 (`/admin`, `/api/admin/*`)
- 관리자 로그인/로그아웃
- 레퍼런스 업로드 (Local/Supabase 이중 지원)
- 추천 레퍼런스 갤러리 선택
- 레퍼런스 스타일 가이드 자동 주입 (비주얼/헤드/서브/CTA)
- 8가지 생성 시나리오 분기 처리
- 텍스트 포함/이미지 전용 생성 모드
- 자동 카피/직접 카피 입력
- 출력 사이즈 프리셋 + 커스텀 크기
- 생성 히스토리 저장/조회/재생성
- 생성 실패 재시도 버튼
- 생성 API 레이트리밋 + Gemini 타임아웃
- 요식업 진단 v1 플로우(설문 → 점수/타입 → 결과/잠금 → 개발용 결제 → 온보딩)

## 5) 자주 발생하는 오류와 해결

### 오류: `Cannot find module './xxx.js'`
원인: Next dev 캐시 꼬임  
해결:
```bash
npm run dev:reset
```

### 오류: `EADDRINUSE: address already in use :3000`
원인: 이미 다른 Next 서버가 3000 포트를 사용 중  
해결:
1) 기존 터미널에서 `Ctrl+C` 로 서버 종료  
2) 그래도 안 풀리면 `lsof -nP -iTCP:3000 -sTCP:LISTEN` 로 PID 확인 후 종료  

### 오류: 스타일이 전혀 안 먹고 HTML만 보임
원인: CSS chunk 로드 실패  
해결:
1. 위 캐시 초기화 수행
2. 브라우저 강력 새로고침 (`Cmd+Shift+R` / `Ctrl+F5`)
3. 기존 에러 탭 닫고 새 탭 접속

### 오류: `/admin` 접속 시 `error=config`
원인: `ADMIN_PASSWORD` 미설정  
해결: `.env.local`에 `ADMIN_PASSWORD` 추가 후 서버 재시작

## 6) Threads 계정 연동 후 "게시글 발행"까지 가는 단계

아래는 **현재 마케닥 상태에서 Threads 발행 기능**을 붙일 때의 현실적인 순서입니다.

### 단계 1. Meta 앱 준비
1. Meta Developers에서 앱 생성
2. 앱 생성 시 Threads 사용 케이스 선택
3. 앱의 Threads 전용 App ID/Secret 확인

체크포인트:
- 샘플 앱 기준으로 Threads용 App ID/Secret은 일반 앱과 구분해서 사용

### 단계 2. OAuth 설정
1. Redirect URI 등록
2. 로그인/권한 동의 플로우 구현
3. Access Token 발급/갱신 처리

체크포인트:
- Threads 샘플 가이드 기준, 로컬 테스트라도 `localhost` 콜백 대신 도메인+HTTPS 구성이 필요

### 단계 3. 최소 권한 범위로 발행 MVP
MVP 권장 scope:
- `threads_basic`
- `threads_content_publish`

확장 scope(선택):
- 인사이트: `threads_manage_insights`
- 댓글/답글 자동화: `threads_manage_replies`, `threads_read_replies`

### 단계 4. 발행 API 구현
1. 컨테이너 생성 (`/threads`)
2. 게시 발행 (`/threads_publish`)
3. 발행 상태/쿼터 확인

### 단계 5. 운영 전환 준비 (App Review / Verification)
1. 앱을 실제 일반 사용자에게 공개하려면 App Review/권한 승인 단계 준비
2. Business Verification 요구 시 회사 정보/문서 제출
3. 권한별 사용 목적, 화면 동선, 테스트 계정 정보를 정리

## 7) Threads 연동 시 준비 문서 체크리스트

### A. 기술 제출물
- Redirect URI 목록
- 권한별 사용 목적 문서 (왜 필요한지)
- 동작 시연 영상(로그인 → 권한 동의 → 발행 완료)
- 테스트 계정/재현 절차
- 개인정보/데이터 삭제 요청 URL(및 정책 페이지)

### B. 비즈니스 검증 시 자주 요구되는 항목
- 법인/사업자 등록 관련 문서
- 지방/국가 발급 사업자 라이선스
- 유틸리티 고지서 또는 세금 신고 문서(사업체 연관 증빙)
- 사업체명/주소/연락처가 Meta 비즈니스 정보와 일치하는 자료

## 8) 예상 소요

- 개발 MVP(연동+발행): 3~7일
- App Review/비즈니스 검증: 케이스별 편차 큼 (보통 수일~수주)

---

## 참고 링크 (공식)

- Threads 공식 Postman 컬렉션: https://www.postman.com/meta/threads/collection/dht3nzz/threads-api
- Threads 공식 Postman 문서: https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api
- Meta 공식 Threads 워크스페이스: https://www.postman.com/meta/threads/overview
- Meta 공식 샘플 앱: https://github.com/fbsamples/threads_api
- Threads API 변경로그(공식 docs 링크): https://developers.facebook.com/docs/threads/changelog

## 참고 링크 (Meta Help Center)

- Business account verification 문서 안내: https://www.facebook.com/help/243868559497297/
- 사업체 소유 증빙 문서 예시: https://www.facebook.com/help/287728524907292
