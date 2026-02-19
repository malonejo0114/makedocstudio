import "server-only";

import {
  buildStudioAnalyzePrompt,
  buildStudioNoReferenceConceptPrompt,
  normalizeKoreanTextLengthWarnings,
  normalizeCopyToggles,
} from "@/lib/studio/promptBuilders.server";
import type {
  CopyToggles,
  PromptTextStyleControls,
  ProductContext,
  ReferenceAnalysis,
  TextEffectTone,
  TextFontStyleTone,
  StudioPromptDraft,
  StudioPromptRole,
} from "@/lib/studio/types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function requireGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }
  return key;
}

function parseJsonSafe(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stripCodeFence(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? raw.trim();
}

function tryParseJson<T>(raw: string): T | null {
  const normalized = stripCodeFence(raw);
  try {
    return JSON.parse(normalized) as T;
  } catch {
    return null;
  }
}

function extractTextFromGemini(json: any): string {
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  const texts = candidates.flatMap((candidate: any) => {
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    return parts
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean);
  });
  return texts.join("\n").trim();
}

export type InlineData = {
  mimeType: string;
  data: string;
};

async function toInlineDataFromUrl(imageUrl: string): Promise<InlineData> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("레퍼런스 이미지를 읽지 못했습니다.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") || "image/png";
  return {
    mimeType,
    data: Buffer.from(arrayBuffer).toString("base64"),
  };
}

async function callGeminiModel(model: string, payload: unknown) {
  const apiKey = requireGeminiApiKey();
  const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  const json = parseJsonSafe(raw);
  if (!response.ok) {
    const detail =
      (json as any)?.error?.message ||
      `Gemini 요청이 실패했습니다. (${response.status})`;
    throw new Error(String(detail));
  }

  if (!json) {
    throw new Error("Gemini 응답을 JSON으로 해석하지 못했습니다.");
  }

  return json;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeBox(value: unknown): [number, number, number, number] {
  const fallback: [number, number, number, number] = [0.08, 0.08, 0.74, 0.2];
  if (!Array.isArray(value) || value.length !== 4) {
    return fallback;
  }
  const parsed = value.map((item) => Number(item));
  if (parsed.some((item) => !Number.isFinite(item))) {
    return fallback;
  }
  return [
    clamp01(parsed[0]),
    clamp01(parsed[1]),
    clamp01(parsed[2]),
    clamp01(parsed[3]),
  ];
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function ensureText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeRole(value: unknown, fallback: StudioPromptRole): StudioPromptRole {
  if (value === "PLANNER" || value === "MARKETER" || value === "DESIGNER") {
    return value;
  }
  return fallback;
}

function normalizeTemplateIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "templateId" in item) {
        return String((item as { templateId?: string }).templateId ?? "").trim();
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 6);
}

function boxFromSlot(slots: any[], ids: string[], fallback: [number, number, number, number]) {
  const slot =
    slots.find((item) => typeof item?.id === "string" && ids.includes(String(item.id))) ?? null;
  if (!slot) return fallback;
  const raw = [slot.x, slot.y, slot.w, slot.h];
  return normalizeBox(raw);
}

function fallbackAnalysis(productContext: ProductContext): {
  analysis: ReferenceAnalysis;
  prompts: StudioPromptDraft[];
} {
  const name = productContext.productName?.trim() || "제품";

  return {
    analysis: {
      layoutBBoxes: {
        headline: [0.08, 0.1, 0.72, 0.2],
        subhead: [0.08, 0.33, 0.6, 0.14],
        product: [0.58, 0.12, 0.32, 0.55],
        cta: [0.08, 0.78, 0.28, 0.12],
      },
      palette: ["#0B0B0C", "#F5F5F0", "#D6FF4F"],
      moodKeywords: ["미니멀", "하이엔드", "전환 중심"],
      hookPattern: "PREMIUM_POSITIONING",
      typographyStyle: "MODERN_GROTESK",
      readabilityWarnings: ["헤드라인 길이를 18자 이내로 유지하세요."],
      strongPoints: [
        "강한 명도 대비로 시선 집중",
        "CTA 주변 여백으로 클릭 유도",
        "제품/메시지 분리로 정보 위계 확보",
      ],
    },
    prompts: [
      {
        id: "planner",
        role: "PLANNER",
        title: "세계 최고의 기획자 시선",
        copy: {
          headline: `${name} 한 장으로 전환 설계`,
          subhead: "고객 맥락에 맞는 메시지 구조를 즉시 제안합니다.",
          cta: "지금 시작",
          badges: ["기획 관점", "전환 구조"],
        },
        visual: {
          scene: "premium hero product shot",
          composition: "left text zone + right hero object",
          style: "minimal luxury editorial",
          lighting: "soft directional light",
          colorPaletteHint: "off-white + near black + neon lime accent",
          negative: "watermark, random text, logo, cluttered background",
        },
        generationHints: {
          aspectRatioDefault: "1:1",
          textModeDefault: "minimal_text",
          textStyle: {
            headline: { fontTone: "auto", effectTone: "auto" },
            subhead: { fontTone: "auto", effectTone: "auto" },
            cta: { fontTone: "auto", effectTone: "auto" },
            badge: { fontTone: "auto", effectTone: "auto" },
          },
        },
      },
      {
        id: "marketer",
        role: "MARKETER",
        title: "퍼포먼스 마케터 시선",
        copy: {
          headline: `${name} 성과를 더 빠르게`,
          subhead: "후킹 카피와 CTA를 성과형 크리에이티브로 최적화합니다.",
          cta: "성과 확인",
          badges: ["ROAS 집중", "AB 테스트"],
        },
        visual: {
          scene: "high-contrast campaign visual",
          composition: "funnel-driven hierarchy with clear CTA anchor",
          style: "performance ad creative",
          lighting: "clean studio light",
          colorPaletteHint: "black and white base + lime CTA accent",
          negative: "watermark, noisy typography, excessive elements",
        },
        generationHints: {
          aspectRatioDefault: "4:5",
          textModeDefault: "minimal_text",
          textStyle: {
            headline: { fontTone: "auto", effectTone: "auto" },
            subhead: { fontTone: "auto", effectTone: "auto" },
            cta: { fontTone: "auto", effectTone: "auto" },
            badge: { fontTone: "auto", effectTone: "auto" },
          },
        },
      },
      {
        id: "designer",
        role: "DESIGNER",
        title: "디자이너 시선",
        copy: {
          headline: `${name} 비주얼 임팩트 강화`,
          subhead: "레이아웃, 타이포, 색채 리듬을 균형 있게 구성합니다.",
          cta: "디자인 적용",
          badges: ["디자인 시스템", "브랜드 톤"],
        },
        visual: {
          scene: "3D metallic wave abstract stage",
          composition: "asymmetric premium layout",
          style: "neo-minimal 3d art direction",
          lighting: "volumetric and glossy highlights",
          colorPaletteHint: "graphite black + off-white + neon lime",
          negative: "cheap stock look, visual artifacts, logo watermark",
        },
        generationHints: {
          aspectRatioDefault: "9:16",
          textModeDefault: "minimal_text",
          textStyle: {
            headline: { fontTone: "auto", effectTone: "auto" },
            subhead: { fontTone: "auto", effectTone: "auto" },
            cta: { fontTone: "auto", effectTone: "auto" },
            badge: { fontTone: "auto", effectTone: "auto" },
          },
        },
      },
    ],
  };
}

type AnalyzeResponseRaw = {
  version?: string;
  analysis?: any;
  prompts?: any[];
  summary?: any;
  layoutMap?: any;
  styleTokens?: any;
  threePrompts?: any[];
  referenceInsights?: any;
  personas?: any[];
  missingInputs?: any[];
  recommendedTemplates?: any[];
};

function ensureRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizePersonaId(value: unknown): "planner" | "designer" | "performance" {
  const normalized = ensureText(value).toLowerCase();
  if (normalized === "designer") return "designer";
  if (normalized === "performance" || normalized === "marketer") return "performance";
  return "planner";
}

function roleFromPersonaLike(value: Record<string, unknown>): StudioPromptRole {
  const id = ensureText(value.id ?? value.persona).toLowerCase();
  if (id === "designer") return "DESIGNER";
  if (id === "performance" || id === "marketer") return "MARKETER";

  const title = ensureText(value.title).toLowerCase();
  if (title.includes("디자이너")) return "DESIGNER";
  if (title.includes("퍼포먼스") || title.includes("마케터")) return "MARKETER";
  return "PLANNER";
}

function normalizeWhyBlock(value: unknown) {
  const source = ensureRecord(value);
  return {
    observations: ensureStringArray(source.observations).slice(0, 6),
    interpretation: ensureStringArray(source.interpretation).slice(0, 5),
    decisions: ensureStringArray(source.decisions).slice(0, 6),
    risks: ensureStringArray(source.risks).slice(0, 4),
  };
}

function normalizeValidationBlock(value: unknown) {
  const source = ensureRecord(value);
  return {
    mustPass: ensureStringArray(source.mustPass).slice(0, 8),
    autoFixRules: ensureStringArray(source.autoFixRules).slice(0, 8),
  };
}

function normalizeTextStyleSlot(value: unknown): {
  fontTone: TextFontStyleTone;
  effectTone: TextEffectTone;
} {
  const source = ensureRecord(value);
  const fontToneRaw = ensureText(source.fontTone).toLowerCase();
  const effectToneRaw = ensureText(source.effectTone).toLowerCase();
  const fontTone: TextFontStyleTone =
    fontToneRaw === "gothic" ||
    fontToneRaw === "myeongjo" ||
    fontToneRaw === "rounded" ||
    fontToneRaw === "calligraphy"
      ? (fontToneRaw as "gothic" | "myeongjo" | "rounded" | "calligraphy")
      : "auto";
  const effectTone: TextEffectTone =
    effectToneRaw === "clean" ||
    effectToneRaw === "shadow" ||
    effectToneRaw === "outline" ||
    effectToneRaw === "emboss" ||
    effectToneRaw === "bubble"
      ? (effectToneRaw as "clean" | "shadow" | "outline" | "emboss" | "bubble")
      : "auto";
  return { fontTone, effectTone };
}

function normalizePromptTextStyle(value: unknown): PromptTextStyleControls {
  const source = ensureRecord(value);
  return {
    headline: normalizeTextStyleSlot(source.headline),
    subhead: normalizeTextStyleSlot(source.subhead),
    cta: normalizeTextStyleSlot(source.cta),
    badge: normalizeTextStyleSlot(source.badge),
  };
}

const VALIDATION_LABEL_MAP: Record<string, string> = {
  korean_text_exact: "한글 텍스트 오탈자 없음",
  style_match_high: "레퍼런스 스타일 매칭 높음",
  contrast_ok: "텍스트 대비 양호",
  safe_zone_ok: "세이프존 준수",
  no_watermark: "워터마크/랜덤 로고 없음",
  readability_ok: "가독성 확보",
};

const AUTO_FIX_LABEL_MAP: Record<string, string> = {
  increase_headline_size: "헤드라인 크기 확대",
  reduce_subtext_length: "서브카피 길이 축소",
  simplify_background_behind_text: "텍스트 뒤 배경 단순화",
  increase_contrast: "텍스트 대비 강화",
  tighten_layout: "레이아웃 밀도 조정",
};

function localizeChecklistItems(items: string[], kind: "mustPass" | "autoFixRules") {
  const labelMap = kind === "mustPass" ? VALIDATION_LABEL_MAP : AUTO_FIX_LABEL_MAP;
  return items
    .map((item) => {
      const normalized = item.trim().toLowerCase();
      return labelMap[normalized] ?? item.trim();
    })
    .filter(Boolean)
    .slice(0, 8);
}

function buildReferenceEvidence(input: {
  referenceInsights: Record<string, unknown>;
  analysis: ReferenceAnalysis;
}) {
  const visualFacts = ensureRecord(input.referenceInsights.visualFacts);
  const persuasionFacts = ensureRecord(input.referenceInsights.persuasionFacts);
  const channelRisk = ensureRecord(input.referenceInsights.channelRisk);
  const typographyStyle = ensureRecord(visualFacts.typographyStyle);

  const evidences = [
    ensureStringArray(visualFacts.palette).length > 0
      ? `팔레트: ${ensureStringArray(visualFacts.palette).slice(0, 4).join(" / ")}`
      : "",
    ensureStringArray(visualFacts.layoutFlow).length > 0
      ? `시선 흐름: ${ensureStringArray(visualFacts.layoutFlow).slice(0, 4).join(" → ")}`
      : "",
    ensureStringArray(visualFacts.decorations).length > 0
      ? `장식 요소: ${ensureStringArray(visualFacts.decorations).slice(0, 4).join(", ")}`
      : "",
    [
      ensureText(typographyStyle.vibe),
      ensureText(typographyStyle.material),
      ensureStringArray(typographyStyle.effects).slice(0, 3).join(", "),
    ]
      .filter(Boolean)
      .join(" | "),
    ensureStringArray(persuasionFacts.trustSignals).length > 0
      ? `신뢰 신호: ${ensureStringArray(persuasionFacts.trustSignals).slice(0, 3).join(", ")}`
      : "",
    ensureStringArray(persuasionFacts.urgencySignals).length > 0
      ? `긴급/시즌 신호: ${ensureStringArray(persuasionFacts.urgencySignals).slice(0, 3).join(", ")}`
      : "",
    ensureText(channelRisk.safeZoneImportance)
      ? `세이프존 중요도: ${ensureText(channelRisk.safeZoneImportance)}`
      : "",
    ensureText(channelRisk.legibilityRisk)
      ? `가독성 리스크: ${ensureText(channelRisk.legibilityRisk)}`
      : "",
  ]
    .concat((input.analysis.strongPoints ?? []).slice(0, 3))
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(evidences)).slice(0, 8);
}

function normalizeAnalyzeOutput(
  raw: AnalyzeResponseRaw,
  fallback: ReturnType<typeof fallbackAnalysis>,
  requestedCopyToggles?: Partial<CopyToggles>,
): {
  analysis: ReferenceAnalysis;
  prompts: StudioPromptDraft[];
  recommendedTemplateIds: string[];
} {
  const sourceAnalysis = raw.analysis ?? {};
  const sourceLayoutMap = raw.layoutMap ?? {};
  const slots = Array.isArray(sourceLayoutMap.slots) ? sourceLayoutMap.slots : [];
  const sourceStyleTokens = raw.styleTokens ?? {};
  const sourceReferenceInsights = ensureRecord(
    raw.referenceInsights ?? sourceAnalysis.referenceInsights,
  );
  const missingInputs = ensureStringArray(raw.missingInputs ?? sourceAnalysis.missingInputs).slice(
    0,
    8,
  );
  const styleTypographyDirection = ensureText(
    sourceStyleTokens.typography?.direction ?? sourceStyleTokens.typographyDirection,
  );
  const styleTypographyHierarchy = ensureText(
    sourceStyleTokens.typography?.hierarchy,
  );
  const styleTypographyComposite = [styleTypographyDirection, styleTypographyHierarchy]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" | ");

  const defaultCopyToggles = normalizeCopyToggles(requestedCopyToggles);

  const fallbackHeadline = fallback.analysis.layoutBBoxes.headline;
  const fallbackSubhead = fallback.analysis.layoutBBoxes.subhead;
  const fallbackProduct = fallback.analysis.layoutBBoxes.product;
  const fallbackCta = fallback.analysis.layoutBBoxes.cta;

  const analysis: ReferenceAnalysis = {
    layoutBBoxes: {
      headline: normalizeBox(
        sourceAnalysis.layoutBBoxes?.headline ??
          boxFromSlot(slots, ["headline", "hook"], fallbackHeadline),
      ),
      subhead: normalizeBox(
        sourceAnalysis.layoutBBoxes?.subhead ??
          boxFromSlot(slots, ["subhead", "subcopy"], fallbackSubhead),
      ),
      product: normalizeBox(
        sourceAnalysis.layoutBBoxes?.product ??
          boxFromSlot(slots, ["product", "focus"], fallbackProduct),
      ),
      cta: normalizeBox(
        sourceAnalysis.layoutBBoxes?.cta ??
          boxFromSlot(slots, ["cta", "action"], fallbackCta),
      ),
    },
    palette: ensureStringArray(sourceAnalysis.palette ?? sourceStyleTokens.palette).slice(0, 6),
    moodKeywords: ensureStringArray(sourceAnalysis.moodKeywords ?? sourceStyleTokens.mood).slice(0, 8),
    hookPattern: ensureText(
      sourceAnalysis.hookPattern ?? raw.summary?.hookType,
      fallback.analysis.hookPattern,
    ),
    typographyStyle: ensureText(
      sourceAnalysis.typographyStyle ??
        raw.summary?.typographyStyleHint ??
        styleTypographyComposite,
      fallback.analysis.typographyStyle,
    ),
    readabilityWarnings: ensureStringArray(sourceAnalysis.readabilityWarnings).slice(0, 6),
    strongPoints: ensureStringArray(
      sourceAnalysis.strongPoints ?? raw.summary?.whyItWorks,
    ).slice(0, 3),
    referenceInsights: {
      visualFacts: ensureRecord(sourceReferenceInsights.visualFacts),
      persuasionFacts: ensureRecord(sourceReferenceInsights.persuasionFacts),
      channelRisk: ensureRecord(sourceReferenceInsights.channelRisk),
    },
    missingInputs,
  };
  const globalEvidence = buildReferenceEvidence({
    referenceInsights: sourceReferenceInsights,
    analysis,
  });

  const roles: StudioPromptRole[] = ["PLANNER", "MARKETER", "DESIGNER"];
  const roleTitles: Record<StudioPromptRole, string> = {
    PLANNER: "세계 최고의 기획자 시선",
    MARKETER: "퍼포먼스 마케터 시선",
    DESIGNER: "디자이너 시선",
  };
  const personaRoleMap: Record<string, StudioPromptRole> = {
    planner: "PLANNER",
    marketer: "MARKETER",
    performance: "MARKETER",
    designer: "DESIGNER",
  };

  const sourcePromptList =
    Array.isArray(raw.personas) && raw.personas.length > 0
      ? raw.personas
      : Array.isArray(raw.prompts) && raw.prompts.length > 0
        ? raw.prompts
        : raw.threePrompts;
  const promptByRole: Partial<Record<StudioPromptRole, any>> = {};
  for (const item of sourcePromptList ?? []) {
    if (!item || typeof item !== "object") continue;
    const persona = ensureText((item as any).persona ?? (item as any).id).toLowerCase();
    const mapped = personaRoleMap[persona];
    const itemRole =
      normalizeRole((item as any).role, mapped || roleFromPersonaLike(item as Record<string, unknown>));
    if (!promptByRole[itemRole]) {
      promptByRole[itemRole] = item;
    }
  }

  const prompts = roles.map((role, index) => {
    const source = promptByRole[role] ?? sourcePromptList?.[index] ?? {};
    const sourcePromptNode = ensureRecord(source.prompt);
    const sourceCopy = source.copy ?? source.overlayCopy ?? sourcePromptNode.copyDraft ?? {};
    const textPolicy = ensureRecord(sourcePromptNode.textPolicy);
    const textPolicyCopyToggles = {
      useSubcopy:
        typeof textPolicy.renderSubText === "boolean"
          ? textPolicy.renderSubText
          : defaultCopyToggles.useSubcopy,
      useCTA:
        typeof textPolicy.renderCTA === "boolean"
          ? textPolicy.renderCTA
          : defaultCopyToggles.useCTA,
      useBadge:
        typeof textPolicy.renderBadges === "boolean"
          ? textPolicy.renderBadges
          : defaultCopyToggles.useBadge,
    };
    const promptCopyToggles = normalizeCopyToggles(
      source.generationHints?.copyToggles ?? textPolicyCopyToggles,
    );
    const copy = {
      headline: ensureText(
        sourceCopy.headline ?? sourceCopy.mainHeadline,
        fallback.prompts[index].copy.headline,
      ),
      subhead: ensureText(
        sourceCopy.subhead ?? sourceCopy.subcopy ?? sourceCopy.subText,
        promptCopyToggles.useSubcopy ? fallback.prompts[index].copy.subhead : "",
      ),
      cta: ensureText(
        sourceCopy.cta ?? sourceCopy.ctaText,
        promptCopyToggles.useCTA ? fallback.prompts[index].copy.cta : "",
      ),
      badges: ensureStringArray(
        sourceCopy.badges ??
          sourceCopy.badgeText ??
          (sourceCopy.badge ? [sourceCopy.badge] : []),
      ).slice(0, 4),
    };

    const why = normalizeWhyBlock(source.why);
    const validation = normalizeValidationBlock(source.validation);
    const personaId = normalizePersonaId(source.id ?? source.persona);
    const personaEvidence = Array.from(
      new Set([...globalEvidence, ...why.observations]),
    ).slice(0, 8);
    const sourceMissingInputs = ensureStringArray(source.missingInputs);

    const visual = {
      scene: ensureText(
        source.visual?.scene ?? source.visualPrompt ?? sourcePromptNode.finalPrompt,
        fallback.prompts[index].visual.scene,
      ),
      composition: ensureText(
        source.visual?.composition,
        fallback.prompts[index].visual.composition,
      ),
      style: ensureText(source.visual?.style, fallback.prompts[index].visual.style),
      lighting: ensureText(source.visual?.lighting, fallback.prompts[index].visual.lighting),
      colorPaletteHint: ensureText(
        source.visual?.colorPaletteHint,
        fallback.prompts[index].visual.colorPaletteHint,
      ),
      negative: ensureText(
        source.visual?.negative ?? source.negativePrompt,
        fallback.prompts[index].visual.negative,
      ),
    };

    const generationHints = {
      aspectRatioDefault:
        source.generationHints?.aspectRatioDefault === "1:1" ||
        source.generationHints?.aspectRatioDefault === "4:5" ||
        source.generationHints?.aspectRatioDefault === "9:16"
          ? source.generationHints.aspectRatioDefault
          : "1:1",
      textModeDefault:
        source.generationHints?.textModeDefault === "in_image" ||
        source.generationHints?.textModeDefault === "no_text"
          ? source.generationHints.textModeDefault
          : "minimal_text",
      copyToggles: promptCopyToggles,
      textStyle: normalizePromptTextStyle(source.generationHints?.textStyle),
      seniorPack: {
        personaId,
        evidence: personaEvidence,
        why,
        validation: {
          mustPass:
            validation.mustPass.length > 0
              ? localizeChecklistItems(validation.mustPass, "mustPass")
              : [
                  "한글 텍스트 오탈자 없음",
                  "텍스트 대비 양호",
                  "세이프존 준수",
                  "레퍼런스 스타일 매칭 높음",
                ],
          autoFixRules:
            validation.autoFixRules.length > 0
              ? localizeChecklistItems(validation.autoFixRules, "autoFixRules")
              : [
                  "헤드라인 크기 확대",
                  "서브카피 길이 축소",
                  "텍스트 뒤 배경 단순화",
                ],
        },
        strategy: ensureRecord(source.strategy),
        hypothesis: ensureRecord(source.hypothesis),
        finalPrompt: ensureText(sourcePromptNode.finalPrompt),
        mode: ensureText(sourcePromptNode.mode, "style_fusion_generate"),
        missingInputs: Array.from(new Set([...missingInputs, ...sourceMissingInputs])).slice(0, 8),
      },
    } as const;

    return {
      id: ensureText(source.id, role.toLowerCase()),
      role: normalizeRole(source.role, role),
      title: ensureText(source.title, roleTitles[role]),
      copy,
      visual,
      generationHints,
    };
  });

  return {
    analysis,
    prompts,
    recommendedTemplateIds: normalizeTemplateIds(raw.recommendedTemplates),
  };
}

export async function analyzeReferenceAndBuildPrompts(input: {
  referenceImageUrl: string;
  productContext: ProductContext;
  analysisModel?: string;
  copyToggles?: Partial<CopyToggles>;
}): Promise<{
  analysis: ReferenceAnalysis;
  prompts: StudioPromptDraft[];
  warnings: string[];
  recommendedTemplateIds: string[];
}> {
  const fallback = fallbackAnalysis(input.productContext);
  const defaultCopyToggles = normalizeCopyToggles(input.copyToggles);

  try {
    const inlineData = await toInlineDataFromUrl(input.referenceImageUrl);
    const prompt = await buildStudioAnalyzePrompt({
      productContext: input.productContext,
      copyToggles: defaultCopyToggles,
    });

    const response = await callGeminiModel(
      input.analysisModel || process.env.STUDIO_ANALYSIS_MODEL || "gemini-2.5-flash",
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
        },
      },
    );

    const text = extractTextFromGemini(response);
    const parsed = tryParseJson<AnalyzeResponseRaw>(text);

    if (!parsed) {
      return {
        ...fallback,
        warnings: [
          "AI 분석 응답 파싱에 실패하여 기본 분석 템플릿을 사용했습니다.",
        ],
        recommendedTemplateIds: [],
      };
    }

    const normalized = normalizeAnalyzeOutput(parsed, fallback, defaultCopyToggles);
    const missingInputWarnings = (normalized.analysis.missingInputs ?? []).map(
      (item) => `입력 필요: ${item}`,
    );
    const copyWarnings = normalized.prompts.flatMap((item) =>
      normalizeKoreanTextLengthWarnings({
        headline: item.copy.headline,
        cta: item.copy.cta,
        copyToggles: item.generationHints.copyToggles,
      }),
    );

    return {
      ...normalized,
      warnings: [...missingInputWarnings, ...copyWarnings],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석 실패";
    return {
      ...fallback,
      warnings: [
        `${message} 기본 분석 템플릿으로 이어서 작업할 수 있습니다.`,
      ],
      recommendedTemplateIds: [],
    };
  }
}

export async function generateConceptPromptsWithoutReference(input: {
  productContext: ProductContext;
  analysisModel?: string;
  copyToggles?: Partial<CopyToggles>;
}): Promise<{
  analysis: ReferenceAnalysis;
  prompts: StudioPromptDraft[];
  warnings: string[];
  recommendedTemplateIds: string[];
}> {
  const fallback = fallbackAnalysis(input.productContext);
  const defaultCopyToggles = normalizeCopyToggles(input.copyToggles);

  try {
    const prompt = await buildStudioNoReferenceConceptPrompt({
      productContext: input.productContext,
      copyToggles: defaultCopyToggles,
    });

    const response = await callGeminiModel(
      input.analysisModel || process.env.STUDIO_ANALYSIS_MODEL || "gemini-2.5-flash",
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
        },
      },
    );

    const text = extractTextFromGemini(response);
    const parsed = tryParseJson<AnalyzeResponseRaw>(text);
    if (!parsed) {
      return {
        ...fallback,
        warnings: ["무레퍼런스 컨셉 파싱에 실패해 기본 템플릿으로 시작합니다."],
        recommendedTemplateIds: [],
      };
    }

    const normalized = normalizeAnalyzeOutput(parsed, fallback, defaultCopyToggles);
    const missingInputWarnings = (normalized.analysis.missingInputs ?? []).map(
      (item) => `입력 필요: ${item}`,
    );
    const copyWarnings = normalized.prompts.flatMap((item) =>
      normalizeKoreanTextLengthWarnings({
        headline: item.copy.headline,
        cta: item.copy.cta,
        copyToggles: item.generationHints.copyToggles,
      }),
    );

    return {
      ...normalized,
      warnings: [...missingInputWarnings, ...copyWarnings],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "컨셉 생성 실패";
    return {
      ...fallback,
      warnings: [`${message} 기본 템플릿으로 이어서 작업할 수 있습니다.`],
      recommendedTemplateIds: [],
    };
  }
}

export async function estimateTextFidelityScore(input: {
  imageUrl: string;
  intendedHeadline: string;
  intendedCta: string;
}): Promise<number | null> {
  try {
    const inlineData = await toInlineDataFromUrl(input.imageUrl);
    const prompt = [
      "다음 이미지를 OCR 관점으로 읽고 intended 문구와의 일치도를 0~100 정수로 계산하라.",
      "출력은 JSON만 허용한다.",
      `intended_headline: ${input.intendedHeadline}`,
      `intended_cta: ${input.intendedCta}`,
      '형식: {"score": 0}',
    ].join("\n");

    const response = await callGeminiModel(
      process.env.STUDIO_TEXT_FIDELITY_MODEL || "gemini-2.0-flash",
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData }],
          },
        ],
        generationConfig: {
          temperature: 0,
        },
      },
    );

    const text = extractTextFromGemini(response);
    const parsed = tryParseJson<{ score?: number }>(text);
    const score = Number(parsed?.score);
    if (!Number.isFinite(score)) {
      return null;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  } catch {
    return null;
  }
}

export async function buildReferenceLockedImagePrompt(input: {
  referenceImageUrl: string;
  basePrompt: string;
  headline?: string;
  subhead?: string;
  cta?: string;
}): Promise<string> {
  const ref = input.referenceImageUrl?.trim();
  if (!ref || ref === "about:blank") {
    return input.basePrompt;
  }

  try {
    const inlineData = await toInlineDataFromUrl(ref);
    const refinePrompt = [
      "You are a Korean ad typography style-lock assistant.",
      "Task: rewrite BASE_PROMPT so that generated in-image text follows the reference typography mood.",
      "Use reference image as typography authority (serif/script/sans, stroke, shadow, emboss, gold tone, hierarchy).",
      "Keep product/composition intent from BASE_PROMPT unchanged.",
      "Do not output JSON. Output only final rewritten prompt text.",
      "",
      `HEADLINE: ${input.headline ?? ""}`,
      `SUBHEAD: ${input.subhead ?? ""}`,
      `CTA: ${input.cta ?? ""}`,
      "",
      "BASE_PROMPT:",
      input.basePrompt,
    ].join("\n");

    const response = await callGeminiModel(
      process.env.STUDIO_STYLE_LOCK_MODEL || "gemini-2.5-flash",
      {
        contents: [
          {
            role: "user",
            parts: [{ text: refinePrompt }, { inlineData }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      },
    );

    const refined = extractTextFromGemini(response).trim();
    if (!refined) {
      return input.basePrompt;
    }

    return refined;
  } catch {
    return input.basePrompt;
  }
}
