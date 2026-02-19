-- Replace image_url values with your own CDN/storage URLs.
insert into public.reference_templates (category, image_url, description)
values
  ('뷰티', 'https://example.com/refs/beauty-01.jpg', '프리미엄 뷰티 제품 중심의 미니멀 하이엔드 톤'),
  ('뷰티', 'https://example.com/refs/beauty-02.jpg', '전후 비교형 구도와 클린 배경'),
  ('건기식', 'https://example.com/refs/health-01.jpg', '신뢰 강조형 의학적 무드와 성분 포인트'),
  ('건기식', 'https://example.com/refs/health-02.jpg', '효능 핵심문구 + 원료 클로즈업 구도'),
  ('리빙', 'https://example.com/refs/living-01.jpg', '라이프스타일 장면 중심의 자연광 연출'),
  ('리빙', 'https://example.com/refs/living-02.jpg', '문제-해결 메시지 구조의 전환형 레이아웃');
