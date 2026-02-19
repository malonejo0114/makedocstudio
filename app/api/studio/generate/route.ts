import crypto from "node:crypto";

import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CREDIT_WON_UNIT,
  getModelPriceById,
  UNIFIED_CREDIT_BUCKET_ID,
} from "@/lib/studio/pricing";
import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { estimateTextFidelityScore } from "@/lib/studio/gemini.server";
import { buildStudioImagePrompt } from "@/lib/studio/promptBuilders.server";
import type {
  PromptTextStyleControls,
  ReferenceAnalysis,
  StudioPromptDraft,
  TextEffectTone,
  TextFontStyleTone,
} from "@/lib/studio/types";
import { generateImageWithGeminiAdvanced } from "@/lib/gemini";
import { getSupabaseServiceClient } from "@/lib/supabase";

const TextStyleSlotSchema = z.object({
  fontTone: z.enum(["auto", "gothic", "myeongjo", "rounded", "calligraphy"]).optional(),
  effectTone: z.enum(["auto", "clean", "shadow", "outline", "emboss", "bubble"]).optional(),
});

const PromptOverrideSchema = z.object({
  title: z.string().max(500).optional(),
  copy: z
    .object({
      headline: z.string().max(2000).optional(),
      subhead: z.string().max(2000).optional(),
      cta: z.string().max(1000).optional(),
      badges: z.array(z.string().max(1000)).max(20).optional(),
    })
    .optional(),
  visual: z
    .object({
      scene: z.string().max(8000).optional(),
      composition: z.string().max(8000).optional(),
      style: z.string().max(8000).optional(),
      lighting: z.string().max(8000).optional(),
      colorPaletteHint: z.string().max(8000).optional(),
      negative: z.string().max(12000).optional(),
    })
    .optional(),
  generationHints: z
    .object({
      copyToggles: z
        .object({
          useSubcopy: z.boolean().optional(),
          useCTA: z.boolean().optional(),
          useBadge: z.boolean().optional(),
        })
        .optional(),
      textStyle: z
        .object({
          headline: TextStyleSlotSchema.optional(),
          subhead: TextStyleSlotSchema.optional(),
          cta: TextStyleSlotSchema.optional(),
          badge: TextStyleSlotSchema.optional(),
        })
        .optional(),
    })
    .optional(),
});

const GenerateBodySchema = z.object({
  projectId: z.string().min(1),
  promptId: z.string().min(1),
  imageModelId: z.string().min(1),
  aspectRatio: z.enum(["1:1", "4:5", "9:16"]),
  textMode: z.enum(["in_image", "minimal_text", "no_text"]),
  styleTransferMode: z.enum(["style_transfer", "reference_retext"]).optional(),
  textAccuracyMode: z.enum(["normal", "strict"]).optional(),
  promptOverride: PromptOverrideSchema.optional(),
});

const IMAGE_RUNTIME_FALLBACKS = (
  process.env.GEMINI_IMAGE_MODELS ||
  "gemini-3-pro-image-preview,gemini-2.0-flash-exp-image-generation"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

type InlineData = {
  mimeType: string;
  data: string;
};

function resolveRuntimeModelCandidates(
  selectedModelId: string,
  options?: { preferQuality?: boolean },
): string[] {
  const fastFallback =
    process.env.STUDIO_RUNTIME_FAST_IMAGE_MODEL || "gemini-2.0-flash-exp-image-generation";
  const qualityFallback =
    process.env.STUDIO_RUNTIME_QUALITY_IMAGE_MODEL || "gemini-3-pro-image-preview";
  const preferQuality = options?.preferQuality ?? false;

  const primary = selectedModelId.startsWith("imagen-4.0-fast")
    ? fastFallback
    : selectedModelId.startsWith("imagen-4.0")
      ? qualityFallback
      : selectedModelId;

  const ordered = preferQuality
    ? [
        qualityFallback,
        primary,
        ...IMAGE_RUNTIME_FALLBACKS,
        "gemini-3-pro-image-preview",
        "gemini-2.0-flash-exp-image-generation",
      ]
    : [
        primary,
        ...IMAGE_RUNTIME_FALLBACKS,
        "gemini-3-pro-image-preview",
        "gemini-2.0-flash-exp-image-generation",
      ];
  const dedup = new Set<string>(ordered);
  return Array.from(dedup).filter(Boolean);
}

async function toInlineDataFromUrl(imageUrl: string, label = "이미지"): Promise<InlineData> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`${label}를 불러오지 못했습니다.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType: response.headers.get("content-type") || "image/png",
    data: Buffer.from(arrayBuffer).toString("base64"),
  };
}

async function toInlineDataFromUrlSafe(imageUrl: string, label: string): Promise<InlineData | null> {
  try {
    return await toInlineDataFromUrl(imageUrl, label);
  } catch {
    return null;
  }
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

async function buildTypographyCropInlineData(input: {
  imageUrl: string;
  headlineBox: [number, number, number, number];
}): Promise<InlineData | null> {
  try {
    const response = await fetch(input.imageUrl);
    if (!response.ok) return null;

    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const image = sharp(sourceBuffer, { failOn: "none" });
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 8 || height < 8) return null;

    const [x, y, w, h] = input.headlineBox.map((value) => clampUnit(value)) as [
      number,
      number,
      number,
      number,
    ];
    const left = Math.max(0, Math.min(width - 1, Math.floor(x * width)));
    const top = Math.max(0, Math.min(height - 1, Math.floor(y * height)));
    const cropWidth = Math.max(32, Math.min(width - left, Math.ceil(w * width)));
    const cropHeight = Math.max(32, Math.min(height - top, Math.ceil(h * height)));

    if (cropWidth < 16 || cropHeight < 16) return null;

    const extracted = await image
      .extract({
        left,
        top,
        width: cropWidth,
        height: cropHeight,
      })
      .resize({
        width: Math.min(1400, Math.max(512, cropWidth * 2)),
        withoutEnlargement: false,
        fit: "inside",
      })
      .png()
      .toBuffer();

    return {
      mimeType: "image/png",
      data: extracted.toString("base64"),
    };
  } catch {
    return null;
  }
}

function getOptionalUrlValue(source: Record<string, unknown>, key: string): string | null {
  const raw = source[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

function parseTextFontTone(value: unknown): TextFontStyleTone {
  if (
    value === "gothic" ||
    value === "myeongjo" ||
    value === "rounded" ||
    value === "calligraphy"
  ) {
    return value;
  }
  return "auto";
}

function parseTextEffectTone(value: unknown): TextEffectTone {
  if (
    value === "clean" ||
    value === "shadow" ||
    value === "outline" ||
    value === "emboss" ||
    value === "bubble"
  ) {
    return value;
  }
  return "auto";
}

function parseTextStyle(raw: unknown): PromptTextStyleControls {
  const source = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  return {
    headline: {
      fontTone: parseTextFontTone(source?.headline?.fontTone),
      effectTone: parseTextEffectTone(source?.headline?.effectTone),
    },
    subhead: {
      fontTone: parseTextFontTone(source?.subhead?.fontTone),
      effectTone: parseTextEffectTone(source?.subhead?.effectTone),
    },
    cta: {
      fontTone: parseTextFontTone(source?.cta?.fontTone),
      effectTone: parseTextEffectTone(source?.cta?.effectTone),
    },
    badge: {
      fontTone: parseTextFontTone(source?.badge?.fontTone),
      effectTone: parseTextEffectTone(source?.badge?.effectTone),
    },
  };
}

function normalizeCopyTogglesFromUnknown(value: unknown): {
  useSubcopy: boolean;
  useCTA: boolean;
  useBadge: boolean;
} {
  const source = value && typeof value === "object" ? (value as Record<string, any>) : {};
  return {
    useSubcopy: typeof source.useSubcopy === "boolean" ? source.useSubcopy : true,
    useCTA: typeof source.useCTA === "boolean" ? source.useCTA : true,
    useBadge: typeof source.useBadge === "boolean" ? source.useBadge : true,
  };
}

function extractPromptDraft(row: {
  id: string;
  role: string;
  title: string;
  copy_json: Record<string, unknown>;
  visual_json: Record<string, unknown>;
  generation_hints: Record<string, unknown>;
}): StudioPromptDraft {
  return {
    id: row.id,
    role: (row.role as StudioPromptDraft["role"]) ?? "PLANNER",
    title: row.title,
    copy: {
      headline: String(row.copy_json?.headline ?? ""),
      subhead: String(row.copy_json?.subhead ?? ""),
      cta: String(row.copy_json?.cta ?? ""),
      badges: Array.isArray(row.copy_json?.badges)
        ? row.copy_json.badges.map((item) => String(item))
        : [],
    },
    visual: {
      scene: String(row.visual_json?.scene ?? ""),
      composition: String(row.visual_json?.composition ?? ""),
      style: String(row.visual_json?.style ?? ""),
      lighting: String(row.visual_json?.lighting ?? ""),
      colorPaletteHint: String(row.visual_json?.colorPaletteHint ?? ""),
      negative: String(row.visual_json?.negative ?? ""),
    },
    generationHints: {
      aspectRatioDefault:
        row.generation_hints?.aspectRatioDefault === "4:5" ||
        row.generation_hints?.aspectRatioDefault === "9:16"
          ? row.generation_hints.aspectRatioDefault
          : "1:1",
      textModeDefault:
        row.generation_hints?.textModeDefault === "in_image" ||
        row.generation_hints?.textModeDefault === "no_text"
          ? row.generation_hints.textModeDefault
          : "minimal_text",
      copyToggles:
        row.generation_hints?.copyToggles &&
        typeof row.generation_hints.copyToggles === "object"
          ? {
              useSubcopy:
                (row.generation_hints.copyToggles as { useSubcopy?: boolean }).useSubcopy ??
                true,
              useCTA:
                (row.generation_hints.copyToggles as { useCTA?: boolean }).useCTA ?? true,
              useBadge:
                (row.generation_hints.copyToggles as { useBadge?: boolean }).useBadge ?? true,
            }
          : undefined,
      textStyle: parseTextStyle(row.generation_hints?.textStyle),
      seniorPack:
        row.generation_hints?.seniorPack &&
        typeof row.generation_hints.seniorPack === "object"
          ? {
              personaId:
                (row.generation_hints.seniorPack as { personaId?: "planner" | "designer" | "performance" })
                  .personaId ?? "planner",
              evidence: Array.isArray((row.generation_hints.seniorPack as { evidence?: unknown[] }).evidence)
                ? ((row.generation_hints.seniorPack as { evidence?: unknown[] }).evidence ?? [])
                    .map((item) => String(item))
                    .filter(Boolean)
                : [],
              why:
                (row.generation_hints.seniorPack as { why?: Record<string, unknown> }).why &&
                typeof (row.generation_hints.seniorPack as { why?: unknown }).why === "object"
                  ? {
                      observations: Array.isArray(
                        ((row.generation_hints.seniorPack as { why?: any }).why?.observations),
                      )
                        ? ((row.generation_hints.seniorPack as { why?: any }).why.observations ?? [])
                            .map((item: unknown) => String(item))
                            .filter(Boolean)
                        : [],
                      interpretation: Array.isArray(
                        ((row.generation_hints.seniorPack as { why?: any }).why?.interpretation),
                      )
                        ? ((row.generation_hints.seniorPack as { why?: any }).why.interpretation ?? [])
                            .map((item: unknown) => String(item))
                            .filter(Boolean)
                        : [],
                      decisions: Array.isArray(
                        ((row.generation_hints.seniorPack as { why?: any }).why?.decisions),
                      )
                        ? ((row.generation_hints.seniorPack as { why?: any }).why.decisions ?? [])
                            .map((item: unknown) => String(item))
                            .filter(Boolean)
                        : [],
                      risks: Array.isArray(
                        ((row.generation_hints.seniorPack as { why?: any }).why?.risks),
                      )
                        ? ((row.generation_hints.seniorPack as { why?: any }).why.risks ?? [])
                            .map((item: unknown) => String(item))
                            .filter(Boolean)
                        : [],
                    }
                  : {
                      observations: [],
                      interpretation: [],
                      decisions: [],
                      risks: [],
                    },
              validation:
                (row.generation_hints.seniorPack as { validation?: Record<string, unknown> })
                  .validation &&
                typeof (row.generation_hints.seniorPack as { validation?: unknown }).validation ===
                  "object"
                  ? {
                      mustPass: Array.isArray(
                        ((row.generation_hints.seniorPack as { validation?: any }).validation?.mustPass),
                      )
                        ? ((row.generation_hints.seniorPack as { validation?: any }).validation.mustPass ??
                            [])
                            .map((item: unknown) => String(item))
                            .filter(Boolean)
                        : [],
                      autoFixRules: Array.isArray(
                        ((row.generation_hints.seniorPack as { validation?: any }).validation
                          ?.autoFixRules),
                      )
                        ? ((row.generation_hints.seniorPack as { validation?: any }).validation
                            .autoFixRules ?? [])
                            .map((item: unknown) => String(item))
                            .filter(Boolean)
                        : [],
                    }
                  : {
                      mustPass: [],
                      autoFixRules: [],
                    },
              strategy:
                (row.generation_hints.seniorPack as { strategy?: Record<string, unknown> }).strategy &&
                typeof (row.generation_hints.seniorPack as { strategy?: unknown }).strategy === "object"
                  ? ((row.generation_hints.seniorPack as { strategy?: Record<string, unknown> }).strategy ?? {})
                  : undefined,
              hypothesis:
                (row.generation_hints.seniorPack as { hypothesis?: Record<string, unknown> }).hypothesis &&
                typeof (row.generation_hints.seniorPack as { hypothesis?: unknown }).hypothesis ===
                  "object"
                  ? ((row.generation_hints.seniorPack as { hypothesis?: Record<string, unknown> })
                      .hypothesis ?? {})
                  : undefined,
              finalPrompt:
                typeof (row.generation_hints.seniorPack as { finalPrompt?: unknown }).finalPrompt ===
                "string"
                  ? String((row.generation_hints.seniorPack as { finalPrompt?: string }).finalPrompt)
                  : undefined,
              mode:
                typeof (row.generation_hints.seniorPack as { mode?: unknown }).mode === "string"
                  ? String((row.generation_hints.seniorPack as { mode?: string }).mode)
                  : undefined,
              missingInputs: Array.isArray(
                (row.generation_hints.seniorPack as { missingInputs?: unknown[] }).missingInputs,
              )
                ? ((row.generation_hints.seniorPack as { missingInputs?: unknown[] }).missingInputs ?? [])
                    .map((item) => String(item))
                    .filter(Boolean)
                : [],
            }
          : undefined,
    },
  };
}

function mergePromptOverride(
  base: StudioPromptDraft,
  override?: z.infer<typeof PromptOverrideSchema>,
): StudioPromptDraft {
  if (!override) return base;

  const copyToggles = override.generationHints?.copyToggles
    ? normalizeCopyTogglesFromUnknown(override.generationHints.copyToggles)
    : base.generationHints.copyToggles;
  const textStyle = override.generationHints?.textStyle
    ? parseTextStyle(override.generationHints.textStyle)
    : base.generationHints.textStyle;

  return {
    ...base,
    title: override.title?.trim() || base.title,
    copy: {
      headline: override.copy?.headline ?? base.copy.headline,
      subhead: override.copy?.subhead ?? base.copy.subhead,
      cta: override.copy?.cta ?? base.copy.cta,
      badges: Array.isArray(override.copy?.badges)
        ? override.copy!.badges
            .map((item) => String(item).trim())
            .filter(Boolean)
            .slice(0, 8)
        : base.copy.badges,
    },
    visual: {
      scene: override.visual?.scene ?? base.visual.scene,
      composition: override.visual?.composition ?? base.visual.composition,
      style: override.visual?.style ?? base.visual.style,
      lighting: override.visual?.lighting ?? base.visual.lighting,
      colorPaletteHint: override.visual?.colorPaletteHint ?? base.visual.colorPaletteHint,
      negative: override.visual?.negative ?? base.visual.negative,
    },
    generationHints: {
      ...base.generationHints,
      copyToggles,
      textStyle,
    },
  };
}

function buildStrictRetryPrompt(basePrompt: string, attempt: number, autoFixRules?: string[]) {
  return [
    basePrompt,
    "",
    `RETRY PASS ${attempt}`,
    "Increase Korean text legibility and exact spelling.",
    "Keep typography style and composition from previous instruction.",
    "Avoid garbled characters or broken glyph edges.",
    autoFixRules && autoFixRules.length > 0
      ? `Auto fix focus: ${autoFixRules.slice(0, 4).join(", ")}`
      : "",
  ].join("\n");
}

export async function POST(request: Request) {
  let shouldRefund = false;
  let refundCreditDelta = 0;
  let userId = "";

  try {
    const user = await requireStudioUserFromAuthHeader(request);
    userId = user.id;

    const payload = await request.json().catch(() => null);
    const parsed = GenerateBodySchema.safeParse(payload);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const issuePath =
        firstIssue && firstIssue.path.length > 0 ? firstIssue.path.join(".") : "body";
      const issueMessage = firstIssue?.message ?? "invalid payload";
      return NextResponse.json(
        {
          error: `생성 요청 형식이 올바르지 않습니다. (${issuePath}: ${issueMessage})`,
          detail: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const styleTransferMode = body.styleTransferMode ?? "style_transfer";
    const textAccuracyMode = body.textAccuracyMode ?? "normal";
    const priced = getModelPriceById(body.imageModelId, "1K");

    if (!priced) {
      return NextResponse.json({ error: "지원하지 않는 생성 모델입니다." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const [projectRes, promptRes, analysisRes] = await Promise.all([
      supabase
        .from("studio_projects")
        .select("id, title, user_id, reference_image_url, product_context")
        .eq("id", body.projectId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("studio_prompts")
        .select("id, role, title, copy_json, visual_json, generation_hints, project_id")
        .eq("id", body.promptId)
        .eq("project_id", body.projectId)
        .single(),
      supabase
        .from("studio_reference_analysis")
        .select("id, analysis_json, created_at")
        .eq("project_id", body.projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (projectRes.error || !projectRes.data) {
      if (projectRes.error?.code === "42P01") {
        return NextResponse.json(
          {
            error:
              "스튜디오 DB 마이그레이션이 아직 적용되지 않았습니다. Supabase SQL Editor에서 `supabase/migrations/20260216_000009_makedoc_studio_core.sql`을 실행해 주세요.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (promptRes.error || !promptRes.data) {
      return NextResponse.json({ error: "프롬프트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (analysisRes.error || !analysisRes.data) {
      return NextResponse.json(
        { error: "분석 데이터가 없습니다. 레퍼런스 분석을 먼저 실행해 주세요." },
        { status: 400 },
      );
    }

    const creditsToConsume = Math.max(1, priced.creditsRequired);

    const ensureRow = await supabase.from("user_model_credits").upsert(
      {
        user_id: user.id,
        image_model_id: UNIFIED_CREDIT_BUCKET_ID,
        balance: 0,
      },
      {
        onConflict: "user_id,image_model_id",
        ignoreDuplicates: true,
      },
    );

    if (ensureRow.error) {
      return NextResponse.json(
        { error: `크레딧 차감 준비에 실패했습니다. (${ensureRow.error.message})` },
        { status: 500 },
      );
    }

    const current = await supabase
      .from("user_model_credits")
      .select("balance")
      .eq("user_id", user.id)
      .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
      .single();

    if (current.error || !current.data) {
      return NextResponse.json(
        { error: `크레딧 잔액을 조회할 수 없습니다. (${current.error?.message ?? "unknown"})` },
        { status: 500 },
      );
    }

    const currentBalance = Number(current.data.balance);
    if (!Number.isFinite(currentBalance) || currentBalance < creditsToConsume) {
      await supabase.from("credit_ledger").insert({
        user_id: user.id,
        image_model_id: UNIFIED_CREDIT_BUCKET_ID,
        delta: 0,
        reason: "GENERATE",
        ref_id: body.promptId,
        meta_json: {
          status: "insufficient",
          source: "consume-unified",
          requested_model: body.imageModelId,
          required_credits: creditsToConsume,
        },
      });

      return NextResponse.json(
        {
          error: "크레딧이 부족합니다.",
          code: "INSUFFICIENT_CREDIT",
          balance: Number.isFinite(currentBalance) ? currentBalance : 0,
          requiredCredits: creditsToConsume,
        },
        { status: 402 },
      );
    }

    const nextBalance = currentBalance - creditsToConsume;
    const updated = await supabase
      .from("user_model_credits")
      .update({ balance: nextBalance })
      .eq("user_id", user.id)
      .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
      .select("balance")
      .single();

    if (updated.error || !updated.data) {
      return NextResponse.json(
        { error: `크레딧 차감에 실패했습니다. (${updated.error?.message ?? "unknown"})` },
        { status: 500 },
      );
    }

    const ledgerInsert = await supabase.from("credit_ledger").insert({
      user_id: user.id,
      image_model_id: UNIFIED_CREDIT_BUCKET_ID,
      delta: -creditsToConsume,
      reason: "GENERATE",
      ref_id: body.promptId,
      meta_json: {
        source: "consume-unified",
        requested_model: body.imageModelId,
        unit_krw: CREDIT_WON_UNIT,
        credits_used: creditsToConsume,
      },
    });

    if (ledgerInsert.error) {
      return NextResponse.json(
        { error: `크레딧 원장 기록에 실패했습니다. (${ledgerInsert.error.message})` },
        { status: 500 },
      );
    }

    const balanceAfter = Number(updated.data.balance);

    shouldRefund = true;
    refundCreditDelta = creditsToConsume;

    const promptDraft = mergePromptOverride(
      extractPromptDraft({
        id: promptRes.data.id,
        role: promptRes.data.role,
        title: promptRes.data.title,
        copy_json: promptRes.data.copy_json as Record<string, unknown>,
        visual_json: promptRes.data.visual_json as Record<string, unknown>,
        generation_hints: promptRes.data.generation_hints as Record<string, unknown>,
      }),
      body.promptOverride,
    );

    const productContext = (projectRes.data.product_context as Record<string, unknown>) ?? {};
    const analysisJson = analysisRes.data.analysis_json as ReferenceAnalysis;

    const generationPrompt = await buildStudioImagePrompt({
      analysis: analysisJson,
      prompt: promptDraft,
      productContext,
      aspectRatio: body.aspectRatio,
      textMode: body.textMode,
      styleTransferMode,
      textAccuracyMode,
    });

    const referenceImageUrl = projectRes.data.reference_image_url?.trim();
    const referenceInlineData =
      referenceImageUrl && referenceImageUrl !== "about:blank"
        ? await toInlineDataFromUrlSafe(referenceImageUrl, "레퍼런스 이미지")
        : null;
    if (styleTransferMode === "reference_retext" && !referenceInlineData) {
      return NextResponse.json(
        { error: "문구 교체(고정) 생성은 레퍼런스 이미지가 필요합니다." },
        { status: 400 },
      );
    }
    const productImageUrl = getOptionalUrlValue(productContext, "productImageUrl");
    const logoImageUrl = getOptionalUrlValue(productContext, "logoImageUrl");
    const [productInlineData, logoInlineData] = await Promise.all([
      productImageUrl
        ? toInlineDataFromUrlSafe(productImageUrl, "제품 이미지")
        : Promise.resolve(null),
      logoImageUrl ? toInlineDataFromUrlSafe(logoImageUrl, "로고 이미지") : Promise.resolve(null),
    ]);

    const typographyInlineData =
      body.textMode === "in_image" && referenceImageUrl
        ? await buildTypographyCropInlineData({
            imageUrl: referenceImageUrl,
            headlineBox: analysisJson.layoutBBoxes.headline,
          })
        : null;

    const hasTextTargets =
      promptDraft.copy.headline.trim().length > 0 ||
      promptDraft.copy.subhead.trim().length > 0 ||
      promptDraft.copy.cta.trim().length > 0 ||
      promptDraft.copy.badges.some((item) => item.trim().length > 0);
    const shouldStrictRetry =
      textAccuracyMode === "strict" && body.textMode === "in_image" && hasTextTargets;
    const runtimeCandidates = resolveRuntimeModelCandidates(body.imageModelId, {
      preferQuality: shouldStrictRetry,
    });
    const maxAttempts = shouldStrictRetry ? 3 : 1;
    const fidelityThreshold = 80;

    let generated: Awaited<ReturnType<typeof generateImageWithGeminiAdvanced>> | null = null;
    let generatedScore: number | null = null;
    let lastModelError: Error | null = null;
    let bestGenerated: Awaited<ReturnType<typeof generateImageWithGeminiAdvanced>> | null = null;
    let bestScore = -1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const promptForAttempt =
        attempt === 1
          ? generationPrompt
          : buildStrictRetryPrompt(
              generationPrompt,
              attempt,
              promptDraft.generationHints.seniorPack?.validation?.autoFixRules ?? [],
            );

      let generatedAttempt: Awaited<ReturnType<typeof generateImageWithGeminiAdvanced>> | null = null;
      for (const runtimeModel of runtimeCandidates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          generatedAttempt = await generateImageWithGeminiAdvanced({
            model: runtimeModel,
            prompt: promptForAttempt,
            aspectRatio: body.aspectRatio,
            responseModalities: ["IMAGE"],
            ...(referenceInlineData ? { referenceInlineData } : {}),
            ...(typographyInlineData ? { typographyInlineData } : {}),
            ...(productInlineData ? { productInlineData } : {}),
            ...(logoInlineData ? { logoInlineData } : {}),
          });
          break;
        } catch (error) {
          lastModelError = error instanceof Error ? error : new Error(String(error));
        }
      }

      if (!generatedAttempt) {
        continue;
      }

      if (!shouldStrictRetry) {
        generated = generatedAttempt;
        break;
      }

      const score = await estimateTextFidelityScore({
        imageUrl: `data:${generatedAttempt.mimeType};base64,${generatedAttempt.base64}`,
        intendedHeadline: promptDraft.copy.headline,
        intendedCta: promptDraft.copy.cta,
      });

      if ((score ?? -1) > bestScore) {
        bestScore = score ?? -1;
        bestGenerated = generatedAttempt;
      }

      if (score !== null && score >= fidelityThreshold) {
        generated = generatedAttempt;
        generatedScore = score;
        break;
      }
    }

    if (!generated) {
      generated = bestGenerated;
      generatedScore = bestScore >= 0 ? bestScore : null;
    }
    if (!generated) {
      throw lastModelError ?? new Error("사용 가능한 이미지 생성 모델을 찾지 못했습니다.");
    }

    const generationId = crypto.randomUUID();
    const ext = generated.mimeType.includes("jpeg") ? "jpg" : "png";
    const storagePath = `users/${user.id}/projects/${body.projectId}/${generationId}.${ext}`;

    const upload = await supabase.storage
      .from("studio-assets")
      .upload(storagePath, Buffer.from(generated.base64, "base64"), {
        contentType: generated.mimeType,
        upsert: false,
      });

    if (upload.error) {
      throw new Error(`생성 이미지 저장에 실패했습니다. (${upload.error.message})`);
    }

    const imageUrl = supabase.storage.from("studio-assets").getPublicUrl(storagePath).data.publicUrl;

    const textFidelityScore =
      body.textMode === "no_text"
        ? null
        : generatedScore ??
          (await estimateTextFidelityScore({
            imageUrl,
            intendedHeadline: promptDraft.copy.headline,
            intendedCta: promptDraft.copy.cta,
          }));

    const insertRes = await supabase
      .from("studio_generations")
      .insert({
        id: generationId,
        user_id: user.id,
        project_id: body.projectId,
        prompt_id: body.promptId,
        image_model_id: body.imageModelId,
        image_url: imageUrl,
        aspect_ratio: body.aspectRatio,
        cost_usd: priced.costUsd,
        cost_krw: priced.costKrw,
        sell_krw: priced.sellKrw,
        text_fidelity_score: textFidelityScore,
      })
      .select(
        "id, project_id, prompt_id, image_model_id, image_url, aspect_ratio, cost_usd, cost_krw, sell_krw, text_fidelity_score, created_at",
      )
      .single();

    if (insertRes.error || !insertRes.data) {
      throw new Error(
        `생성 결과 저장에 실패했습니다. (${insertRes.error?.message ?? "unknown"})`,
      );
    }

    shouldRefund = false;

    return NextResponse.json(
      {
        generation: {
          id: insertRes.data.id,
          projectId: insertRes.data.project_id,
          promptId: insertRes.data.prompt_id,
          imageModelId: insertRes.data.image_model_id,
          imageUrl: insertRes.data.image_url,
          aspectRatio: insertRes.data.aspect_ratio,
          costUsd: insertRes.data.cost_usd,
          costKrw: insertRes.data.cost_krw,
          sellKrw: insertRes.data.sell_krw,
          textFidelityScore: insertRes.data.text_fidelity_score,
          createdAt: insertRes.data.created_at,
        },
        balanceAfter,
        creditsUsed: creditsToConsume,
        message: "이미지 생성이 완료되었습니다.",
      },
      { status: 200 },
    );
  } catch (error) {
    if (shouldRefund && refundCreditDelta > 0 && userId) {
      try {
        const supabase = getSupabaseServiceClient();
        await supabase.from("user_model_credits").upsert(
          {
            user_id: userId,
            image_model_id: UNIFIED_CREDIT_BUCKET_ID,
            balance: 0,
          },
          {
            onConflict: "user_id,image_model_id",
            ignoreDuplicates: true,
          },
        );

        const current = await supabase
          .from("user_model_credits")
          .select("balance")
          .eq("user_id", userId)
          .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
          .single();

        if (!current.error && current.data) {
          await supabase
            .from("user_model_credits")
            .update({ balance: Number(current.data.balance) + refundCreditDelta })
            .eq("user_id", userId)
            .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID);

          await supabase.from("credit_ledger").insert({
            user_id: userId,
            image_model_id: UNIFIED_CREDIT_BUCKET_ID,
            delta: refundCreditDelta,
            reason: "REFUND",
            ref_id: null,
            meta_json: {
              source: "generate-refund-unified",
            },
          });
        }
      } catch {
        // no-op
      }
    }

    const message = error instanceof Error ? error.message : "이미지 생성에 실패했습니다.";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json(
      {
        error:
          status === 500
            ? `생성 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요. (${message})`
            : message,
      },
      { status },
    );
  }
}
