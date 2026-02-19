import type { AspectRatio } from "@/lib/layoutSchema";

export type CopyConstraints = {
  headlineMaxChars: number;
  subMaxChars: number;
  ctaMaxChars: number;
};

export type CopyGeneratorInput = {
  aspectRatio: AspectRatio;
  objective: string;
  audience: string;
  usp: string;
  offer?: string;
  proof?: string;
  preferredCta?: string;
  brandVoiceKeywords?: string[];
};

export type CopyVariants = {
  headlines: string[];
  subs: string[];
  ctas: string[];
};

function norm(s: string | undefined): string {
  return (s ?? "").trim();
}

function uniqKeepOrder(items: string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    const v = item.trim();
    if (!v) continue;
    if (out.includes(v)) continue;
    out.push(v);
  }
  return out;
}

function cutToMaxChars(input: string, maxChars: number): string {
  const t = input.trim();
  if (!t) return "";
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).trim();
}

function compactKorean(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/(지금|바로|즉시)\s*/g, "")
    .replace(/(최고|완벽|대박)\s*/g, "")
    .trim();
}

function classifyIntent(text: string): "buy" | "lead" | "traffic" | "app_install" | "unknown" {
  const t = text.toLowerCase();
  if (/(설치|다운로드|앱|app|install|download)/.test(t)) return "app_install";
  if (/(구매|주문|결제|장바구니|buy|purchase|order)/.test(t)) return "buy";
  if (/(상담|문의|예약|견적|리드|lead|consult)/.test(t)) return "lead";
  if (/(유입|방문|노출|조회|트래픽|traffic|visit|click)/.test(t)) return "traffic";
  return "unknown";
}

export function constraintsForAspectRatio(aspectRatio: AspectRatio): CopyConstraints {
  // Practical defaults for ko-KR (tight to reduce overflow risk).
  if (aspectRatio === "9:16") {
    return { headlineMaxChars: 22, subMaxChars: 40, ctaMaxChars: 10 };
  }
  if (aspectRatio === "4:5") {
    return { headlineMaxChars: 20, subMaxChars: 36, ctaMaxChars: 10 };
  }
  return { headlineMaxChars: 18, subMaxChars: 32, ctaMaxChars: 9 };
}

export function generateCopyVariants(input: CopyGeneratorInput): CopyVariants {
  const c = constraintsForAspectRatio(input.aspectRatio);

  const objective = norm(input.objective);
  const audience = norm(input.audience);
  const usp = norm(input.usp);
  const offer = norm(input.offer);
  const proof = norm(input.proof);
  const preferredCta = norm(input.preferredCta);
  const voice = (input.brandVoiceKeywords ?? []).map((x) => x.trim()).filter(Boolean);

  const tone = voice.slice(0, 2).join(" · ");
  const tonePrefix = tone ? `${tone} ` : "";

  const uspCore = usp || "핵심 혜택을 한 문장으로";
  const offerCore = offer ? `(${offer})` : "";
  const proofCore = proof ? `${proof}` : "";

  const intent = classifyIntent(objective) !== "unknown" ? classifyIntent(objective) : classifyIntent(preferredCta);

  const headlineCandidates = uniqKeepOrder([
    `${tonePrefix}${uspCore}`,
    `${uspCore} ${offerCore}`.trim(),
    `${audience ? `${audience}를 위한 ` : ""}${uspCore}`.trim(),
    `${offer ? `${offer} | ` : ""}${uspCore}`.trim(),
    `${uspCore} 지금 확인`.trim(),
    `${uspCore} 빠르게 해결`.trim(),
  ]).map((x) => cutToMaxChars(compactKorean(x), c.headlineMaxChars));

  const subCandidates = uniqKeepOrder([
    proofCore,
    offer ? `지금 신청하면 ${offer}` : "",
    audience ? `${audience}에게 딱 맞는 이유를 확인하세요.` : "지금 바로 핵심 포인트를 확인하세요.",
    proof ? `근거: ${proof}` : "",
  ])
    .map((x) => cutToMaxChars(compactKorean(x), c.subMaxChars))
    .filter(Boolean);

  const ctaByIntent: Record<string, string[]> = {
    buy: ["지금 구매", "혜택 받기", "장바구니 담기"],
    lead: ["상담 신청", "문의하기", "예약하기"],
    traffic: ["자세히 보기", "더 알아보기", "지금 확인"],
    app_install: ["지금 설치", "다운로드", "앱 열기"],
    unknown: ["자세히 보기", "지금 확인", "더 알아보기"],
  };

  const ctaCandidates = uniqKeepOrder([
    preferredCta,
    ...(ctaByIntent[intent] ?? ctaByIntent.unknown),
  ])
    .map((x) => cutToMaxChars(compactKorean(x), c.ctaMaxChars))
    .filter(Boolean);

  return {
    headlines: headlineCandidates.slice(0, 5),
    subs: subCandidates.slice(0, 3),
    ctas: ctaCandidates.slice(0, 3),
  };
}

