export type BriefDoctorInput = {
  objective: string;
  audience: string;
  usp: string;
  offer?: string;
  proof?: string;
  cta: string;
  brandVoiceKeywords?: string[];
};

export type BriefDoctorResult = {
  score: number; // 0..100
  warnings: string[];
  questionsToAsk: string[];
  suggestedImprovements: string[];
};

function norm(input: string | undefined): string {
  return (input ?? "").trim();
}

function classifyIntent(text: string): "buy" | "lead" | "traffic" | "app_install" | "unknown" {
  const t = text.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  if (has(/(설치|다운로드|앱|app|install|download)/)) return "app_install";
  if (has(/(구매|주문|결제|장바구니|buy|purchase|order)/)) return "buy";
  if (has(/(상담|문의|예약|견적|리드|lead|consult)/)) return "lead";
  if (has(/(유입|방문|노출|조회|트래픽|traffic|visit|click)/)) return "traffic";
  return "unknown";
}

function looksVague(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length <= 6) return true;
  return /(좋은|최고|완벽|대박|성장|매출|홍보|마케팅|브랜딩|올리기|늘리기)/.test(t);
}

function hasOfferNumber(text: string): boolean {
  return /(\d+%|\d+원|\d+일|\d+주|\d+개월|\d+\s?배)/.test(text);
}

function hasOfferCondition(text: string): boolean {
  return /(오늘|이번주|한정|선착순|마감|까지|내일|기간|조건|최대|최소)/.test(text);
}

export function runBriefDoctor(input: BriefDoctorInput): BriefDoctorResult {
  const objective = norm(input.objective);
  const audience = norm(input.audience);
  const usp = norm(input.usp);
  const offer = norm(input.offer);
  const proof = norm(input.proof);
  const cta = norm(input.cta);
  const voice = (input.brandVoiceKeywords ?? []).map((x) => x.trim()).filter(Boolean);

  let score = 100;
  const warnings: string[] = [];
  const questionsToAsk: string[] = [];
  const suggestedImprovements: string[] = [];

  if (!objective) {
    score -= 30;
    warnings.push("목표(Objective)가 비어있습니다.");
    questionsToAsk.push("이번 광고의 1순위 목표는 무엇인가요? (구매/상담/예약/설치/유입 중 택1)");
  } else if (looksVague(objective)) {
    score -= 10;
    warnings.push("목표가 다소 추상적입니다. 행동 단위로 좁히면 전환이 좋아집니다.");
    suggestedImprovements.push('목표를 "무엇을 하게 만들 것인지"로 구체화하세요. 예: "첫 구매 유도", "무료 상담 신청", "앱 설치"');
  }

  if (!audience) {
    score -= 15;
    warnings.push("타겟(Audience)이 비어있습니다.");
    questionsToAsk.push("누구에게 파는 건가요? (지역/상황/직업/문제/니즈로 1문장)");
  } else if (looksVague(audience)) {
    score -= 6;
    warnings.push("타겟이 넓습니다. 상황/문제 기반으로 좁히면 카피가 강해집니다.");
    suggestedImprovements.push('타겟을 "상황+문제"로 좁혀보세요. 예: "퇴근 후 빠르게 한끼 해결하려는 직장인"');
  }

  if (!usp) {
    score -= 25;
    warnings.push("USP(핵심 소구점)가 비어있습니다.");
    questionsToAsk.push("경쟁 대비 딱 하나, 왜 당신이어야 하나요? (속도/가격/품질/후기/보장/특허/성분 등)");
  } else if (looksVague(usp)) {
    score -= 10;
    warnings.push("USP가 다소 뻔합니다. 숫자/근거/차별 포인트를 붙이면 설득력이 올라갑니다.");
    suggestedImprovements.push('USP에 "숫자/근거"를 붙여보세요. 예: "30일 환불 보장", "10분 완성", "누적 3,000건"');
  }

  if (!cta) {
    score -= 20;
    warnings.push("CTA가 비어있습니다.");
    suggestedImprovements.push('CTA는 목표에 맞춰 "행동"이 보이게 쓰세요. 예: "지금 구매", "무료 상담 신청", "예약하기"');
  }

  const objectiveIntent = classifyIntent(objective);
  const ctaIntent = classifyIntent(cta);
  if (objective && cta && objectiveIntent !== "unknown" && ctaIntent !== "unknown" && objectiveIntent !== ctaIntent) {
    score -= 10;
    warnings.push("목표(Objective)와 CTA가 서로 다른 행동을 요구하고 있습니다.");
    suggestedImprovements.push("목표와 CTA를 같은 행동으로 정렬하세요. (예: 목표=상담 → CTA=상담 신청)");
  }

  if (offer) {
    if (hasOfferNumber(offer) && !hasOfferCondition(offer)) {
      score -= 6;
      warnings.push("오퍼(Offer)에 조건/기간이 부족합니다. 제한 조건이 있으면 긴급성이 올라갑니다.");
      questionsToAsk.push('오퍼의 조건은 무엇인가요? 예: "오늘까지", "선착순 100명", "첫 구매 한정"');
    }
  } else if (objectiveIntent === "buy" || objectiveIntent === "lead") {
    score -= 5;
    warnings.push("오퍼(Offer)가 비어있습니다. 작은 혜택이라도 있으면 클릭률이 올라갑니다.");
    suggestedImprovements.push('오퍼를 추가해보세요. 예: "첫 구매 10% 할인", "무료 체험", "배송비 무료"');
  }

  if (!proof && (objectiveIntent === "buy" || objectiveIntent === "lead")) {
    score -= 5;
    warnings.push("증거(Proof)가 비어있습니다. 리뷰/수치/인증은 전환을 크게 올립니다.");
    suggestedImprovements.push('증거를 추가해보세요. 예: "평점 4.9", "누적 10,000명", "전문가 추천"');
  }

  if (voice.length === 0) {
    suggestedImprovements.push("브랜드 보이스 키워드를 3개만 넣어도 톤이 일관돼 보입니다. 예: 프리미엄/미니멀/직설");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, warnings, questionsToAsk, suggestedImprovements };
}

