import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  analyzeReferenceAndBuildPrompts,
  generateConceptPromptsWithoutReference,
} from "@/lib/studio/gemini.server";
import { generateImageWithGeminiAdvanced } from "@/lib/gemini";
import {
  buildStudioDirectImagePrompt,
  buildStudioImagePrompt,
  normalizeCopyToggles,
} from "@/lib/studio/promptBuilders.server";
import {
  fillStudioTemplate,
  loadStudioPromptTemplate,
} from "@/lib/studio/promptLibrary.server";
import type {
  ProductContext,
  PromptTextStyleControls,
  ReferenceAnalysis,
  StudioPromptDraft,
  TextEffectTone,
  TextFontStyleTone,
} from "@/lib/studio/types";

type InlineData = {
  mimeType: string;
  data: string;
};

const TextStyleSlotSchema = z.object({
  fontTone: z.enum(["auto", "gothic", "myeongjo", "rounded", "calligraphy"]),
  effectTone: z.enum(["auto", "clean", "shadow", "outline", "emboss", "bubble"]),
});

const TextStyleSchema = z.object({
  headline: TextStyleSlotSchema.optional(),
  subhead: TextStyleSlotSchema.optional(),
  cta: TextStyleSlotSchema.optional(),
  badge: TextStyleSlotSchema.optional(),
});

const CopyTogglesSchema = z.object({
  useSubcopy: z.boolean().optional(),
  useCTA: z.boolean().optional(),
  useBadge: z.boolean().optional(),
});

const ProductContextSchema = z.object({
  brandName: z.string().max(160).optional(),
  productName: z.string().max(160).optional(),
  category: z.string().max(120).optional(),
  target: z.string().max(400).optional(),
  offer: z.string().max(200).optional(),
  platform: z.string().max(80).optional(),
  tone: z.string().max(80).optional(),
  ratio: z.enum(["1:1", "4:5", "9:16"]).optional(),
  benefits: z.array(z.string().max(120)).max(10).optional(),
  bannedWords: z.array(z.string().max(120)).max(20).optional(),
  productImageUrl: z.string().url().optional(),
  logoImageUrl: z.string().url().optional(),
  typographyReferenceImageUrl: z.string().url().optional(),
});

const BoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const ReferenceAnalysisSchema = z.object({
  layoutBBoxes: z.object({
    headline: BoxSchema,
    subhead: BoxSchema,
    product: BoxSchema,
    cta: BoxSchema,
  }),
  palette: z.array(z.string()).max(12),
  moodKeywords: z.array(z.string()).max(20),
  hookPattern: z.string().max(120),
  typographyStyle: z.string().max(220),
  readabilityWarnings: z.array(z.string()).max(20),
  strongPoints: z.array(z.string()).max(12),
  referenceInsights: z
    .object({
      visualFacts: z.record(z.string(), z.unknown()).optional(),
      persuasionFacts: z.record(z.string(), z.unknown()).optional(),
      channelRisk: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  missingInputs: z.array(z.string()).max(20).optional(),
});

const PromptDraftSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["PLANNER", "MARKETER", "DESIGNER"]),
  title: z.string().min(1).max(200),
  copy: z.object({
    headline: z.string().max(500),
    subhead: z.string().max(500),
    cta: z.string().max(200),
    badges: z.array(z.string().max(120)).max(10),
  }),
  visual: z.object({
    scene: z.string().max(3000),
    composition: z.string().max(2000),
    style: z.string().max(2000),
    lighting: z.string().max(1200),
    colorPaletteHint: z.string().max(1200),
    negative: z.string().max(4000),
  }),
  generationHints: z.object({
    aspectRatioDefault: z.enum(["1:1", "4:5", "9:16"]),
    textModeDefault: z.enum(["in_image", "minimal_text", "no_text"]),
    copyToggles: CopyTogglesSchema.optional(),
    textStyle: TextStyleSchema.optional(),
  }),
});

const AnalyzeReferenceActionSchema = z.object({
  action: z.literal("analyze_reference"),
  referenceImageUrl: z.string().url(),
  productContext: ProductContextSchema.optional(),
  copyToggles: CopyTogglesSchema.optional(),
  analysisModel: z.string().max(80).optional(),
});

const AnalyzeNoReferenceActionSchema = z.object({
  action: z.literal("analyze_no_reference"),
  productContext: ProductContextSchema.optional(),
  copyToggles: CopyTogglesSchema.optional(),
  analysisModel: z.string().max(80).optional(),
});

const BuildImagePromptActionSchema = z.object({
  action: z.literal("build_image_prompt"),
  analysis: ReferenceAnalysisSchema.optional(),
  prompt: PromptDraftSchema,
  productContext: ProductContextSchema.optional(),
  aspectRatio: z.enum(["1:1", "4:5", "9:16"]),
  textMode: z.enum(["in_image", "minimal_text", "no_text"]),
  styleTransferMode: z.enum(["style_transfer", "reference_retext"]).optional(),
  textAccuracyMode: z.enum(["normal", "strict"]).optional(),
});

const PreviewImageActionSchema = BuildImagePromptActionSchema.extend({
  action: z.literal("preview_image"),
  imageModelId: z.string().min(1),
  referenceImageUrl: z.string().url().optional(),
  productImageUrl: z.string().url().optional(),
  logoImageUrl: z.string().url().optional(),
});

const BuildDirectPromptActionSchema = z.object({
  action: z.literal("build_direct_prompt"),
  visual: z.string().max(3000),
  headline: z.string().max(500),
  subhead: z.string().max(500).optional(),
  cta: z.string().max(200).optional(),
  extraTexts: z
    .array(
      z.object({
        label: z.string().max(80),
        value: z.string().max(200),
      }),
    )
    .max(10)
    .optional(),
  negative: z.string().max(4000).optional(),
  productContext: ProductContextSchema.optional(),
  aspectRatio: z.enum(["1:1", "4:5", "9:16"]),
  textMode: z.enum(["in_image", "minimal_text", "no_text"]),
  copyToggles: CopyTogglesSchema.optional(),
  textStyle: TextStyleSchema.optional(),
});

const PreviewDirectActionSchema = BuildDirectPromptActionSchema.extend({
  action: z.literal("preview_direct"),
  imageModelId: z.string().min(1),
  referenceImageUrl: z.string().url().optional(),
  productImageUrl: z.string().url().optional(),
  logoImageUrl: z.string().url().optional(),
});

const RenderTemplateActionSchema = z.object({
  action: z.literal("render_template"),
  filename: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._-]+\.md$/),
  variables: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

const ActionSchema = z.discriminatedUnion("action", [
  AnalyzeReferenceActionSchema,
  AnalyzeNoReferenceActionSchema,
  BuildImagePromptActionSchema,
  PreviewImageActionSchema,
  BuildDirectPromptActionSchema,
  PreviewDirectActionSchema,
  RenderTemplateActionSchema,
]);

const IMAGE_RUNTIME_FALLBACKS = (
  process.env.GEMINI_IMAGE_MODELS ||
  "gemini-3-pro-image-preview,gemini-2.0-flash-exp-image-generation"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function defaultAnalysis(): ReferenceAnalysis {
  return {
    layoutBBoxes: {
      headline: [0.08, 0.1, 0.72, 0.2],
      subhead: [0.08, 0.33, 0.6, 0.14],
      product: [0.58, 0.12, 0.32, 0.55],
      cta: [0.08, 0.78, 0.28, 0.12],
    },
    palette: ["#0B0B0C", "#F5F5F0", "#D6FF4F"],
    moodKeywords: ["premium", "minimal"],
    hookPattern: "PREMIUM_POSITIONING",
    typographyStyle: "REFERENCE_DRIVEN",
    readabilityWarnings: [],
    strongPoints: ["대비 중심 구성", "명확한 시선 흐름"],
  };
}

function parseFontTone(value: unknown): TextFontStyleTone {
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

function parseEffectTone(value: unknown): TextEffectTone {
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

function normalizeTextStyleControls(
  value?: z.infer<typeof TextStyleSchema>,
): PromptTextStyleControls {
  return {
    headline: {
      fontTone: parseFontTone(value?.headline?.fontTone),
      effectTone: parseEffectTone(value?.headline?.effectTone),
    },
    subhead: {
      fontTone: parseFontTone(value?.subhead?.fontTone),
      effectTone: parseEffectTone(value?.subhead?.effectTone),
    },
    cta: {
      fontTone: parseFontTone(value?.cta?.fontTone),
      effectTone: parseEffectTone(value?.cta?.effectTone),
    },
    badge: {
      fontTone: parseFontTone(value?.badge?.fontTone),
      effectTone: parseEffectTone(value?.badge?.effectTone),
    },
  };
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

async function toInlineDataFromUrlSafe(imageUrl?: string, label = "이미지") {
  if (!imageUrl) return null;
  try {
    return await toInlineDataFromUrl(imageUrl, label);
  } catch {
    return null;
  }
}

async function buildTypographyCropInlineData(input: {
  imageUrl?: string;
  headlineBox?: [number, number, number, number];
}): Promise<InlineData | null> {
  if (!input.imageUrl || !input.headlineBox) return null;
  try {
    const response = await fetch(input.imageUrl);
    if (!response.ok) return null;

    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const image = sharp(sourceBuffer, { failOn: "none" });
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 8 || height < 8) return null;

    const [x, y, w, h] = input.headlineBox.map((value) =>
      clampUnit(Number(value)),
    ) as [number, number, number, number];
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

function resolveRuntimeModelCandidates(
  selectedModelId: string,
  options?: { preferQuality?: boolean },
) {
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

  return Array.from(new Set(ordered)).filter(Boolean);
}

function toStudioPromptDraft(input: z.infer<typeof PromptDraftSchema>): StudioPromptDraft {
  return {
    id: input.id,
    role: input.role,
    title: input.title,
    copy: {
      headline: input.copy.headline,
      subhead: input.copy.subhead,
      cta: input.copy.cta,
      badges: input.copy.badges,
    },
    visual: {
      scene: input.visual.scene,
      composition: input.visual.composition,
      style: input.visual.style,
      lighting: input.visual.lighting,
      colorPaletteHint: input.visual.colorPaletteHint,
      negative: input.visual.negative,
    },
    generationHints: {
      aspectRatioDefault: input.generationHints.aspectRatioDefault,
      textModeDefault: input.generationHints.textModeDefault,
      copyToggles: normalizeCopyToggles(input.generationHints.copyToggles),
      textStyle: normalizeTextStyleControls(input.generationHints.textStyle),
    },
  };
}

async function generateImagePreview(input: {
  prompt: string;
  imageModelId: string;
  aspectRatio: "1:1" | "4:5" | "9:16";
  textMode: "in_image" | "minimal_text" | "no_text";
  textAccuracyMode?: "normal" | "strict";
  referenceImageUrl?: string;
  productImageUrl?: string;
  logoImageUrl?: string;
  headlineBox?: [number, number, number, number];
}) {
  const [referenceInlineData, productInlineData, logoInlineData, typographyInlineData] =
    await Promise.all([
      toInlineDataFromUrlSafe(input.referenceImageUrl, "레퍼런스 이미지"),
      toInlineDataFromUrlSafe(input.productImageUrl, "제품 이미지"),
      toInlineDataFromUrlSafe(input.logoImageUrl, "로고 이미지"),
      buildTypographyCropInlineData({
        imageUrl: input.referenceImageUrl,
        headlineBox: input.textMode === "in_image" ? input.headlineBox : undefined,
      }),
    ]);

  const runtimeCandidates = resolveRuntimeModelCandidates(input.imageModelId, {
    preferQuality:
      input.textAccuracyMode === "strict" && input.textMode === "in_image",
  });

  let lastError: Error | null = null;
  for (const model of runtimeCandidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const generated = await generateImageWithGeminiAdvanced({
        model,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        responseModalities: ["IMAGE"],
        ...(referenceInlineData ? { referenceInlineData } : {}),
        ...(typographyInlineData ? { typographyInlineData } : {}),
        ...(productInlineData ? { productInlineData } : {}),
        ...(logoInlineData ? { logoInlineData } : {}),
      });

      return {
        model,
        image: {
          mimeType: generated.mimeType,
          base64: generated.base64,
          dataUrl: generated.dataUrl,
        },
        debug: {
          runtimeCandidates,
          referenceUsed: Boolean(referenceInlineData),
          typographyCropUsed: Boolean(typographyInlineData),
          productUsed: Boolean(productInlineData),
          logoUsed: Boolean(logoInlineData),
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("이미지 미리보기에 실패했습니다.");
}

function normalizeTemplateVariables(
  input?: Record<string, string | number | boolean | null>,
): Record<string, string | number | null | undefined> {
  const out: Record<string, string | number | null | undefined> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (typeof value === "boolean") {
      out[key] = value ? "true" : "false";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = ActionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "요청 형식이 올바르지 않습니다.",
          detail: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const body = parsed.data;

    if (body.action === "render_template") {
      const template = await loadStudioPromptTemplate(body.filename);
      const rendered = fillStudioTemplate(
        template,
        normalizeTemplateVariables(body.variables),
      );
      return NextResponse.json({ prompt: rendered }, { status: 200 });
    }

    if (body.action === "analyze_reference") {
      const result = await analyzeReferenceAndBuildPrompts({
        referenceImageUrl: body.referenceImageUrl,
        productContext: (body.productContext ?? {}) as ProductContext,
        copyToggles: body.copyToggles,
        analysisModel: body.analysisModel,
      });
      return NextResponse.json(result, { status: 200 });
    }

    if (body.action === "analyze_no_reference") {
      const result = await generateConceptPromptsWithoutReference({
        productContext: (body.productContext ?? {}) as ProductContext,
        copyToggles: body.copyToggles,
        analysisModel: body.analysisModel,
      });
      return NextResponse.json(result, { status: 200 });
    }

    if (body.action === "build_image_prompt" || body.action === "preview_image") {
      const promptDraft = toStudioPromptDraft(body.prompt);
      const analysis = (body.analysis ?? defaultAnalysis()) as ReferenceAnalysis;
      const productContext = (body.productContext ?? {}) as ProductContext;

      const finalPrompt = await buildStudioImagePrompt({
        analysis,
        prompt: promptDraft,
        productContext,
        aspectRatio: body.aspectRatio,
        textMode: body.textMode,
        styleTransferMode: body.styleTransferMode ?? "style_transfer",
        textAccuracyMode: body.textAccuracyMode ?? "normal",
      });

      if (body.action === "build_image_prompt") {
        return NextResponse.json(
          {
            finalPrompt,
            promptDraft,
            analysis,
          },
          { status: 200 },
        );
      }

      const preview = await generateImagePreview({
        prompt: finalPrompt,
        imageModelId: body.imageModelId,
        aspectRatio: body.aspectRatio,
        textMode: body.textMode,
        textAccuracyMode: body.textAccuracyMode ?? "normal",
        referenceImageUrl: body.referenceImageUrl,
        productImageUrl: body.productImageUrl ?? productContext.productImageUrl,
        logoImageUrl: body.logoImageUrl ?? productContext.logoImageUrl,
        headlineBox: analysis.layoutBBoxes.headline,
      });

      return NextResponse.json(
        {
          finalPrompt,
          ...preview,
        },
        { status: 200 },
      );
    }

    if (body.action === "build_direct_prompt" || body.action === "preview_direct") {
      const productContext = (body.productContext ?? {}) as ProductContext;
      const finalPrompt = await buildStudioDirectImagePrompt({
        visual: body.visual,
        headline: body.headline,
        subhead: body.subhead ?? "",
        cta: body.cta ?? "",
        extraTexts: body.extraTexts ?? [],
        negative: body.negative ?? "",
        productContext,
        aspectRatio: body.aspectRatio,
        textMode: body.textMode,
        copyToggles: body.copyToggles,
        textStyle: normalizeTextStyleControls(body.textStyle),
      });

      if (body.action === "build_direct_prompt") {
        return NextResponse.json({ finalPrompt }, { status: 200 });
      }

      const preview = await generateImagePreview({
        prompt: finalPrompt,
        imageModelId: body.imageModelId,
        aspectRatio: body.aspectRatio,
        textMode: body.textMode,
        textAccuracyMode: "normal",
        referenceImageUrl: body.referenceImageUrl,
        productImageUrl: body.productImageUrl ?? productContext.productImageUrl,
        logoImageUrl: body.logoImageUrl ?? productContext.logoImageUrl,
      });
      return NextResponse.json(
        {
          finalPrompt,
          ...preview,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프롬프트 실험 처리 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
