import {
  BENCHMARK_PROMPT,
  BENCHMARK_STRATEGY_PROMPT,
  TEMPLATE_STYLE_PROMPT,
  buildPrompt,
} from "@/lib/prompts";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3-pro-preview";
const GEMINI_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "45000", 10);
const IMAGE_MODEL_CANDIDATES = (
  process.env.GEMINI_IMAGE_MODELS ||
  "gemini-3-pro-image-preview,gemini-2.0-flash-exp-image-generation"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export type BenchmarkAnalysis = {
  composition: string[];
  style: string[];
  appeal_points: string[];
  copy_angle?: string[];
  color_tone?: string[];
  notes?: string;
  raw_text?: string;
};

export type GeneratedCopy = {
  headline: string;
  subText: string;
  cta: string;
};

export type BenchmarkStrategyCell = {
  benchmark_feature: string;
  why: string;
  action_plan: string;
};

export type BenchmarkStrategyOutput = {
  smart_fact_finding: {
    headline: string;
    sub_text: string;
    cta: string;
    numbers_or_claims: string[];
  };
  decoding: {
    psychological_triggers: string[];
    layout_intent: string;
  };
  strategy_table: {
    visual_guide: BenchmarkStrategyCell;
    main_headline: BenchmarkStrategyCell;
    sub_text: BenchmarkStrategyCell;
    cta_button: BenchmarkStrategyCell;
  };
  nano_input: {
    image_specs: {
      ratio: string;
      pixels: string;
    };
    visual_guide_en: string;
    main_headline: string;
    sub_text: string;
    cta_button: string;
  };
};

export type TemplateStyleOutput = {
  visual_guide: string;
  headline_style: string;
  sub_text_style: string;
  cta_style: string;
  palette?: {
    background: string;
    primary_text: string;
    accent: string;
  };
  notes?: string;
};

export type InlineData = {
  mimeType: string;
  data: string;
};

type ImageInput = {
  file?: File;
  url?: string;
};

export function inlineDataFromBase64(
  base64OrDataUrl: string,
  fallbackMimeType = "image/png",
): InlineData {
  const trimmed = base64OrDataUrl.trim();
  if (!trimmed) {
    throw new Error("Empty base64 payload.");
  }

  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], data: match[2] };
    }
  }

  // Raw base64 (no prefix)
  return { mimeType: fallbackMimeType, data: trimmed };
}

function requireGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }
  return apiKey;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafe(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503;
}

async function callGeminiModel(model: string, payload: unknown) {
  const apiKey = requireGeminiApiKey();
  const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const raw = await response.text();
      const json = parseJsonSafe(raw);
      if (!response.ok) {
        const detail =
          json?.error?.message ||
          `Gemini request failed with status ${response.status}.`;

        if (isRetryableStatus(response.status) && attempt < maxAttempts) {
          await sleep(600 * attempt);
          continue;
        }
        throw new Error(detail);
      }

      if (!json) {
        throw new Error("Gemini returned non-JSON response.");
      }

      return json;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(
          `Gemini request timeout after ${GEMINI_TIMEOUT_MS}ms for model ${model}.`,
        );
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
      if (attempt < maxAttempts) {
        await sleep(600 * attempt);
        continue;
      }
    }
  }

  throw lastError ?? new Error("Gemini request failed.");
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

function extractInlineDataFromGemini(json: any): InlineData | null {
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    for (const part of parts) {
      if (part?.inlineData?.data && part?.inlineData?.mimeType) {
        return {
          mimeType: String(part.inlineData.mimeType),
          data: String(part.inlineData.data),
        };
      }
    }
  }
  return null;
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

function toSafeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function toSafeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toSafeString(item))
      .filter(Boolean);
  }
  const one = toSafeString(value);
  return one ? [one] : [];
}

function normalizeStrategyCell(value: unknown): BenchmarkStrategyCell {
  const obj =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    benchmark_feature: toSafeString(obj.benchmark_feature),
    why: toSafeString(obj.why),
    action_plan: toSafeString(obj.action_plan),
  };
}

function normalizeBenchmarkStrategyOutput(
  raw: unknown,
  fallback: {
    ratio: string;
    width: number;
    height: number;
  },
): BenchmarkStrategyOutput {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const smart =
    obj.smart_fact_finding && typeof obj.smart_fact_finding === "object"
      ? (obj.smart_fact_finding as Record<string, unknown>)
      : {};
  const decoding =
    obj.decoding && typeof obj.decoding === "object"
      ? (obj.decoding as Record<string, unknown>)
      : {};
  const table =
    obj.strategy_table && typeof obj.strategy_table === "object"
      ? (obj.strategy_table as Record<string, unknown>)
      : {};
  const nano =
    obj.nano_input && typeof obj.nano_input === "object"
      ? (obj.nano_input as Record<string, unknown>)
      : {};
  const specs =
    nano.image_specs && typeof nano.image_specs === "object"
      ? (nano.image_specs as Record<string, unknown>)
      : {};

  return {
    smart_fact_finding: {
      headline: toSafeString(smart.headline),
      sub_text: toSafeString(smart.sub_text),
      cta: toSafeString(smart.cta),
      numbers_or_claims: toSafeStringArray(smart.numbers_or_claims),
    },
    decoding: {
      psychological_triggers: toSafeStringArray(decoding.psychological_triggers),
      layout_intent: toSafeString(decoding.layout_intent),
    },
    strategy_table: {
      visual_guide: normalizeStrategyCell(table.visual_guide),
      main_headline: normalizeStrategyCell(table.main_headline),
      sub_text: normalizeStrategyCell(table.sub_text),
      cta_button: normalizeStrategyCell(table.cta_button),
    },
    nano_input: {
      image_specs: {
        ratio: toSafeString(specs.ratio, fallback.ratio),
        pixels: toSafeString(
          specs.pixels,
          `${fallback.width}x${fallback.height}`,
        ),
      },
      visual_guide_en: toSafeString(nano.visual_guide_en),
      main_headline: toSafeString(nano.main_headline),
      sub_text: toSafeString(nano.sub_text),
      cta_button: toSafeString(nano.cta_button),
    },
  };
}

function normalizeTemplateStyleOutput(raw: unknown): TemplateStyleOutput {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const palette =
    obj.palette && typeof obj.palette === "object"
      ? (obj.palette as Record<string, unknown>)
      : {};

  return {
    visual_guide: toSafeString(obj.visual_guide),
    headline_style: toSafeString(obj.headline_style),
    sub_text_style: toSafeString(obj.sub_text_style),
    cta_style: toSafeString(obj.cta_style),
    palette: {
      background: toSafeString(palette.background),
      primary_text: toSafeString(palette.primary_text),
      accent: toSafeString(palette.accent),
    },
    notes: toSafeString(obj.notes),
  };
}

async function toInlineData({ file, url }: ImageInput): Promise<InlineData> {
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    return {
      mimeType: file.type || "image/png",
      data: Buffer.from(arrayBuffer).toString("base64"),
    };
  }

  if (url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch image URL.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") || "image/png";
    return {
      mimeType,
      data: Buffer.from(arrayBuffer).toString("base64"),
    };
  }

  throw new Error("No image input provided.");
}

export async function analyzeReferenceWithGemini(input: {
  referenceImageFile?: File;
  referenceImageUrl?: string;
}): Promise<BenchmarkAnalysis> {
  const inlineData = await toInlineData({
    file: input.referenceImageFile,
    url: input.referenceImageUrl,
  });

  const response = await callGeminiModel(TEXT_MODEL, {
    contents: [
      {
        role: "user",
        parts: [{ text: BENCHMARK_PROMPT }, { inlineData }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
    },
  });

  const text = extractTextFromGemini(response);
  const parsed = tryParseJson<BenchmarkAnalysis>(text);
  if (parsed) {
    return parsed;
  }

  return {
    composition: [],
    style: [],
    appeal_points: [],
    notes: "Failed to parse JSON response, using raw fallback.",
    raw_text: text,
  };
}

export async function analyzeBenchmarkStrategyWithGemini(input: {
  referenceImageFile?: File;
  referenceImageUrl?: string;
  productName?: string;
  targetCustomer?: string;
  usp?: string;
  problem?: string;
  imageRatio?: string;
  width: number;
  height: number;
}): Promise<BenchmarkStrategyOutput> {
  const inlineData = await toInlineData({
    file: input.referenceImageFile,
    url: input.referenceImageUrl,
  });

  const ratio = input.imageRatio || "1:1";
  const prompt = buildPrompt(BENCHMARK_STRATEGY_PROMPT, {
    PRODUCT_NAME: input.productName || "-",
    TARGET_CUSTOMER: input.targetCustomer || "-",
    USP: input.usp || "-",
    PROBLEM: input.problem || "-",
    IMAGE_RATIO: ratio,
    WIDTH: input.width,
    HEIGHT: input.height,
  });

  const response = await callGeminiModel(TEXT_MODEL, {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
    },
  });

  const text = extractTextFromGemini(response);
  const parsed = tryParseJson<BenchmarkStrategyOutput>(text);
  return normalizeBenchmarkStrategyOutput(parsed, {
    ratio,
    width: input.width,
    height: input.height,
  });
}

export async function analyzeTemplateStyleWithGemini(input: {
  referenceImageFile?: File;
  referenceImageUrl?: string;
  width: number;
  height: number;
}): Promise<TemplateStyleOutput> {
  const inlineData = await toInlineData({
    file: input.referenceImageFile,
    url: input.referenceImageUrl,
  });

  const prompt = buildPrompt(TEMPLATE_STYLE_PROMPT, {
    WIDTH: input.width,
    HEIGHT: input.height,
  });

  const response = await callGeminiModel(TEXT_MODEL, {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData }],
      },
    ],
    generationConfig: {
      temperature: 0.25,
    },
  });

  const text = extractTextFromGemini(response);
  const parsed = tryParseJson<TemplateStyleOutput>(text);
  return normalizeTemplateStyleOutput(parsed);
}

export async function generateCopyWithGemini(input: {
  visualGuide: string;
  scenario: string;
  analysis?: BenchmarkAnalysis | null;
}): Promise<GeneratedCopy> {
  const prompt = `
You are a senior Korean direct-response marketer.
Create conversion-focused Korean ad copy based on the visual direction.
Tone: concise, concrete, non-generic.
Return JSON only.

SCENARIO: ${input.scenario}
VISUAL_GUIDE:
${input.visualGuide}

REFERENCE_ANALYSIS:
${JSON.stringify(input.analysis ?? {}, null, 2)}

JSON format:
{
  "headline": "...",
  "subText": "...",
  "cta": "..."
}
`.trim();

  const response = await callGeminiModel(TEXT_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7 },
  });

  const text = extractTextFromGemini(response);
  const parsed = tryParseJson<GeneratedCopy>(text);
  if (parsed?.headline && parsed?.subText && parsed?.cta) {
    return parsed;
  }

  return {
    headline: "핵심 효능을 한눈에",
    subText: "검증된 포인트를 기반으로 전환 중심 메시지를 완성하세요.",
    cta: "지금 확인하기",
  };
}

export async function generateImageWithGemini(input: {
  prompt: string;
  referenceImageFile?: File;
  referenceImageUrl?: string;
  productImageFile?: File;
}) {
  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];

  if (input.referenceImageFile || input.referenceImageUrl) {
    const referenceInlineData = await toInlineData({
      file: input.referenceImageFile,
      url: input.referenceImageUrl,
    });
    parts.push({ text: "Reference image for style guidance." });
    parts.push({ inlineData: referenceInlineData });
  }

  if (input.productImageFile) {
    const productInlineData = await toInlineData({ file: input.productImageFile });
    parts.push({ text: "Product image that must be the main subject." });
    parts.push({ inlineData: productInlineData });
  }

  let lastError: Error | null = null;

  for (const model of IMAGE_MODEL_CANDIDATES) {
    try {
      const response = await callGeminiModel(model, {
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const inlineImage = extractInlineDataFromGemini(response);
      if (!inlineImage) {
        throw new Error(
          `Model ${model} returned no image payload in candidates/parts.`,
        );
      }

      return {
        mimeType: inlineImage.mimeType,
        base64: inlineImage.data,
        dataUrl: `data:${inlineImage.mimeType};base64,${inlineImage.data}`,
        model,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("All configured image generation models failed.");
}

export async function generateImageWithGeminiAdvanced(input: {
  model: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  responseModalities?: Array<"TEXT" | "IMAGE">;
  referenceInlineData?: InlineData;
  referenceInlineDataList?: InlineData[];
  typographyInlineData?: InlineData;
  productInlineData?: InlineData;
  logoInlineData?: InlineData;
  personInlineData?: InlineData;
  guideOverlayInlineData?: InlineData;
}) {
  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];

  if (input.referenceInlineData) {
    parts.push({ text: "Reference image for style guidance only." });
    parts.push({ inlineData: input.referenceInlineData });
  }
  if (Array.isArray(input.referenceInlineDataList) && input.referenceInlineDataList.length > 0) {
    input.referenceInlineDataList.forEach((inline, idx) => {
      parts.push({ text: `Additional reference image #${idx + 2} for style consistency.` });
      parts.push({ inlineData: inline });
    });
  }

  if (input.typographyInlineData) {
    parts.push({
      text: "Typography crop reference. Match letter material, emboss depth, stroke, and hierarchy from this crop.",
    });
    parts.push({ inlineData: input.typographyInlineData });
  }

  if (input.productInlineData) {
    parts.push({ text: "Product image that must be the main subject." });
    parts.push({ inlineData: input.productInlineData });
  }

  if (input.logoInlineData) {
    parts.push({
      text: "Brand logo reference. Preserve the logo identity and place it naturally in the composition.",
    });
    parts.push({ inlineData: input.logoInlineData });
  }

  if (input.personInlineData) {
    parts.push({
      text: "Person/talent reference. Keep facial identity and overall vibe naturally.",
    });
    parts.push({ inlineData: input.personInlineData });
  }

  if (input.guideOverlayInlineData) {
    parts.push({
      text: "Layout guide overlay. Reserve these colored boxes as blank areas. Do NOT render the overlay.",
    });
    parts.push({ inlineData: input.guideOverlayInlineData });
  }

  const response = await callGeminiModel(input.model, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.35,
      responseModalities: input.responseModalities ?? ["IMAGE"],
      imageConfig: {
        ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
        ...(input.imageSize ? { imageSize: input.imageSize } : {}),
      },
    },
  });

  const inlineImage = extractInlineDataFromGemini(response);
  if (!inlineImage) {
    throw new Error(
      `Model ${input.model} returned no image payload in candidates/parts.`,
    );
  }

  return {
    mimeType: inlineImage.mimeType,
    base64: inlineImage.data,
    dataUrl: `data:${inlineImage.mimeType};base64,${inlineImage.data}`,
    model: input.model,
  };
}
