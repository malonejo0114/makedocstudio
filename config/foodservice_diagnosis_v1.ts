export const FOOD_DIAGNOSIS_V1_SCHEMA_VERSION = "makedoc.diagnosis.v1" as const;

export const FOOD_DIAGNOSIS_V1_DIMENSIONS = [
  { id: "product_hook", label: "상품/후킹" },
  { id: "place_conversion", label: "플레이스 전환" },
  { id: "review_trust", label: "리뷰/신뢰" },
  { id: "traffic", label: "트래픽/노출" },
  { id: "unit_economics", label: "손익구조" },
  { id: "retention", label: "재방문" },
  { id: "content_engine", label: "콘텐츠 생산" },
  { id: "data_readiness", label: "데이터/측정" },
] as const;

export type FoodDiagnosisV1DimensionId = (typeof FOOD_DIAGNOSIS_V1_DIMENSIONS)[number]["id"];

export type FoodDiagnosisV1TypeId =
  | "T1_SCALE_TRAFFIC"
  | "T2_BUILD_HOOK"
  | "T3_SEARCH_DOMINATE"
  | "T4_PLACE_LEAK"
  | "T5_REVIEW_GAP"
  | "T6_UNIT_ECON_RISK"
  | "T7_RETENTION_LEAK"
  | "T8_CHANNEL_IMBALANCE"
  | "T9_CONTENT_STUCK"
  | "T10_DATA_BLIND";

export const FOOD_DIAGNOSIS_V1_TYPE_LABELS: Record<FoodDiagnosisV1TypeId, string> = {
  T1_SCALE_TRAFFIC: "노출 확장형(후킹은 있는데 노출이 약함)",
  T2_BUILD_HOOK: "상품기획 선행형(후킹 재설계가 먼저)",
  T3_SEARCH_DOMINATE: "키워드 장악형(검색 기반이 정답)",
  T4_PLACE_LEAK: "플레이스 전환 누수형(썸네일/정보/첫인상 문제)",
  T5_REVIEW_GAP: "리뷰/신뢰 부족형(사회적 증거가 약함)",
  T6_UNIT_ECON_RISK: "손익 구조 위험형(BEP/원가/객단가)",
  T7_RETENTION_LEAK: "재방문 누수형(한 번 오고 끝)",
  T8_CHANNEL_IMBALANCE: "채널 편식형(한 채널에만 의존)",
  T9_CONTENT_STUCK: "콘텐츠 생산 정체형(소재/발행 시스템 없음)",
  T10_DATA_BLIND: "데이터 부재형(측정이 안 돼서 개선이 안 쌓임)",
};

export const FOOD_DIAGNOSIS_V1_DIMENSION_SCORING = {
  baseScore: 50,
  minScore: 0,
  maxScore: 100,
} as const;

export type FoodDiagnosisV1QuestionType =
  | "url"
  | "text"
  | "single_select"
  | "multi_select"
  | "currency"
  | "percent"
  | "number"
  | "file"
  | "group"
  | "subgroup";

export type FoodDiagnosisV1Signals = Partial<Record<FoodDiagnosisV1DimensionId, number>>;

export type FoodDiagnosisV1Option = {
  value: string;
  label: string;
};

export type FoodDiagnosisV1NumericRule = {
  if: { gte?: number; lte?: number; between?: [number, number] };
  add: FoodDiagnosisV1Signals;
};

export type FoodDiagnosisV1MultiSelectSignal = {
  includes: string;
  add: FoodDiagnosisV1Signals;
};

export type FoodDiagnosisV1SignalsByIncludes = {
  includes: string;
  add: FoodDiagnosisV1Signals;
};

export type FoodDiagnosisV1Field = {
  key: string;
  label: string;
  type: Exclude<FoodDiagnosisV1QuestionType, "group">;
  required?: boolean;
  placeholder?: string;
  options?: FoodDiagnosisV1Option[];
  accept?: string[];
  maxFiles?: number;
  helperText?: string;
  validation?: {
    minLen?: number;
    maxLen?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  signals?: {
    onAnswered?: FoodDiagnosisV1Signals;
    onAnyAnswered?: FoodDiagnosisV1Signals;
  };
  signalsByOption?: Record<string, FoodDiagnosisV1Signals>;
  numericRules?: FoodDiagnosisV1NumericRule[];
  multiSelectSignals?: FoodDiagnosisV1MultiSelectSignal[];
  signalsByIncludes?: FoodDiagnosisV1SignalsByIncludes[];
  fields?: FoodDiagnosisV1Field[];
};

export type FoodDiagnosisV1Question = {
  id: string;
  order: number;
  section: string;
  title: string;
  type: FoodDiagnosisV1QuestionType;
  required?: boolean;
  key?: string;
  placeholder?: string;
  helperText?: string;
  options?: FoodDiagnosisV1Option[];
  accept?: string[];
  maxFiles?: number;
  maxSizeMB?: number;
  validation?: {
    minLen?: number;
    maxLen?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  signals?: {
    onAnswered?: FoodDiagnosisV1Signals;
    onAnyAnswered?: FoodDiagnosisV1Signals;
  };
  signalsByOption?: Record<string, FoodDiagnosisV1Signals>;
  numericRules?: FoodDiagnosisV1NumericRule[];
  multiSelectSignals?: FoodDiagnosisV1MultiSelectSignal[];
  signalsByIncludes?: Array<{
    includes: string;
    add: FoodDiagnosisV1Signals;
  }>;
  fields?: FoodDiagnosisV1Field[];
};

export const FOOD_DIAGNOSIS_V1_QUESTIONS: FoodDiagnosisV1Question[] = [
  {
    id: "q1_place_url",
    order: 1,
    section: "기본",
    title: "네이버 플레이스 링크를 입력해 주세요",
    type: "url",
    key: "place_url",
    required: true,
    placeholder: "https://place.naver.com/...",
    validation: { pattern: "https?://.*" },
    signals: { onAnswered: { data_readiness: 5 } },
  },
  {
    id: "q2_store_basic",
    order: 2,
    section: "기본",
    title: "매장 기본 정보",
    type: "group",
    required: true,
    fields: [
      {
        key: "store_name",
        label: "매장명",
        type: "text",
        required: true,
        validation: { minLen: 1, maxLen: 30 },
      },
      {
        key: "biz_type",
        label: "업태",
        type: "single_select",
        required: true,
        options: [
          { value: "cafe", label: "카페/디저트" },
          { value: "restaurant", label: "일반식당" },
          { value: "bar", label: "주점/이자카야" },
          { value: "delivery", label: "배달전문" },
          { value: "franchise", label: "프랜차이즈" },
          { value: "etc", label: "기타" },
        ],
      },
      {
        key: "area",
        label: "핵심 상권/지역(예: 성수동/홍대입구역/OO대학)",
        type: "text",
        required: true,
        validation: { minLen: 2, maxLen: 40 },
        signals: { onAnswered: { data_readiness: 5 } },
      },
      {
        key: "stage",
        label: "운영 단계",
        type: "single_select",
        required: true,
        options: [
          { value: "new_90", label: "신규 오픈(90일 이내)" },
          { value: "growth", label: "운영중(3개월~2년)" },
          { value: "mature", label: "장기 운영(2년 이상)" },
        ],
        signalsByOption: {
          new_90: { traffic: -5, review_trust: -10 },
          growth: { data_readiness: 5 },
          mature: { review_trust: 5 },
        },
      },
    ],
  },
  {
    id: "q3_goal",
    order: 3,
    section: "목표",
    title: "이번 달(30일) 가장 중요한 목표는 무엇인가요?",
    type: "single_select",
    key: "goal",
    required: true,
    options: [
      { value: "sales_fast", label: "당장 매출(30일) 올리기" },
      { value: "place_rank", label: "플레이스 상위노출/검색지면 장악" },
      { value: "delivery_stable", label: "배달 매출 안정화" },
      { value: "repeat_brand", label: "단골/브랜딩(재방문) 강화" },
    ],
    signalsByOption: {
      sales_fast: { traffic: 5 },
      place_rank: { place_conversion: 5 },
      repeat_brand: { retention: 5 },
    },
  },
  {
    id: "q4_avg_ticket",
    order: 4,
    section: "손익",
    title: "평균 객단가(1팀 기준)를 입력해 주세요",
    type: "currency",
    key: "avg_ticket",
    required: true,
    validation: { min: 3000, max: 300000 },
    signals: { onAnswered: { unit_economics: 5, data_readiness: 5 } },
  },
  {
    id: "q5_fixed_cost",
    order: 5,
    section: "손익",
    title: "월 고정비(월세+인건비+관리비+기타)를 입력해 주세요",
    type: "currency",
    key: "fixed_cost",
    required: true,
    validation: { min: 0, max: 100000000 },
    signals: { onAnswered: { unit_economics: 5, data_readiness: 5 } },
  },
  {
    id: "q6_variable_rate",
    order: 6,
    section: "손익",
    title: "변동비율(원가+결제수수료)을 %로 입력해 주세요",
    type: "percent",
    key: "variable_rate",
    required: true,
    validation: { min: 0, max: 90 },
    numericRules: [
      { if: { gte: 45 }, add: { unit_economics: -25 } },
      { if: { between: [35, 44] }, add: { unit_economics: -10 } },
      { if: { lte: 34 }, add: { unit_economics: 5 } },
    ],
    signals: { onAnswered: { data_readiness: 5 } },
  },
  {
    id: "q7_monthly_teams",
    order: 7,
    section: "현황",
    title: "월 평균 방문팀 수(또는 월 주문건수)를 입력해 주세요",
    type: "number",
    key: "monthly_teams",
    required: true,
    validation: { min: 0, max: 100000 },
    signals: { onAnswered: { data_readiness: 10 } },
  },
  {
    id: "q8_revisit_rate",
    order: 8,
    section: "현황",
    title: "재방문율(체감 기준)을 선택해 주세요",
    type: "single_select",
    key: "revisit_rate_band",
    required: true,
    options: [
      { value: "unknown", label: "모름/측정 안 됨" },
      { value: "0_10", label: "0~10%" },
      { value: "10_25", label: "10~25%" },
      { value: "25_40", label: "25~40%" },
      { value: "40_plus", label: "40% 이상" },
    ],
    signalsByOption: {
      unknown: { retention: -10, data_readiness: -5 },
      "0_10": { retention: -20 },
      "10_25": { retention: -10 },
      "25_40": { retention: 5 },
      "40_plus": { retention: 15 },
    },
  },
  {
    id: "q9_budget_band",
    order: 9,
    section: "유입",
    title: "최근 30일 마케팅/광고 예산(대략)을 선택해 주세요",
    type: "single_select",
    key: "budget_band",
    required: true,
    options: [
      { value: "0", label: "0원" },
      { value: "1_30", label: "1~30만원" },
      { value: "30_100", label: "30~100만원" },
      { value: "100_200", label: "100~200만원" },
      { value: "200_plus", label: "200만원 이상" },
    ],
    signalsByOption: {
      "0": { traffic: -20 },
      "1_30": { traffic: -10 },
      "30_100": { traffic: 0 },
      "100_200": { traffic: 5 },
      "200_plus": { traffic: 10 },
    },
  },
  {
    id: "q10_channels",
    order: 10,
    section: "유입",
    title: "현재 ‘신규 유입’이 실제로 발생하는 채널을 모두 선택해 주세요",
    type: "multi_select",
    key: "channels",
    required: true,
    options: [
      { value: "naver_place", label: "네이버지도/플레이스 검색" },
      { value: "naver_search", label: "네이버 검색(블로그/카페/키워드)" },
      { value: "delivery_app", label: "배달앱(배민/쿠팡이츠/요기요 등)" },
      { value: "instagram", label: "인스타/릴스" },
      { value: "tiktok", label: "틱톡/숏폼" },
      { value: "threads", label: "스레드" },
      { value: "carrot", label: "당근" },
      { value: "offline_repeat", label: "지인/단골/입소문" },
      { value: "etc", label: "기타" },
    ],
    multiSelectSignals: [
      { includes: "naver_place", add: { place_conversion: 5, traffic: 5 } },
      { includes: "naver_search", add: { traffic: 5 } },
      { includes: "instagram", add: { traffic: 5, content_engine: 5 } },
      { includes: "tiktok", add: { traffic: 5, content_engine: 5 } },
      { includes: "threads", add: { traffic: 3, content_engine: 3 } },
      { includes: "carrot", add: { traffic: 5 } },
      { includes: "offline_repeat", add: { retention: 5 } },
    ],
  },
  {
    id: "q11_hook_level",
    order: 11,
    section: "상품/소재",
    title: "‘사진 한 장만 봐도’ 바로 가고 싶게 만드는 시그니처/후킹 포인트가 있나요?",
    type: "single_select",
    key: "hook_level",
    required: true,
    options: [
      { value: "strong", label: "있다(한 장만 봐도 충동 유발)" },
      { value: "medium", label: "어느 정도 있다(정리는 필요)" },
      { value: "weak", label: "없다/모르겠다(후킹이 약함)" },
    ],
    signalsByOption: {
      strong: { product_hook: 30, traffic: 5 },
      medium: { product_hook: 10 },
      weak: { product_hook: -25 },
    },
  },
  {
    id: "q12_assets_and_metrics",
    order: 12,
    section: "자료",
    title: "플레이스/매장 자료를 올려주세요 (정확도 크게 올라갑니다)",
    type: "group",
    required: false,
    fields: [
      {
        key: "place_metrics",
        label: "플레이스 지표(알면 입력, 몰라도 됨)",
        type: "subgroup",
        fields: [
          {
            key: "visitor_reviews",
            label: "방문자 리뷰 수",
            type: "number",
            required: false,
            validation: { min: 0, max: 1000000 },
          },
          {
            key: "blog_reviews",
            label: "블로그 리뷰 수",
            type: "number",
            required: false,
            validation: { min: 0, max: 1000000 },
          },
          {
            key: "rating",
            label: "별점",
            type: "number",
            required: false,
            validation: { min: 0, max: 5 },
          },
          {
            key: "saves",
            label: "저장 수",
            type: "number",
            required: false,
            validation: { min: 0, max: 10000000 },
          },
        ],
        signals: { onAnyAnswered: { data_readiness: 10, review_trust: 5 } },
      },
      {
        key: "uploads",
        label: "사진 업로드(권장)",
        type: "file",
        required: false,
        accept: ["image/jpeg", "image/png", "image/webp"],
        maxFiles: 12,
        helperText:
          "권장: (1) 외관 2장 (2) 내부 2장 (3) 메인메뉴 4장 (4) 플레이스 검색결과 썸네일 스샷 1장",
        signals: { onAnswered: { place_conversion: 10, content_engine: 10 } },
      },
      {
        key: "pain_points",
        label: "지금 가장 답답한 문제를 모두 선택해 주세요",
        type: "multi_select",
        required: true,
        options: [
          { value: "no_exposure", label: "노출 자체가 안 됨(검색/지도에서 안 보임)" },
          { value: "low_click", label: "노출은 되는데 클릭이 안 됨(썸네일/첫인상)" },
          { value: "low_visit", label: "클릭은 되는데 방문/예약/전화가 안 됨" },
          { value: "low_reviews", label: "리뷰가 안 쌓임/리뷰가 약함" },
          { value: "low_repeat", label: "재방문이 낮음(한 번 오고 끝)" },
          { value: "low_ticket", label: "객단가가 낮음" },
          { value: "high_cogs", label: "원가가 높아 남는 게 없음" },
          { value: "no_content", label: "콘텐츠 만들 시간이/소재가 없음" },
        ],
        signalsByIncludes: [
          { includes: "low_click", add: { place_conversion: -10 } },
          { includes: "low_reviews", add: { review_trust: -10 } },
          { includes: "high_cogs", add: { unit_economics: -10 } },
          { includes: "low_repeat", add: { retention: -10 } },
          { includes: "no_content", add: { content_engine: -10 } },
        ],
      },
    ],
  },
];

export const FOOD_DIAGNOSIS_V1_COMPUTED_METRICS = [
  { id: "contribution_margin", label: "팀당 공헌이익" },
  { id: "bep_monthly_teams", label: "월 BEP 팀수" },
  { id: "bep_daily_teams", label: "일 BEP 팀수" },
  { id: "current_daily_teams", label: "현재 일 평균 팀수" },
  { id: "gap_daily_teams", label: "일 갭(추가 필요 팀수)" },
  { id: "gap_ratio", label: "BEP 대비 현재 비율" },
] as const;

export type FoodDiagnosisV1MetricId = (typeof FOOD_DIAGNOSIS_V1_COMPUTED_METRICS)[number]["id"];

export type FoodDiagnosisV1TypeRuleCondition =
  | { metric: FoodDiagnosisV1MetricId; gte?: number; lte?: number; between?: [number, number] }
  | { answer: string; eq?: string; ne?: string; in?: string[]; gte?: number; lte?: number }
  | { dimension: FoodDiagnosisV1DimensionId; gte?: number; lte?: number }
  | { answerIncludes: { path: string; value: string } }
  | { answerArrayLen: { path: string; lte?: number; gte?: number } };

export type FoodDiagnosisV1TypeRule = {
  typeId: FoodDiagnosisV1TypeId;
  priority: number;
  whenAny?: FoodDiagnosisV1TypeRuleCondition[];
  whenAll?: FoodDiagnosisV1TypeRuleCondition[];
};

export const FOOD_DIAGNOSIS_V1_TYPE_RULES: FoodDiagnosisV1TypeRule[] = [
  {
    typeId: "T6_UNIT_ECON_RISK",
    priority: 100,
    whenAny: [
      { metric: "gap_ratio", gte: 1.4 },
      { answer: "variable_rate", gte: 45 },
      { answerIncludes: { path: "pain_points", value: "high_cogs" } },
    ],
  },
  {
    typeId: "T4_PLACE_LEAK",
    priority: 90,
    whenAny: [
      { answerIncludes: { path: "pain_points", value: "low_click" } },
      { dimension: "place_conversion", lte: 35 },
    ],
  },
  {
    typeId: "T5_REVIEW_GAP",
    priority: 80,
    whenAny: [
      { answerIncludes: { path: "pain_points", value: "low_reviews" } },
      { dimension: "review_trust", lte: 35 },
    ],
  },
  {
    typeId: "T7_RETENTION_LEAK",
    priority: 70,
    whenAny: [
      { answer: "revisit_rate_band", in: ["0_10", "unknown"] },
      { answerIncludes: { path: "pain_points", value: "low_repeat" } },
    ],
  },
  {
    typeId: "T10_DATA_BLIND",
    priority: 60,
    whenAll: [{ dimension: "data_readiness", lte: 30 }],
  },
  {
    typeId: "T2_BUILD_HOOK",
    priority: 55,
    whenAll: [
      { answer: "hook_level", eq: "weak" },
      { answer: "biz_type", ne: "franchise" },
    ],
  },
  {
    typeId: "T3_SEARCH_DOMINATE",
    priority: 54,
    whenAll: [
      { answer: "hook_level", eq: "weak" },
      { answer: "biz_type", eq: "franchise" },
    ],
  },
  {
    typeId: "T1_SCALE_TRAFFIC",
    priority: 50,
    whenAll: [
      { answer: "hook_level", eq: "strong" },
      { dimension: "traffic", lte: 45 },
    ],
  },
  {
    typeId: "T8_CHANNEL_IMBALANCE",
    priority: 40,
    whenAll: [{ answerArrayLen: { path: "channels", lte: 1 } }],
  },
  {
    typeId: "T9_CONTENT_STUCK",
    priority: 30,
    whenAny: [
      { answerIncludes: { path: "pain_points", value: "no_content" } },
      { dimension: "content_engine", lte: 35 },
    ],
  },
];

export type FoodDiagnosisV1ReportTemplate = {
  heroTitle: string;
  heroSubtitle: string;
  why: string[];
  rx_72h: string[];
  rx_14d: string[];
  rx_30d: string[];
  recommendedProducts: string[];
};

export const FOOD_DIAGNOSIS_V1_REPORT_PARTIALS = {
  place_framework: {
    title: "플레이스 핵심 진단 프레임(4축)",
    body: [
      "플레이스는 (1)정확도(정보/업종/가격/대표키워드), (2)신뢰도(리뷰/사업자정보), (3)최신성(공지/사진/메뉴 업데이트), (4)인기도(저장/공유/외부유입/방문행동) 축으로 점수화합니다.",
      "첫 화면(미리보기 5장 + 첫 문단)이 클릭률에 직접 영향을 주기 때문에, ‘키워드 나열’보다 ‘왜 여기여야 하는지(장점+숫자)’를 먼저 씁니다.",
      "기본 세팅(톡/쿠폰/예약/채널연결)과 최신성 관리(사진/공지/리뷰응답)는 ‘지금 당장’ 바꿀 수 있는 전환 레버입니다.",
    ],
  },
  bep_block: {
    title: "손익분기(BEP) 스냅샷",
    body: [
      "팀당 공헌이익(객단가-변동비): 약 {{contribution_margin}}원",
      "월 BEP 팀수: 약 {{bep_monthly_teams}}팀 (일 기준 {{bep_daily_teams}}팀)",
      "현재 일 평균 팀수: {{current_daily_teams}}팀 → BEP까지 일 {{gap_daily_teams}}팀이 추가로 필요",
    ],
  },
  paywall_copy: {
    title: "처방전 전문(유료)에서 제공되는 것",
    bullets: [
      "플레이스 ‘첫 화면’ 교정안(대표사진 구성/순서/문구) + 상세설명 초안",
      "키워드 확장 리스트(상권+메뉴+상황 조합) + 30일 노출 플랜",
      "예산 배분안(탐색→부스팅→안정) + 추천 상품 조합",
      "72시간/14일/30일 실행 체크리스트(PDF형)",
    ],
    ctaPrimary: "초격차 패키지(299,000원)로 1:1 처방전 받기",
    ctaSecondary: "30분 상담(45,000원)으로 방향만 빠르게 잡기",
  },
} as const;

export const FOOD_DIAGNOSIS_V1_REPORT_TEMPLATES: Record<
  FoodDiagnosisV1TypeId,
  FoodDiagnosisV1ReportTemplate
> = {
  T1_SCALE_TRAFFIC: {
    heroTitle: "{{store_name}} 진단 결과: 노출 확장형",
    heroSubtitle:
      "후킹 포인트는 있는데, ‘보는 사람 수’가 부족해서 BEP를 못 넘기는 상태입니다.",
    why: [
      "후킹: {{hook_level}} / 채널: {{channels}} / 예산: {{budget_band}}",
      "BEP 대비 현재 비율(gap_ratio): {{gap_ratio}} → ‘노출 증폭’이 1순위입니다.",
    ],
    rx_72h: [
      "플레이스 첫 화면(미리보기 5장)을 ‘메인메뉴 3장 + 공간/외관 2장’으로 재구성",
      "상세설명 1문단에 ‘장점+숫자’ 3개 박기(예: 150시간 숙성/하루 60그릇 한정/대표메뉴 24겹 등)",
      "쿠폰/예약/톡 연결로 ‘클릭→행동’ 버튼을 늘리기",
    ],
    rx_14d: [
      "가장 빠른 채널 1개만 선택해 탐색(예: 당근 or 플레이스 광고)",
      "체험단/시딩은 ‘한 번에 여러 채널(블로그+인스타)’로 OSMU 설계",
    ],
    rx_30d: [
      "반응 좋은 소재(사진/카피)를 3개만 남기고 예산 몰아주기(부스팅)",
      "월말 리포트에서 ‘노출→클릭→길찾기/전화’ 전환율로 다음 달 예산 재배치",
    ],
    recommendedProducts: [
      "추천 1) 네이버 플레이스 광고: ‘지금 당장’ 지도 검색 유입을 당겨옵니다.",
      "추천 2) 당근 광고: 지역 기반 상권에서 가성비로 탐색하기 좋습니다.",
      "추천 3) 인스타+블로그 시딩: 후킹이 강한 매장은 확산 효율이 잘 나옵니다.",
    ],
  },
  T2_BUILD_HOOK: {
    heroTitle: "{{store_name}} 진단 결과: 상품기획 선행형",
    heroSubtitle:
      "광고를 켜기 전에, ‘가고 싶은 이유(후킹)’를 먼저 만들어야 효율이 나옵니다.",
    why: [
      "후킹: {{hook_level}} → 현재는 ‘충동 유발 장면’이 정리되지 않았습니다.",
      "이 상태에서 광고를 켜면 클릭은 생겨도 전환이 흔들릴 확률이 큽니다.",
    ],
    rx_72h: [
      "시그니처 후보 3개 선정(메뉴/세트/퍼포먼스/공간 중 1개라도 확실히)",
      "대표 사진 기준을 고정(빛/각도/거리/구성)해서 ‘한 장의 기준컷’ 만들기",
      "플레이스 첫 문단은 ‘키워드’가 아니라 ‘차별점+숫자’로 설계",
    ],
    rx_14d: [
      "시그니처 1개를 ‘세트/한정/이벤트’로 패키징해서 테스트",
      "체험단은 “임팩트 장면”이 담기도록 가이드(촬영 컷 리스트)부터 잡기",
    ],
    rx_30d: [
      "반응이 나온 시그니처를 기준으로 광고/리뷰/썸네일을 모두 통일",
      "이후에야 검색광고/플레이스 보장 같은 ‘증폭’ 도구가 효율적으로 붙습니다.",
    ],
    recommendedProducts: [
      "추천 1) 초격차 패키지(299,000): 후킹 설계+플레이스 첫 화면까지 ‘컨설팅처럼’ 잡는 게 1순위입니다.",
      "추천 2) 영수증 리뷰(커스텀): 시그니처가 잡히면 사회적 증거를 빠르게 쌓아야 전환이 붙습니다.",
      "추천 3) 인스타+블로그 시딩: 후킹 장면이 만들어진 뒤에 시딩 효율이 확 올라갑니다.",
    ],
  },
  T3_SEARCH_DOMINATE: {
    heroTitle: "{{store_name}} 진단 결과: 키워드 장악형",
    heroSubtitle:
      "충동형 확산보다 ‘검색 지면 장악(플레이스/블로그/카페)’이 승률이 높은 구조입니다.",
    why: [
      "업태: {{biz_type}} / 후킹: {{hook_level}} → 구조적으로 차별화가 어려운 편",
      "따라서 ‘검색 기반 유입(목적 구매/방문)’을 잡는 게 빠른 길입니다.",
    ],
    rx_72h: [
      "플레이스 SEO 5요소(상호/업종/대표키워드/찾아오는길/상세설명) 기본 교정",
      "대표키워드에 ‘상권+메뉴+상황’ 조합을 확장(롱테일 선점)",
    ],
    rx_14d: [
      "블로그/카페 상위노출용 키워드 3세트를 선택해 집중",
      "체험단/리뷰는 ‘검색 지면을 채우는 목적’으로 설계",
    ],
    rx_30d: [
      "상위노출 키워드가 자리 잡으면, 파워링크/플레이스 광고로 필요한 구간만 증폭",
      "월말엔 ‘키워드별 전환’ 기준으로 키워드를 갈아끼웁니다.",
    ],
    recommendedProducts: [
      "추천 1) 네이버 상위노출(카페/블로그): 구매 의사 높은 검색 유입에 직격입니다.",
      "추천 2) 플레이스 상위노출 보장(25일): 특정 키워드 점유를 ‘기간’으로 가져갑니다.",
      "추천 3) 네이버 파워링크: 상위 구간 경쟁이 심할 때 가장 빠른 단기 레버입니다.",
    ],
  },
  T4_PLACE_LEAK: {
    heroTitle: "{{store_name}} 진단 결과: 플레이스 전환 누수형",
    heroSubtitle:
      "노출이 있어도 ‘첫 화면/정보/사진’ 때문에 클릭과 방문이 새고 있습니다.",
    why: [
      "현재 고민: {{pain_points}}",
      "이 타입은 광고보다 먼저 ‘플레이스 전환율(CVR)’을 고쳐야 비용이 줄어듭니다.",
    ],
    rx_72h: [
      "미리보기 5장: ‘메뉴 3 + 공간 1 + 외관/위치 1’로 표준화",
      "상세설명 1문단: ‘누구를 위한 곳인지 + 왜 여기인지 + 숫자’로 재작성",
      "찾아오는 길: 역/랜드마크/주차/골목 진입 포인트까지 구체화",
    ],
    rx_14d: [
      "리뷰 상단 5개를 ‘사진 2장+3줄+핵심 키워드’ 구조로 쌓이게 설계",
      "클릭이 올라가면 그때부터 플레이스 광고로 ‘유입 증폭’",
    ],
    rx_30d: [
      "썸네일/첫 문단/리뷰 상단을 고정 템플릿화 → 매장 운영이 바빠도 유지되게 만들기",
    ],
    recommendedProducts: [
      "추천 1) 30분 상담(45,000): 지금 누수가 ‘어디서 새는지’만 잡아도 전환이 바로 올라갑니다.",
      "추천 2) 영수증 리뷰(커스텀): 전환을 끌어올리는 가장 빠른 ‘신뢰 레버’입니다.",
      "추천 3) 네이버 플레이스 광고: 전환 구조가 정리된 후 집행하면 CPA가 안정됩니다.",
    ],
  },
  T5_REVIEW_GAP: {
    heroTitle: "{{store_name}} 진단 결과: 리뷰/신뢰 부족형",
    heroSubtitle:
      "맛이 좋아도, 지금은 ‘사회적 증거(리뷰/사진/경험담)’가 약해서 선택에서 밀립니다.",
    why: [
      "현재 고민: {{pain_points}}",
      "요식업에서 리뷰는 ‘선택 비용’을 줄이는 핵심 장치입니다.",
    ],
    rx_72h: [
      "리뷰를 ‘쓰게 하는 구조’부터 세팅(혜택/안내/동선/멘트)",
      "리뷰 사진 품질 기준(메인메뉴 1장 필수 등) 고정",
      "리뷰 답글 운영으로 신뢰도+최신성 동시 확보",
    ],
    rx_14d: [
      "블로그 체험단으로 검색 지면까지 동시에 확보(OSMU)",
      "영수증 리뷰는 ‘상단 5개를 예쁘게’ 만드는 방향으로 설계",
    ],
    rx_30d: [
      "리뷰가 쌓이면 플레이스 전환율이 오르고, 같은 광고비로 더 많은 방문이 생깁니다.",
    ],
    recommendedProducts: [
      "추천 1) 영수증 리뷰(커스텀): 사진/워딩 매칭으로 상단 리뷰 퀄리티를 빠르게 끌어올립니다.",
      "추천 2) 블로그 체험단: 리뷰+검색지면 장악을 한 번에 노릴 수 있습니다.",
      "추천 3) 블로그 리뷰(순위용): 플레이스 노출 보조 레버로 쓰기 좋습니다.",
    ],
  },
  T6_UNIT_ECON_RISK: {
    heroTitle: "{{store_name}} 진단 결과: 손익 구조 위험형",
    heroSubtitle:
      "마케팅보다 먼저 ‘남는 구조’를 잡아야 합니다. 안 그러면 광고는 버티기 게임이 됩니다.",
    why: [
      "일 BEP: {{bep_daily_teams}}팀 / 현재: {{current_daily_teams}}팀 → 일 {{gap_daily_teams}}팀 갭",
      "변동비율: {{variable_rate}}% → 이 구간이면 ‘매출이 늘어도 남는 돈이 적은’ 케이스가 자주 나옵니다.",
    ],
    rx_72h: [
      "BEP를 기준으로 ‘하루 목표팀수/목표매출’을 고정",
      "원가율 높은 메뉴/세트 구조를 먼저 손보기(팔리는 메뉴=사장이 정하는 게 아니라 고객이 정하는 것)",
      "광고는 ‘필요 팀수’를 채우는 최소 도구로만 설계",
    ],
    rx_14d: [
      "객단가를 올리는 세트/추가 옵션 설계(마진 좋은 쪽으로)",
      "검색형 유입(구매 의사 높은 고객) 중심으로 효율 매체만 남기기",
    ],
    rx_30d: [
      "손익 구조가 안정되면 그때 광고/체험단을 확장해도 버틸 체력이 생깁니다.",
    ],
    recommendedProducts: [
      "추천 1) 초격차 패키지(299,000): BEP 기반으로 ‘가장 먼저 바꿔야 할 것’을 딱 잘라 결정합니다.",
      "추천 2) 네이버 상위노출: 의사 높은 고객 유입으로 낭비를 줄입니다.",
      "추천 3) 네이버 플레이스 광고: 전환 구조가 잡힌 뒤 ‘필요 팀수’만큼만 채우는 용도로 씁니다.",
    ],
  },
  T7_RETENTION_LEAK: {
    heroTitle: "{{store_name}} 진단 결과: 재방문 누수형",
    heroSubtitle:
      "신규를 계속 사 와야 하는 구조라 광고비가 계속 높아지는 타입입니다.",
    why: [
      "재방문율: {{revisit_rate_band}} / 고민: {{pain_points}}",
      "재방문이 낮으면 광고는 ‘끝없는 급수’가 됩니다.",
    ],
    rx_72h: [
      "재방문 유도 장치 1개만 즉시 도입(쿠폰/스탬프/단골 혜택 중 하나)",
      "리뷰 답글/공지/이벤트로 최신성 유지(‘다시 가도 뭔가 있네’ 느낌)",
      "메뉴/서비스 표준화 체크(맛이 흔들리면 리텐션은 절대 안 올라갑니다)",
    ],
    rx_14d: [
      "단골이 좋아하는 ‘재구매 메뉴’를 하나 정하고 반복 노출(사진/공지/리뷰)",
      "톡/예약/리마인드로 재방문 동선을 만든다",
    ],
    rx_30d: [
      "재방문율이 오르면, 같은 광고비로도 ‘신규 필요량’이 줄어서 BEP가 쉬워집니다.",
    ],
    recommendedProducts: [
      "추천 1) 30분 상담(45,000): 재방문이 안 되는 ‘핵심 원인 1개’를 잡아야 합니다.",
      "추천 2) 영수증 리뷰(커스텀): 단골이 생기려면 ‘신뢰’부터 쌓여야 합니다.",
      "추천 3) 네이버 플레이스 광고: 신규는 ‘필요만큼만’ 최소 효율로 채우는 용도로.",
    ],
  },
  T8_CHANNEL_IMBALANCE: {
    heroTitle: "{{store_name}} 진단 결과: 채널 편식형",
    heroSubtitle:
      "지금 매출이 한 채널에만 의존해서 변동성이 큰 상태입니다.",
    why: [
      "선택 채널: {{channels}}",
      "요식업은 ‘채널 한 방’이 아니라 ‘2~3개 채널이 동시에 깔리는 구조’가 안정적입니다.",
    ],
    rx_72h: [
      "기존 채널은 유지, 추가 채널 1개만 붙이기(과욕 금지)",
      "플레이스 첫 화면/리뷰/최신성을 먼저 다져서 어디서 유입돼도 전환되게 만들기",
    ],
    rx_14d: [
      "지역형(당근) + 검색형(플레이스/블로그) 조합으로 안정성 확보",
      "체험단은 OSMU로 한 번에 여러 채널에 남도록 설계",
    ],
    rx_30d: ["월말에 ‘어느 채널이 실제 방문을 만들었는지’로 예산을 재배치"],
    recommendedProducts: [
      "추천 1) 네이버 플레이스 광고: 기본 베이스 유입.",
      "추천 2) 당근 광고: 지역 기반에서 가성비 탐색.",
      "추천 3) 인스타+블로그 시딩: 콘텐츠 자산을 동시에 확보.",
    ],
  },
  T9_CONTENT_STUCK: {
    heroTitle: "{{store_name}} 진단 결과: 콘텐츠 생산 정체형",
    heroSubtitle:
      "매장이 나빠서가 아니라, ‘소재 생산/발행 시스템’이 없어서 성장이 멈춘 상태입니다.",
    why: ["고민: {{pain_points}}", "요식업은 콘텐츠가 ‘노출’이자 ‘증거’입니다."],
    rx_72h: [
      "메인메뉴 4컷/내부 2컷/외관 2컷을 ‘기준컷’으로 확보",
      "플레이스 새소식 2개만 올려 최신성 점수부터 회복",
    ],
    rx_14d: [
      "주 2회 발행 템플릿 고정(메뉴/후킹/리뷰/이벤트 반복 구조)",
      "체험단/시딩으로 외부 콘텐츠를 같이 확보",
    ],
    rx_30d: ["반응 좋은 포맷만 남기고 반복(콘텐츠=테스트→부스팅→정착)"],
    recommendedProducts: [
      "추천 1) 인스타+블로그 시딩: 내부에서 만들 시간 없을 때 가장 빠른 콘텐츠 확보.",
      "추천 2) 블로그 체험단: 검색지면 콘텐츠 자산까지 같이 쌓임.",
      "추천 3) 네이버 플레이스 광고: 콘텐츠가 준비되면 집행 효율이 좋아집니다.",
    ],
  },
  T10_DATA_BLIND: {
    heroTitle: "{{store_name}} 진단 결과: 데이터 부재형",
    heroSubtitle:
      "문제는 마케팅이 아니라 ‘측정이 안 돼서’ 개선이 안 쌓이는 상태입니다.",
    why: [
      "재방문/팀수/원가율 같은 핵심 숫자가 흔들리면, 마케팅은 항상 ‘추측’이 됩니다.",
    ],
    rx_72h: [
      "딱 3개 숫자만 고정: (1)일 방문팀 (2)일 매출 (3)원가율",
      "플레이스 인사이트(노출/클릭/길찾기/전화)를 월 1회만이라도 기록",
    ],
    rx_14d: [
      "광고를 한다면 ‘채널별 문의/예약/방문’ 1줄 기록부터 시작",
      "월간 리포트로 ‘한 달에 뭐가 바뀌었는지’가 보이게 만든다",
    ],
    rx_30d: ["데이터가 잡히면, 같은 예산으로도 효율이 올라가고 실수가 줄어듭니다."],
    recommendedProducts: [
      "추천 1) 30분 상담(45,000): 지금 필요한 건 ‘측정 기준’ 설정입니다.",
      "추천 2) 초격차 패키지(299,000): 매장별 KPI/루틴까지 컨설팅 형태로 고정합니다.",
      "추천 3) 네이버 플레이스 광고: 측정이 잡히면 CPC가 ‘관리 가능한 비용’이 됩니다.",
    ],
  },
};

