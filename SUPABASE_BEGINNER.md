# Supabase 초보 적용 가이드 (3분)

## 1) SQL Editor 열기

1. https://supabase.com 로그인
2. 프로젝트 `suvyduoqcwvqmurvtrej` 클릭
3. 왼쪽 메뉴 `SQL Editor` 클릭
4. `New query` 클릭

## 2) 한 번에 실행 (추천)

아래 파일 내용을 전부 복사해서 SQL Editor에 붙여넣고 `Run`:

- (광고소재 스튜디오) `supabase/one_click_setup.sql`
- (요식업 진단 MKDoc) `supabase/one_click_setup_mkdoc.sql`

둘 다 쓸 거면 위 2개를 각각 `Run` 하면 됩니다. (순서는 크게 중요하지 않습니다.)

### 웹에서 바로 확인(추천)

로컬 서버가 켜져 있다면 `http://localhost:3000/setup` 에서
환경변수/DB 테이블/Storage 버킷 상태를 한 번에 확인할 수 있습니다.

## 3) seed URL 교체 (선택)

`one_click_setup.sql` 맨 아래의 `https://example.com/...` URL은 샘플입니다.
실제 이미지 URL로 바꿔서 실행하면 추천 갤러리에 이미지가 뜹니다.

## 4) 실행 확인

아래 URL을 브라우저에서 열었을 때 JSON 배열(`[]` 또는 데이터)이 보이면 성공:

- `https://suvyduoqcwvqmurvtrej.supabase.co/rest/v1/reference_templates?select=id,category&limit=3`

헤더 필요:
- `apikey: <YOUR_SUPABASE_ANON_KEY>`
- `Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>`
