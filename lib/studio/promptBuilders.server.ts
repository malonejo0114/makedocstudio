import type {
  CopyToggles,
  ProductContext,
  PromptTextStyleControls,
  ReferenceAnalysis,
  TextEffectTone,
  TextFontStyleTone,
  StudioPromptDraft,
} from "@/lib/studio/types";
import {
  fillStudioTemplate,
  loadStudioPromptTemplate,
} from "@/lib/studio/promptLibrary.server";

type StyleTransferMode = "style_transfer" | "reference_retext";
type TextAccuracyMode = "normal" | "strict";

const DEFAULT_COPY_TOGGLES: CopyToggles = {
  useSubcopy: true,
  useCTA: true,
  useBadge: true,
};

const DEFAULT_TEXT_STYLE = {
  fontTone: "auto" as TextFontStyleTone,
  effectTone: "auto" as TextEffectTone,
};

function normalizeSlotTextStyle(value?: {
  fontTone?: TextFontStyleTone;
  effectTone?: TextEffectTone;
}) {
  return {
    fontTone: value?.fontTone ?? DEFAULT_TEXT_STYLE.fontTone,
    effectTone: value?.effectTone ?? DEFAULT_TEXT_STYLE.effectTone,
  };
}

function normalizeTextStyleControls(value?: PromptTextStyleControls | null): PromptTextStyleControls {
  return {
    headline: normalizeSlotTextStyle(value?.headline),
    subhead: normalizeSlotTextStyle(value?.subhead),
    cta: normalizeSlotTextStyle(value?.cta),
    badge: normalizeSlotTextStyle(value?.badge),
  };
}

function labelFontTone(tone: TextFontStyleTone) {
  if (tone === "gothic") return "고딕체";
  if (tone === "myeongjo") return "명조체";
  if (tone === "rounded") return "둥근 서체";
  if (tone === "calligraphy") return "캘리그래피/장식 서체";
  return "레퍼런스 자동 추종";
}

function labelEffectTone(tone: TextEffectTone) {
  if (tone === "clean") return "효과 최소(클린)";
  if (tone === "shadow") return "그림자 강조";
  if (tone === "outline") return "외곽선 강조";
  if (tone === "emboss") return "볼록/엠보(튀어나온 느낌)";
  if (tone === "bubble") return "동글/버블 느낌";
  return "레퍼런스 자동 추종";
}

function styleKeywordByFontTone(tone: TextFontStyleTone) {
  if (tone === "gothic") return "korean modern sans-serif, geometric grotesk, clean stroke";
  if (tone === "myeongjo") return "korean serif, myeongjo, elegant contrast stroke";
  if (tone === "rounded") return "rounded korean sans, soft corner stroke";
  if (tone === "calligraphy") return "korean calligraphy/decorative serif, ornamental stroke";
  return "follow reference typography vibe";
}

function styleKeywordByEffectTone(tone: TextEffectTone) {
  if (tone === "clean") return "flat clean text, no heavy effect";
  if (tone === "shadow") return "soft drop shadow emphasis";
  if (tone === "outline") return "thin dark outline stroke emphasis";
  if (tone === "emboss") return "bevel/emboss raised text effect";
  if (tone === "bubble") return "rounded bubble-like volume effect";
  return "follow reference effect style";
}

function buildTextStyleDirectives(input: {
  textStyle: PromptTextStyleControls;
  copyToggles: CopyToggles;
}) {
  const style = normalizeTextStyleControls(input.textStyle);
  const rules = [
    {
      key: "headline",
      enabled: true,
      fontTone: style.headline?.fontTone ?? "auto",
      effectTone: style.headline?.effectTone ?? "auto",
    },
    {
      key: "subhead",
      enabled: input.copyToggles.useSubcopy,
      fontTone: style.subhead?.fontTone ?? "auto",
      effectTone: style.subhead?.effectTone ?? "auto",
    },
    {
      key: "cta",
      enabled: input.copyToggles.useCTA,
      fontTone: style.cta?.fontTone ?? "auto",
      effectTone: style.cta?.effectTone ?? "auto",
    },
    {
      key: "badge",
      enabled: input.copyToggles.useBadge,
      fontTone: style.badge?.fontTone ?? "auto",
      effectTone: style.badge?.effectTone ?? "auto",
    },
  ];
  const lines = rules.map((rule) =>
    rule.enabled
      ? `- ${rule.key}: enabled=true, fontTone=${rule.fontTone}, effectTone=${rule.effectTone}, styleKeywords="${styleKeywordByFontTone(rule.fontTone)}; ${styleKeywordByEffectTone(rule.effectTone)}"`
      : `- ${rule.key}: enabled=false (must not render)`,
  );

  return [
    "PRIORITY RULE: Apply TEXT_STYLE_LOCK before generic typography hints.",
    "If a slot is enabled=false, do not render that slot.",
    "If fontTone/effectTone is not auto, you MUST follow it for that slot.",
    "Avoid collapsing all slots into one generic gothic style.",
    "",
    "TEXT_STYLE_LOCK:",
    ...lines,
    "",
    "User-readable summary:",
    `- 헤드카피: 글꼴=${labelFontTone(style.headline?.fontTone ?? "auto")}, 효과=${labelEffectTone(style.headline?.effectTone ?? "auto")}`,
    input.copyToggles.useSubcopy
      ? `- 서브카피: 글꼴=${labelFontTone(style.subhead?.fontTone ?? "auto")}, 효과=${labelEffectTone(style.subhead?.effectTone ?? "auto")}`
      : "- 서브카피: 비활성화",
    input.copyToggles.useCTA
      ? `- CTA: 글꼴=${labelFontTone(style.cta?.fontTone ?? "auto")}, 효과=${labelEffectTone(style.cta?.effectTone ?? "auto")}`
      : "- CTA: 비활성화",
    input.copyToggles.useBadge
      ? `- 뱃지: 글꼴=${labelFontTone(style.badge?.fontTone ?? "auto")}, 효과=${labelEffectTone(style.badge?.effectTone ?? "auto")}`
      : "- 뱃지: 비활성화",
  ].join("\n");
}

function normalizeNegativePrompt(input: string, textMode: "in_image" | "minimal_text" | "no_text") {
  const raw = input.trim();
  if (!raw) return raw;
  if (textMode !== "in_image") return raw;

  const blocked = new Set([
    "text",
    "letters",
    "captions",
    "subtitles",
    "typography",
    "random typography",
    "illegible letters",
  ]);

  const kept = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !blocked.has(item.toLowerCase()));

  return kept.join(", ");
}

export function normalizeCopyToggles(value?: Partial<CopyToggles> | null): CopyToggles {
  return {
    useSubcopy: value?.useSubcopy ?? DEFAULT_COPY_TOGGLES.useSubcopy,
    useCTA: value?.useCTA ?? DEFAULT_COPY_TOGGLES.useCTA,
    useBadge: value?.useBadge ?? DEFAULT_COPY_TOGGLES.useBadge,
  };
}

export function normalizeKoreanTextLengthWarnings(copy: {
  headline: string;
  cta: string;
  copyToggles?: Partial<CopyToggles>;
}) {
  const warnings: string[] = [];
  const toggles = normalizeCopyToggles(copy.copyToggles);

  if (copy.headline.trim().length > 18) {
    warnings.push("헤드라인이 18자를 초과해 이미지 내 텍스트 성공률이 떨어질 수 있습니다.");
  }
  if (toggles.useCTA && copy.cta.trim().length > 12) {
    warnings.push("CTA가 길어 가독성이 떨어질 수 있습니다. 12자 이내를 권장합니다.");
  }

  return warnings;
}

export async function buildStudioAnalyzePrompt(input: {
  productContext: ProductContext;
  copyToggles?: Partial<CopyToggles>;
}) {
  const template = await loadStudioPromptTemplate(
    process.env.STUDIO_REFERENCE_ANALYSIS_PROMPT || "reference_to_triple_prompts.md",
  );
  const copyToggles = normalizeCopyToggles(input.copyToggles);
  return fillStudioTemplate(template, {
    ANALYZE_BRIEF_JSON: JSON.stringify(
      {
        ...(input.productContext ?? {}),
        copyToggles,
      },
      null,
      2,
    ),
  });
}

export async function buildStudioNoReferenceConceptPrompt(input: {
  productContext: ProductContext;
  copyToggles?: Partial<CopyToggles>;
}) {
  const template = await loadStudioPromptTemplate(
    process.env.STUDIO_NO_REF_CONCEPT_PROMPT || "no_ref_concept_v2.md",
  );
  const copyToggles = normalizeCopyToggles(input.copyToggles);
  return fillStudioTemplate(template, {
    NO_REFERENCE_BRIEF_JSON: JSON.stringify(
      {
        ...(input.productContext ?? {}),
        copyToggles,
      },
      null,
      2,
    ),
  });
}

export async function buildStudioCardNewsPlanPrompt(input: {
  brief: {
    topic: string;
    targetAudience?: string;
    objective?: string;
    tone?: string;
    slideCount: number;
    aspectRatio: "1:1" | "4:5" | "9:16";
    productName?: string;
    referenceImageUrl?: string;
    referenceImageUrls?: string[];
    productImageUrl?: string;
    additionalNotes?: string;
  };
}) {
  const template = await loadStudioPromptTemplate(
    process.env.STUDIO_CARDNEWS_PLAN_PROMPT || "cardnews_plan_v1.md",
  );
  return fillStudioTemplate(template, {
    CARDNEWS_BRIEF_JSON: JSON.stringify(input.brief, null, 2),
  });
}

export async function buildStudioImagePrompt(input: {
  analysis: ReferenceAnalysis;
  prompt: StudioPromptDraft;
  productContext: ProductContext;
  aspectRatio: "1:1" | "4:5" | "9:16";
  textMode: "in_image" | "minimal_text" | "no_text";
  styleTransferMode?: StyleTransferMode;
  textAccuracyMode?: TextAccuracyMode;
}) {
  const copyToggles = normalizeCopyToggles(input.prompt.generationHints.copyToggles);
  const textStyle = normalizeTextStyleControls(input.prompt.generationHints.textStyle);
  const cta = copyToggles.useCTA ? input.prompt.copy.cta : "";
  const subhead = copyToggles.useSubcopy ? input.prompt.copy.subhead : "";
  const badges = copyToggles.useBadge ? input.prompt.copy.badges : [];
  const expertExecutionPrompt = input.prompt.generationHints.seniorPack?.finalPrompt?.trim() || "";
  const visualPromptFromFields = [
    input.prompt.visual.scene,
    input.prompt.visual.composition,
    input.prompt.visual.style,
    input.prompt.visual.lighting,
    input.prompt.visual.colorPaletteHint,
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" | ");
  const visualPrompt = expertExecutionPrompt || visualPromptFromFields;
  const typographyHint = input.analysis.typographyStyle?.trim() || "reference-driven";
  const moodHint = (input.analysis.moodKeywords ?? []).join(", ");
  const styleTransferMode = input.styleTransferMode ?? "style_transfer";
  const textAccuracyMode = input.textAccuracyMode ?? "normal";

  if (input.textMode === "in_image") {
    const template = await loadStudioPromptTemplate(
      styleTransferMode === "reference_retext"
        ? "ref_text_replace_v2.md"
        : "style_fusion_v2.md",
    );
    const normalizedNegative = normalizeNegativePrompt(input.prompt.visual.negative, input.textMode);
    return fillStudioTemplate(template, {
      REFERENCE_ANALYSIS: JSON.stringify(input.analysis, null, 2),
      PROMPT_ROLE: input.prompt.role,
      PROMPT_TITLE: input.prompt.title,
      HEADLINE: input.prompt.copy.headline,
      SUBHEAD: subhead,
      CTA: cta,
      SCENE: input.prompt.visual.scene,
      COMPOSITION: input.prompt.visual.composition,
      STYLE: input.prompt.visual.style,
      LIGHTING: input.prompt.visual.lighting,
      COLOR_PALETTE_HINT: input.prompt.visual.colorPaletteHint,
      TYPOGRAPHY_HINT: typographyHint,
      MOOD_HINT: moodHint,
      ASPECT_RATIO: input.aspectRatio,
      TEXT_MODE: input.textMode,
      TEXT_ACCURACY_MODE: textAccuracyMode,
      VISUAL_GUIDE: visualPrompt || input.prompt.visual.scene,
      MAIN_HEADLINE: input.prompt.copy.headline,
      SUB_TEXT: subhead,
      CTA_TEXT: cta,
      PRODUCT_CONTEXT: JSON.stringify(input.productContext ?? {}, null, 2),
      BADGE_TEXT: badges.join(", "),
      NEGATIVE: normalizedNegative,
      BADGES: badges.join(" / "),
      TEXT_STYLE_CONTROLS: buildTextStyleDirectives({
        textStyle,
        copyToggles,
      }),
    });
  }

  const template = await loadStudioPromptTemplate("creative_background_v3.md");
  return fillStudioTemplate(template, {
    VISUAL_PROMPT: visualPrompt,
    ASPECT_RATIO: input.aspectRatio,
    PLATFORM: input.productContext.platform ?? "meta_feed",
    COPY_TOGGLES: JSON.stringify(copyToggles),
    PRODUCT_CONTEXT: JSON.stringify(input.productContext ?? {}, null, 2),
    REFERENCE_ANALYSIS: JSON.stringify(input.analysis, null, 2),
    NEGATIVE: [normalizeNegativePrompt(input.prompt.visual.negative, input.textMode), "avoid plain generic sans-serif typography style"]
      .filter(Boolean)
      .join(", "),
  });
}

export async function buildStudioDirectImagePrompt(input: {
  visual: string;
  headline: string;
  subhead: string;
  cta: string;
  extraTexts: Array<{ label: string; value: string }>;
  negative: string;
  productContext: ProductContext;
  aspectRatio: "1:1" | "4:5" | "9:16";
  textMode: "in_image" | "minimal_text" | "no_text";
  copyToggles?: Partial<CopyToggles>;
  textStyle?: PromptTextStyleControls;
}) {
  const copyToggles = normalizeCopyToggles(input.copyToggles);
  const textStyle = normalizeTextStyleControls(input.textStyle);
  const extraTextLines =
    input.extraTexts.length > 0
      ? input.extraTexts
          .map((item) => `${item.label.trim() || "추가 텍스트"}: ${item.value.trim()}`)
          .join(" | ")
      : "없음";

  if (input.textMode === "in_image") {
    const template = await loadStudioPromptTemplate("studio_direct_generation.md");
    const normalizedNegative = normalizeNegativePrompt(input.negative, input.textMode);
    return fillStudioTemplate(template, {
      DIRECT_VISUAL: input.visual,
      HEADLINE: input.headline,
      SUBHEAD: copyToggles.useSubcopy ? input.subhead : "",
      CTA: copyToggles.useCTA ? input.cta : "",
      EXTRA_TEXTS: copyToggles.useBadge ? extraTextLines : "없음",
      PRODUCT_CONTEXT: JSON.stringify(input.productContext ?? {}, null, 2),
      ASPECT_RATIO: input.aspectRatio,
      TEXT_MODE: input.textMode,
      NEGATIVE: normalizedNegative,
      TEXT_STYLE_CONTROLS: buildTextStyleDirectives({
        textStyle,
        copyToggles,
      }),
    });
  }

  const template = await loadStudioPromptTemplate("creative_background_v3.md");
  return fillStudioTemplate(template, {
    VISUAL_PROMPT: input.visual,
    ASPECT_RATIO: input.aspectRatio,
    PLATFORM: input.productContext.platform ?? "meta_feed",
    COPY_TOGGLES: JSON.stringify(copyToggles),
    PRODUCT_CONTEXT: JSON.stringify(
      {
        ...(input.productContext ?? {}),
        directHeadline: input.headline,
        directSubhead: copyToggles.useSubcopy ? input.subhead : "",
        directCta: copyToggles.useCTA ? input.cta : "",
        directExtras: copyToggles.useBadge ? extraTextLines : "없음",
      },
      null,
      2,
    ),
    REFERENCE_ANALYSIS: "{}",
    NEGATIVE: normalizeNegativePrompt(input.negative, input.textMode),
  });
}
