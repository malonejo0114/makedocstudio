import { NextRequest, NextResponse } from "next/server";

import type { BenchmarkAnalysis, GeneratedCopy } from "@/lib/gemini";
import {
  analyzeReferenceWithGemini,
  generateCopyWithGemini,
  generateImageWithGemini,
  generateImageWithGeminiAdvanced,
  inlineDataFromBase64,
} from "@/lib/gemini";
import {
  buildPrompt,
  DEFAULT_VISUAL_GUIDE,
  GENERATION_PROMPT,
} from "@/lib/prompts";
import { consumeRateLimit } from "@/lib/rateLimit";
import { resolveScenarioKey, scenarioSummary } from "@/lib/scenario";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";
import {
  AspectRatioSchema,
  createDefaultLayout,
  LayoutSchema,
} from "@/lib/layoutSchema";
import {
  buildBackgroundOnlyPrompt,
  buildFullCreativePrompt,
} from "@/lib/promptBuilders.server";
import { scoreReservedZones } from "@/lib/imageQa";

type TextMode = "auto" | "custom";
type OutputMode = "image_with_text" | "image_only";

type NanoGenerateMode = "background_only" | "full_creative";

const NanoGenerateRequestSchema = z.object({
  model: z.string().min(1),
  imageSize: z.enum(["1K", "2K", "4K"]).optional(),
  aspectRatio: AspectRatioSchema.default("1:1"),
  mode: z.enum(["background_only", "full_creative"]),
  prompt: z.string().optional(),
  visualGuide: z.string().optional(),
  headline: z.string().optional(),
  subText: z.string().optional(),
  ctaText: z.string().optional(),
  badgeText: z.string().optional(),
  legalText: z.string().optional(),
  layoutJson: LayoutSchema.optional(),
  referenceImageBase64: z.string().optional(),
  productImageBase64: z.string().optional(),
  guideOverlayBase64: z.string().optional(),
  qualityLoop: z.boolean().optional(),
});

async function handleNanoJsonGenerate(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = NanoGenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "요청 데이터(JSON)가 올바르지 않습니다.",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const mode: NanoGenerateMode = payload.mode;

  const layout = payload.layoutJson ?? createDefaultLayout(payload.aspectRatio);
  const width = layout.canvas.width;
  const height = layout.canvas.height;

  const visualGuide = (payload.visualGuide ?? "").trim() || DEFAULT_VISUAL_GUIDE;
  const headline = (payload.headline ?? "").trim();
  const subText = (payload.subText ?? "").trim();
  const ctaText = (payload.ctaText ?? "").trim();
  const badgeText = (payload.badgeText ?? "").trim();
  const legalText = (payload.legalText ?? "").trim();

  const finalPrompt = payload.prompt?.trim()
    ? payload.prompt.trim()
    : mode === "background_only"
      ? await buildBackgroundOnlyPrompt({
          visualGuide,
          aspectRatio: payload.aspectRatio,
          width,
          height,
        })
      : await buildFullCreativePrompt({
          visualGuide,
          headline,
          subText,
          ctaText,
          badgeText,
          legalText,
          aspectRatio: payload.aspectRatio,
          width,
          height,
          layoutJson: layout,
        });

  const referenceInlineData = payload.referenceImageBase64
    ? inlineDataFromBase64(payload.referenceImageBase64)
    : undefined;
  const productInlineData = payload.productImageBase64
    ? inlineDataFromBase64(payload.productImageBase64)
    : undefined;
  const overlayInlineData = payload.guideOverlayBase64
    ? inlineDataFromBase64(payload.guideOverlayBase64)
    : undefined;

  const responseModalities: Array<"TEXT" | "IMAGE"> =
    mode === "background_only" ? ["IMAGE"] : ["TEXT", "IMAGE"];

  const useQualityLoop = Boolean(payload.qualityLoop) && mode === "background_only";

  const qualityCandidates: Array<{ score: number; model: string }> = [];

  const generateOnce = async (args: { model: string; prompt: string; imageSize?: string }) => {
    const out = await generateImageWithGeminiAdvanced({
      model: args.model,
      prompt: args.prompt,
      aspectRatio: payload.aspectRatio,
      imageSize: args.imageSize,
      responseModalities,
      referenceInlineData,
      productInlineData,
      guideOverlayInlineData: overlayInlineData,
    });
    const qa = await scoreReservedZones({
      imageBase64: out.base64,
      mimeType: out.mimeType,
      layout,
    });
    return { out, qa };
  };

  let generated: Awaited<ReturnType<typeof generateImageWithGeminiAdvanced>>;
  let chosenQa: Awaited<ReturnType<typeof scoreReservedZones>> | null = null;

  if (!useQualityLoop) {
    const once = await generateOnce({ model: payload.model, prompt: finalPrompt, imageSize: payload.imageSize });
    generated = once.out;
    chosenQa = once.qa;
  } else {
    // 1) Fast candidates
    const fastModel = "gemini-2.5-flash-image";
    let best: { out: typeof generated; qa: Awaited<ReturnType<typeof scoreReservedZones>> } | null = null;

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const candidate = await generateOnce({ model: fastModel, prompt: finalPrompt });
      qualityCandidates.push({ score: candidate.qa.score, model: fastModel });
      if (!best || candidate.qa.score > best.qa.score) best = candidate;
    }

    if (!best) {
      const once = await generateOnce({ model: payload.model, prompt: finalPrompt, imageSize: payload.imageSize });
      generated = once.out;
      chosenQa = once.qa;
    } else {
      generated = best.out;
      chosenQa = best.qa;

      // 2) Optional "final" pass with the selected model (pro/hq), compare scores and keep the best.
      if (payload.model && payload.model !== fastModel) {
        const refinePrompt = [
          finalPrompt,
          "",
          "REFINE (strict): Keep the same composition and overall style. Keep all reserved overlay boxes clean and low-detail. Absolutely no text, letters, numbers, logos, watermarks, UI.",
        ].join("\n");

        try {
          const pro = await generateOnce({
            model: payload.model,
            prompt: refinePrompt,
            imageSize: payload.imageSize,
          });
          qualityCandidates.push({ score: pro.qa.score, model: payload.model });

          // If pro is not significantly worse, prefer it (usually higher fidelity).
          if (pro.qa.score >= (chosenQa?.score ?? 0) - 6) {
            generated = pro.out;
            chosenQa = pro.qa;
          }
        } catch (error) {
          console.warn("[/api/generate] qualityLoop pro refine failed:", error);
        }
      }
    }
  }

  return NextResponse.json(
    {
      mode,
      aspectRatio: payload.aspectRatio,
      width,
      height,
      prompt: finalPrompt,
      qualityLoop: useQualityLoop
        ? {
            used: true,
            chosenScore: chosenQa?.score ?? null,
            candidates: qualityCandidates,
          }
        : { used: false },
      model: generated.model,
      mimeType: generated.mimeType,
      imageBase64: generated.base64,
      dataUrl: generated.dataUrl,
    },
    { status: 200 },
  );
}

function normalizeIncomingUrl(
  raw: string | undefined,
  request: NextRequest,
): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  try {
    if (trimmed.startsWith("/")) {
      return new URL(trimmed, request.nextUrl.origin).toString();
    }
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(trimmed, request.nextUrl.origin).toString();
    } catch {
      return trimmed;
    }
  }
}

function readString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readFile(formData: FormData, key: string): File | undefined {
  const value = formData.get(key);
  if (!(value instanceof File)) {
    return undefined;
  }
  return value.size > 0 ? value : undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  return [];
}

function normalizeAnalysis(analysis: BenchmarkAnalysis | null): BenchmarkAnalysis | null {
  if (!analysis) {
    return null;
  }

  const raw = analysis as unknown as Record<string, unknown>;

  return {
    ...analysis,
    composition: toStringList(raw.composition),
    style: toStringList(raw.style),
    appeal_points: toStringList(raw.appeal_points),
    copy_angle: toStringList(raw.copy_angle),
    color_tone: toStringList(raw.color_tone),
    notes:
      typeof raw.notes === "string"
        ? raw.notes
        : toStringList(raw.notes).join(", "),
  };
}

function formatVisualGuide(analysis: BenchmarkAnalysis | null): string {
  if (!analysis) {
    return DEFAULT_VISUAL_GUIDE;
  }

  const composition = (analysis.composition ?? []).join(", ");
  const style = (analysis.style ?? []).join(", ");
  const appeal = (analysis.appeal_points ?? []).join(", ");
  const colorTone = (analysis.color_tone ?? []).join(", ");
  const copyAngle = (analysis.copy_angle ?? []).join(", ");

  return [
    `Composition: ${composition || "clean conversion-focused hierarchy"}`,
    `Style: ${style || "modern commercial ad style"}`,
    `Appeal: ${appeal || "trust, clarity, and urgency"}`,
    `Color Tone: ${colorTone || "balanced high-contrast palette"}`,
    `Copy Angle: ${copyAngle || "benefit-first direct response"}`,
    `Notes: ${analysis.notes || ""}`.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanStyleInput(raw: string | undefined, fallback: string): string {
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim();
  return normalized || fallback;
}

function buildTextStyleContract(input: {
  includeText: boolean;
  width: number;
  height: number;
  headlineStyle?: string;
  subTextStyle?: string;
  ctaStyle?: string;
}): string {
  if (!input.includeText) {
    return "TEXT CONTRACT: No text rendering. Pure image-only output.";
  }

  const headlineStyle = cleanStyleInput(
    input.headlineStyle,
    "Top-left area, bold high-contrast sans-serif headline, max 2 lines.",
  );
  const subTextStyle = cleanStyleInput(
    input.subTextStyle,
    "Placed directly below headline with clear spacing and readable weight.",
  );
  const ctaStyle = cleanStyleInput(
    input.ctaStyle,
    "Button-like CTA near lower-left quadrant, clear border/fill and strong contrast.",
  );

  const safeX = Math.round(input.width * 0.08);
  const safeY = Math.round(input.height * 0.08);
  const safeW = Math.round(input.width * 0.84);
  const safeH = Math.round(input.height * 0.84);

  return [
    "TEXT STYLE CONTRACT (strict):",
    `- Canvas: ${input.width}x${input.height}px`,
    `- Safe area: x=${safeX}..${safeX + safeW}, y=${safeY}..${safeY + safeH}`,
    `- Headline style: ${headlineStyle}`,
    `- Sub-text style: ${subTextStyle}`,
    `- CTA style: ${ctaStyle}`,
    "- Keep Korean text crisp and typo-free.",
    "- Keep all text fully visible and within safe area.",
  ].join("\n");
}

function fillCustomCopy({
  headline,
  subText,
  cta,
}: {
  headline?: string;
  subText?: string;
  cta?: string;
}): GeneratedCopy {
  return {
    headline: headline || "핵심 가치를 한 문장으로 전달하세요",
    subText: subText || "서브카피를 입력해 광고 맥락을 완성하세요.",
    cta: cta || "자세히 보기",
  };
}

async function saveGenerationLog(params: {
  usedReferenceId?: string;
  scenario: string;
  scenarioDesc: string;
  outputMode: OutputMode;
  textMode: TextMode;
  width: number;
  height: number;
  visualGuide: string;
  headline: string;
  subText: string;
  cta: string;
  finalPrompt: string;
  model: string;
  generatedImage: string;
}) {
  try {
    const supabase = getSupabaseServerClient();
    const fullPayload = {
      used_reference_id: params.usedReferenceId ?? null,
      scenario: params.scenario,
      scenario_desc: params.scenarioDesc,
      output_mode: params.outputMode,
      text_mode: params.textMode,
      width: params.width,
      height: params.height,
      visual_guide: params.visualGuide,
      headline: params.headline,
      sub_text: params.subText,
      cta: params.cta,
      final_prompt: params.finalPrompt,
      model: params.model,
      generated_image: params.generatedImage,
    };
    const { error } = await supabase.from("generations").insert(fullPayload);

    if (error) {
      const fallbackPayload = {
        used_reference_id: params.usedReferenceId ?? null,
        scenario: params.scenario,
        text_mode: params.textMode,
        headline: params.headline,
        sub_text: params.subText,
        cta: params.cta,
      };
      const { error: fallbackError } = await supabase
        .from("generations")
        .insert(fallbackPayload);

      if (fallbackError) {
        console.warn(
          "[/api/generate] generation insert skipped:",
          `${error.message} | fallback: ${fallbackError.message}`,
        );
      }
    }
  } catch (error) {
    console.warn("[/api/generate] log insert failed:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rate = consumeRateLimit(`generate:${ip}`, {
      limit: 12,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      const retryAfterSec = Math.max(Math.ceil((rate.resetAt - Date.now()) / 1000), 1);
      return NextResponse.json(
        {
          error: `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Remaining": String(rate.remaining),
          },
        },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await handleNanoJsonGenerate(request);
    }

    const formData = await request.formData();

    const referenceImageFile = readFile(formData, "referenceImage");
    const referenceImageUrl = normalizeIncomingUrl(
      readString(formData, "referenceImageUrl"),
      request,
    );
    const productImageFile = readFile(formData, "productImage");

    const headline = readString(formData, "headline");
    const subText = readString(formData, "subText");
    const cta = readString(formData, "cta");
    const promptOverride = readString(formData, "promptOverride");
    const skipAnalysis = readString(formData, "skipAnalysis") === "true";
    const usedReferenceId = readString(formData, "usedReferenceId");
    const referenceTemplateVisualGuide = readString(
      formData,
      "referenceTemplateVisualGuide",
    );
    const referenceHeadlineStyle = readString(formData, "referenceHeadlineStyle");
    const referenceSubTextStyle = readString(formData, "referenceSubTextStyle");
    const referenceCtaStyle = readString(formData, "referenceCtaStyle");

    const width = parseNumber(readString(formData, "width"), 1080);
    const height = parseNumber(readString(formData, "height"), 1080);
    const visualGuideInput = readString(formData, "visualGuide");

    const outputModeRaw = readString(formData, "outputMode");
    const outputMode: OutputMode =
      outputModeRaw === "image_only" ? "image_only" : "image_with_text";
    const includeText = outputMode === "image_with_text";

    const textModeRaw = readString(formData, "textMode");
    const textMode: TextMode = textModeRaw === "custom" ? "custom" : "auto";

    const hasReference = Boolean(referenceImageFile || referenceImageUrl);
    const hasProduct = Boolean(productImageFile);
    const isCustomText = includeText && textMode === "custom";

    const scenario = resolveScenarioKey({ hasReference, hasProduct, isCustomText });
    const scenarioDesc = scenarioSummary(scenario);

    let analysis: BenchmarkAnalysis | null = null;
    if (hasReference && !skipAnalysis) {
      try {
        analysis = await analyzeReferenceWithGemini({
          referenceImageFile,
          referenceImageUrl,
        });
      } catch (error) {
        console.warn("[/api/generate] reference analysis failed:", error);
      }
    }

    const normalizedAnalysis = normalizeAnalysis(analysis);
    const visualGuide = [
      formatVisualGuide(normalizedAnalysis),
      visualGuideInput ? `Custom Visual Direction: ${visualGuideInput}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const referenceTemplateGuide = [
      referenceTemplateVisualGuide
        ? `Reference Template Visual Guide: ${referenceTemplateVisualGuide}`
        : "",
      referenceHeadlineStyle
        ? `Headline design style to apply to provided text: ${referenceHeadlineStyle}`
        : "",
      referenceSubTextStyle
        ? `Sub-text design style to apply to provided text: ${referenceSubTextStyle}`
        : "",
      referenceCtaStyle
        ? `CTA design style to apply to provided text: ${referenceCtaStyle}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const productGuide = hasProduct
      ? "Use the uploaded product image as the dominant hero subject."
      : "Design a conceptual hero visual aligned with the visual guide.";
    const textStyleContract = buildTextStyleContract({
      includeText,
      width,
      height,
      headlineStyle: referenceHeadlineStyle,
      subTextStyle: referenceSubTextStyle,
      ctaStyle: referenceCtaStyle,
    });
    const textPolicyGuide = includeText
      ? "Render text overlay from HEADLINE/SUB_TEXT/CTA with high legibility and clear hierarchy."
      : "Do NOT render any text, words, letters, labels, logos, UI elements, or typography in the image.";
    const mergedVisualGuide = [
      visualGuide,
      referenceTemplateGuide,
      textStyleContract,
      productGuide,
      textPolicyGuide,
      includeText
        ? "Important: Keep text content exactly as provided, but apply the reference text design style."
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    let copy: GeneratedCopy;
    if (!includeText) {
      copy = { headline: "", subText: "", cta: "" };
    } else if (isCustomText) {
      copy = fillCustomCopy({ headline, subText, cta });
    } else {
      copy = await generateCopyWithGemini({
        visualGuide: mergedVisualGuide,
        scenario: `${scenario} (${scenarioDesc})`,
        analysis: normalizedAnalysis,
      });
    }

    const finalPrompt = promptOverride?.trim()
      ? promptOverride.trim()
      : buildPrompt(GENERATION_PROMPT, {
          WIDTH: width,
          HEIGHT: height,
          VISUAL_GUIDE: mergedVisualGuide,
          HEADLINE: copy.headline,
          SUB_TEXT: copy.subText,
          CTA: copy.cta,
        });

    const generatedImage = await generateImageWithGemini({
      prompt: finalPrompt,
      referenceImageFile,
      referenceImageUrl,
      productImageFile,
    });

    await saveGenerationLog({
      usedReferenceId,
      scenario,
      scenarioDesc,
      outputMode,
      textMode,
      width,
      height,
      visualGuide: mergedVisualGuide,
      headline: copy.headline,
      subText: copy.subText,
      cta: copy.cta,
      finalPrompt,
      model: generatedImage.model,
      generatedImage: generatedImage.dataUrl,
    });

    return NextResponse.json(
      {
        scenario,
        scenarioDesc,
        outputMode,
        textMode,
        width,
        height,
        analysis: normalizedAnalysis,
        copy,
        prompt: finalPrompt,
        model: generatedImage.model,
        generatedImage: generatedImage.dataUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/generate] failed:", error);
    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    const message = rawMessage.includes("GEMINI_API_KEY")
      ? "Gemini API 키가 설정되지 않았습니다. .env.local을 확인하세요."
      : rawMessage.includes("429")
        ? "요청이 많아 일시적으로 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
        : rawMessage.includes("503") || rawMessage.includes("500")
          ? "이미지 생성 서버가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요."
          : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
