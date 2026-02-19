import {
  DIAGNOSIS_PRODUCTS,
  DIAGNOSIS_TYPES,
  type DiagnosisProductCode,
  type DiagnosisTypeCode,
} from "@/config/diagnosis";

export type DiagnosisAnswersV12 = {
  storeName?: string;

  businessType:
    | "cafe"
    | "bar"
    | "bbq"
    | "ramen"
    | "korean"
    | "delivery_only"
    | "franchise"
    | "etc";
  operationMode: "hall" | "delivery" | "mixed";
  openAge: "lt_90" | "m3_12" | "gt_12";

  avgTicket: number;
  monthlyFixedCost: number;
  variableRatePercent: number;

  currentMetricMode: "sales" | "teams";
  currentMonthlySales?: number;
  currentMonthlyTeams?: number;

  monthlyAdBudgetRange: "0_30" | "30_100" | "100_200" | "200_plus";
  mainChannels: Array<
    | "place_search"
    | "walk_in"
    | "instagram"
    | "daangn"
    | "referral"
    | "delivery_app"
  >;

  placeThumbnailCtrSelf: 1 | 2 | 3 | 4 | 5;
  reviewsVisitRange: "0_30" | "31_100" | "100_plus";
  reviewsBlogRange: "0_10" | "11_30" | "30_plus";
  hasImpulseScene: boolean;

  // Optional: improve axis scoring confidence without increasing required questions.
  axisAccuracySelf?: 1 | 2 | 3 | 4 | 5;
  axisFreshnessSelf?: 1 | 2 | 3 | 4 | 5;
  axisPopularitySelf?: 1 | 2 | 3 | 4 | 5;
};

export type DiagnosisAxisScores = {
  accuracy: number;
  trust: number;
  freshness: number;
  popularity: number;
  total: number;
};

export type DiagnosisBepMetrics = {
  contributionPerTeam: number | null;
  bepMonthlyTeams: number | null;
  bepDailyTeams: number | null;
  currentMonthlyTeams: number | null;
  risk: "High" | "Mid" | "Low";
};

export type DiagnosisResultV12 = {
  version: 12;
  type: { code: DiagnosisTypeCode; name: string; oneLiner: string };
  scores: DiagnosisAxisScores;
  bep: DiagnosisBepMetrics;
  recommendedProducts: Array<
    DiagnosisProductCode | "PACK_299" | "CONSULT_45"
  >;
  freeActions: string[];
  lockedPreview: string[];
  notes: string[];
};

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function ratingToAxisScore(rating: 1 | 2 | 3 | 4 | 5): number {
  // 1..5 => 0..25
  return clampInt(((rating - 1) / 4) * 25, 0, 25);
}

function safeNumber(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  return input;
}

function calcBep(answers: DiagnosisAnswersV12): DiagnosisBepMetrics {
  const avgTicket = Math.max(0, answers.avgTicket || 0);
  const fixedCost = Math.max(0, answers.monthlyFixedCost || 0);
  const variableRate = Math.max(0, Math.min(0.95, (answers.variableRatePercent || 0) / 100));

  const contribution = avgTicket > 0 ? avgTicket * (1 - variableRate) : 0;
  const contributionPerTeam = contribution > 0 ? contribution : null;

  const bepMonthlyTeams =
    contributionPerTeam && fixedCost > 0 ? fixedCost / contributionPerTeam : null;
  const bepDailyTeams = bepMonthlyTeams ? bepMonthlyTeams / 30 : null;

  let currentTeams: number | null = null;
  if (answers.currentMetricMode === "teams") {
    currentTeams = safeNumber(answers.currentMonthlyTeams) ?? null;
  } else {
    const sales = safeNumber(answers.currentMonthlySales);
    if (sales != null && avgTicket > 0) {
      currentTeams = sales / avgTicket;
    }
  }

  const normalizedCurrent = currentTeams && currentTeams > 0 ? currentTeams : null;

  let risk: DiagnosisBepMetrics["risk"] = "Mid";
  if (bepMonthlyTeams && normalizedCurrent) {
    risk = normalizedCurrent < bepMonthlyTeams ? "High" : "Low";
  } else if (bepMonthlyTeams && !normalizedCurrent) {
    risk = "Mid";
  }

  return {
    contributionPerTeam,
    bepMonthlyTeams: bepMonthlyTeams ? Math.max(0, bepMonthlyTeams) : null,
    bepDailyTeams: bepDailyTeams ? Math.max(0, bepDailyTeams) : null,
    currentMonthlyTeams: normalizedCurrent,
    risk,
  };
}

function calcAxisScores(answers: DiagnosisAnswersV12): DiagnosisAxisScores {
  const accuracy =
    answers.axisAccuracySelf != null
      ? ratingToAxisScore(answers.axisAccuracySelf)
      : 15;

  const freshness =
    answers.axisFreshnessSelf != null
      ? ratingToAxisScore(answers.axisFreshnessSelf)
      : answers.openAge === "lt_90"
        ? 17
        : answers.openAge === "m3_12"
          ? 13
          : 11;

  const popularityFromBudget: Record<DiagnosisAnswersV12["monthlyAdBudgetRange"], number> = {
    "0_30": 10,
    "30_100": 13,
    "100_200": 17,
    "200_plus": 20,
  };
  const popularityBase =
    answers.axisPopularitySelf != null
      ? ratingToAxisScore(answers.axisPopularitySelf)
      : popularityFromBudget[answers.monthlyAdBudgetRange] +
        (answers.mainChannels.includes("place_search") ? 2 : 0) +
        (answers.mainChannels.includes("referral") ? 1 : 0);
  const popularity = clampInt(popularityBase, 0, 25);

  const trustVisit: Record<DiagnosisAnswersV12["reviewsVisitRange"], number> = {
    "0_30": 8,
    "31_100": 13,
    "100_plus": 18,
  };
  const trustBlog: Record<DiagnosisAnswersV12["reviewsBlogRange"], number> = {
    "0_10": 4,
    "11_30": 7,
    "30_plus": 10,
  };
  const trustBase =
    trustVisit[answers.reviewsVisitRange] +
    trustBlog[answers.reviewsBlogRange] +
    (answers.placeThumbnailCtrSelf >= 4 ? 1 : 0);
  const trust = clampInt(trustBase, 0, 25);

  const total = clampInt(accuracy + trust + freshness + popularity, 0, 100);
  return { accuracy, trust, freshness, popularity, total };
}

function pickType(
  answers: DiagnosisAnswersV12,
  bep: DiagnosisBepMetrics,
): DiagnosisTypeCode {
  const isNewOpen = answers.openAge === "lt_90";
  const isDelivery = answers.operationMode === "delivery";
  const isFranchise = answers.businessType === "franchise";

  const impulseHigh = answers.hasImpulseScene;
  const ctr = answers.placeThumbnailCtrSelf;
  const reviewsWeak =
    answers.reviewsVisitRange === "0_30" || answers.reviewsBlogRange === "0_10";
  const searchHeavy = answers.mainChannels.includes("place_search");

  // Priority gates.
  if (bep.risk === "High") return "T04";
  if (isNewOpen) return "T10";
  if (isDelivery || answers.businessType === "delivery_only") return "T08";

  if (impulseHigh) {
    if (ctr <= 2) return "T02";
    if (ctr >= 4) return "T01";
  }

  if (searchHeavy) {
    if (reviewsWeak) return "T06";
    return "T05";
  }

  if (isFranchise) return "T09";

  // If they chose many channels but the core bottleneck is unclear, treat as mix issue.
  if (answers.mainChannels.length >= 3) return "T07";

  return impulseHigh ? "T07" : "T03";
}

function buildFreeActions(typeCode: DiagnosisTypeCode, answers: DiagnosisAnswersV12): string[] {
  // Keep these action lines practical and short (mobile-first).
  switch (typeCode) {
    case "T01":
      return [
        "대표사진 5장 구성 리셋: 메인 1 + 메뉴 2 + 내부 1 + 외부간판 1",
        "플레이스 외부 채널(인스타/블로그) 연결 + 링크 유입 동선 만들기",
        "지역 타겟 매체 1개만 2주 테스트(소재 2종 A/B)",
      ];
    case "T02":
      return [
        "대표사진 ‘한 장’부터 교체(클릭률이 가장 빨리 움직임)",
        "상세설명 1문단을 ‘장점+숫자+대상’ 구조로 재작성",
        "메뉴/가격 정보 누락 체크(정확도 점수 안정화)",
      ];
    case "T03":
      return [
        "‘시그니처 한 장면’ 만들기(플레이팅/세트/퍼포먼스/이벤트)",
        "그 한 문장(USP)으로 사진/설명/키워드 메시지를 통일",
        "2주 뒤 채널 테스트(당근/플레이스 중 1개)로 증폭",
      ];
    case "T04":
      return [
        "BEP(손익분기) 계산 후 ‘하루 최소 팀수/매출’ 목표 고정",
        "메뉴 엔지니어링: 마진/회전/세트 구성 재정리",
        "광고는 ‘BEP 넘기는 채널 1개’만 최소로 운영",
      ];
    case "T05":
      return [
        "대표키워드 5개 설계(핵심/롱테일/브랜드 분리)",
        "찾아오는 길: 역/랜드마크/주차 정보 강화",
        "상세설명 500자 이상 + 1문단 장점, 2문단부터 키워드 확장",
      ];
    case "T06":
      return [
        "리뷰 요청 동선(안내문/QR)을 ‘정상 운영’으로 설계",
        "악성 리뷰 대응 템플릿 구축(감정 대응 금지)",
        "사진 포함 리뷰 비율 올리기(방문 증거 강화)",
      ];
    case "T07":
      return [
        "유입 구조 판정(검색형 vs 충동형) 후 주력 채널 1개로 집중",
        "2주 단위로 A/B(소재/키워드/타겟) 테스트",
        "채널별 CPA를 표로 기록해 ‘새는 구간’을 제거",
      ];
    case "T08":
      return [
        "배달용 메뉴판(마진/회전) 재구성 후 대표 메뉴 고정",
        "플레이스는 ‘브랜드 신뢰/지도 유입’ 최소 세팅으로 유지",
        "홀 유입이 필요하면 근거리 채널 1개만 테스트",
      ];
    case "T09":
      return [
        "‘맛집’ 대신 상황 키워드로 포지셔닝(혼밥/회식/가족/주차)",
        "플레이스 정보 정확도/주차/대기/찾아오는 길 극대화",
        "롱테일 지면 장악용 콘텐츠 3개만 빠르게 확보",
      ];
    case "T10":
      return [
        "오픈 14일: 사진/공지/이벤트를 촘촘히 업데이트(최신성)",
        "저장/리뷰 동선을 정상 고객 기반으로 설계",
        "첫 달은 ‘콘텐츠 → 전환 → 리뷰’ 루프 만들기",
      ];
    default:
      return [];
  }
}

function buildLockedPreview(typeCode: DiagnosisTypeCode): string[] {
  // Preview lines displayed under a paywall (blurred).
  switch (typeCode) {
    case "T04":
      return [
        "BEP표 + 광고비 상한(CPA) 계산",
        "메뉴 엔지니어링(마진/회전) 우선순위 표",
        "30일 실행 플랜(주차별 To-Do)",
      ];
    case "T02":
      return [
        "대표사진(썸네일) 3종 템플릿 + 촬영/편집 체크리스트",
        "상세설명/공지/이벤트 문구 템플릿",
        "30일 전환 개선 플랜(주차별 To-Do)",
      ];
    default:
      return [
        "30일 처방전(주차별 To-Do)",
        "우리 매장 키워드 맵(핵심/롱테일/상황 키워드)",
        "광고 예산표(최대 CPA/BEP 기준)",
      ];
  }
}

function pickOffers(typeCode: DiagnosisTypeCode): DiagnosisProductCode[] {
  const offers = DIAGNOSIS_TYPES[typeCode].primaryOffers;
  // Ensure the products exist (defensive).
  return offers.filter((code) => DIAGNOSIS_PRODUCTS[code] != null);
}

export function evaluateDiagnosisV12(answers: DiagnosisAnswersV12): DiagnosisResultV12 {
  const bep = calcBep(answers);
  const typeCode = pickType(answers, bep);
  const type = DIAGNOSIS_TYPES[typeCode];
  const scores = calcAxisScores(answers);

  const seedOffers: DiagnosisProductCode[] = [
    "PACK_299",
    "CONSULT_45",
    ...pickOffers(typeCode),
  ];
  const recommendedProducts: DiagnosisProductCode[] = Array.from(
    new Set<DiagnosisProductCode>(seedOffers),
  );

  const notes: string[] = [];
  if (
    answers.axisAccuracySelf == null ||
    answers.axisFreshnessSelf == null ||
    answers.axisPopularitySelf == null
  ) {
    notes.push("일부 점수는 입력값 기반 ‘추정’이며, 캡처/데이터가 있으면 더 정확해집니다.");
  }
  if (bep.contributionPerTeam == null) {
    notes.push("객단가/변동비율 입력값을 확인해 주세요. 공헌이익이 0에 가까우면 BEP 계산이 어렵습니다.");
  }

  return {
    version: 12,
    type: { code: typeCode, name: type.name, oneLiner: type.oneLiner },
    scores,
    bep,
    recommendedProducts,
    freeActions: buildFreeActions(typeCode, answers),
    lockedPreview: buildLockedPreview(typeCode),
    notes,
  };
}

export function formatCurrencyKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}
