export type DiagnosisTypeCode =
  | "T01"
  | "T02"
  | "T03"
  | "T04"
  | "T05"
  | "T06"
  | "T07"
  | "T08"
  | "T09"
  | "T10";

export type DiagnosisProductCode =
  | "PACK_299"
  | "CONSULT_45"
  | "DAANGN_AD"
  | "NAVER_PLACE_AD"
  | "NAVER_POWERLINK_AD"
  | "RECEIPT_REVIEW"
  | "BLOG_EXPERIENCE"
  | "PLACE_TOP_GUARANTEE"
  | "SEEDING";

export const DIAGNOSIS_PRODUCTS: Record<
  DiagnosisProductCode,
  {
    name: string;
    pricingType: "fixed" | "quote";
    price?: number;
    meta?: Record<string, unknown>;
  }
> = {
  PACK_299: {
    name: "초격차 패키지",
    pricingType: "fixed",
    price: 299000,
    meta: {
      includes: [
        "사전 진단",
        "사진 분석",
        "BEP/광고예산표",
        "30일 실행 플랜",
        "썸네일 3종 가이드",
      ],
    },
  },
  CONSULT_45: {
    name: "30분 상담",
    pricingType: "fixed",
    price: 45000,
    meta: { minutes: 30 },
  },
  NAVER_PLACE_AD: {
    name: "네이버 플레이스 광고",
    pricingType: "fixed",
    price: 149000,
    meta: { billing: "월 관리비 + CPC 별도" },
  },
  NAVER_POWERLINK_AD: {
    name: "네이버 파워링크 광고",
    pricingType: "fixed",
    price: 149000,
    meta: { billing: "월 관리비 + CPC 별도" },
  },
  DAANGN_AD: {
    name: "당근 광고",
    pricingType: "fixed",
    price: 149000,
    meta: { billing: "월 관리비 + CPC 별도" },
  },
  RECEIPT_REVIEW: { name: "영수증 리뷰", pricingType: "quote" },
  BLOG_EXPERIENCE: { name: "블로그 체험단", pricingType: "quote" },
  PLACE_TOP_GUARANTEE: { name: "플레이스 상위노출 보장(25일)", pricingType: "quote" },
  SEEDING: { name: "시딩/체험단(UGC)", pricingType: "quote" },
};

export const DIAGNOSIS_TYPES: Record<
  DiagnosisTypeCode,
  {
    name: string;
    oneLiner: string;
    primaryOffers: DiagnosisProductCode[];
    copyKey:
      | "reach_boost"
      | "conversion_fix"
      | "hook_plan"
      | "bep_risk"
      | "seo_setup"
      | "trust_fix"
      | "mix_fix"
      | "delivery_split"
      | "competition"
      | "launch";
  }
> = {
  T01: {
    name: "충동형-노출부족",
    oneLiner: "콘텐츠/메뉴는 좋은데 ‘도달(조회수)’이 부족합니다.",
    primaryOffers: ["DAANGN_AD", "NAVER_PLACE_AD", "SEEDING"],
    copyKey: "reach_boost",
  },
  T02: {
    name: "전환부족-썸네일병목",
    oneLiner: "노출은 있는데 클릭/방문 전환이 낮습니다.",
    primaryOffers: ["RECEIPT_REVIEW", "BLOG_EXPERIENCE", "PLACE_TOP_GUARANTEE"],
    copyKey: "conversion_fix",
  },
  T03: {
    name: "후킹(USP) 기획형",
    oneLiner: "사진을 찍어도 임팩트가 약해, ‘한 장면’ 기획이 먼저입니다.",
    primaryOffers: ["PACK_299"],
    copyKey: "hook_plan",
  },
  T04: {
    name: "BEP(손익) 위험형",
    oneLiner: "마케팅보다 ‘수익구조’가 먼저입니다. BEP를 넘기는 구조로 재설계가 필요합니다.",
    primaryOffers: ["PACK_299"],
    copyKey: "bep_risk",
  },
  T05: {
    name: "검색형-SEO 세팅 부족",
    oneLiner: "검색 수요는 있는데 키워드/설명/세팅이 약합니다.",
    primaryOffers: ["NAVER_POWERLINK_AD", "PLACE_TOP_GUARANTEE"],
    copyKey: "seo_setup",
  },
  T06: {
    name: "신뢰(리뷰) 부족형",
    oneLiner: "검색/조회는 되는데 리뷰/신뢰가 약해서 결정이 안 납니다.",
    primaryOffers: ["RECEIPT_REVIEW", "BLOG_EXPERIENCE"],
    copyKey: "trust_fix",
  },
  T07: {
    name: "매체 믹스 오류형",
    oneLiner: "채널-상품 적합도가 어긋나 효율이 새고 있습니다.",
    primaryOffers: ["PACK_299", "NAVER_PLACE_AD", "DAANGN_AD"],
    copyKey: "mix_fix",
  },
  T08: {
    name: "배달 중심 분리 설계형",
    oneLiner: "배달/방문 동선이 분리돼야 성과가 안정됩니다.",
    primaryOffers: ["PACK_299", "DAANGN_AD"],
    copyKey: "delivery_split",
  },
  T09: {
    name: "경쟁 과열(차별화 제한)형",
    oneLiner: "‘맛집’ 경쟁 대신 상황 키워드/운영 강점으로 포지셔닝해야 합니다.",
    primaryOffers: ["PLACE_TOP_GUARANTEE", "NAVER_POWERLINK_AD"],
    copyKey: "competition",
  },
  T10: {
    name: "신규 오픈/리뉴얼 런치형",
    oneLiner: "오픈 90일은 지표를 쌓는 속도가 승부입니다.",
    primaryOffers: ["NAVER_PLACE_AD", "DAANGN_AD", "SEEDING"],
    copyKey: "launch",
  },
};

