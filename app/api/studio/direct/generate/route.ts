import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { generateImageWithGeminiAdvanced } from "@/lib/gemini";
import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import {
  buildReferenceLockedImagePrompt,
  estimateTextFidelityScore,
} from "@/lib/studio/gemini.server";
import { buildStudioDirectImagePrompt } from "@/lib/studio/promptBuilders.server";
import {
  CREDIT_WON_UNIT,
  getModelPriceById,
  UNIFIED_CREDIT_BUCKET_ID,
} from "@/lib/studio/pricing";
import { getSupabaseServiceClient } from "@/lib/supabase";

const ExtraTextSchema = z.object({
  label: z.string().max(50).optional(),
  value: z.string().min(1).max(120),
});
const TextStyleSlotSchema = z.object({
  fontTone: z.enum(["auto", "gothic", "myeongjo", "rounded", "calligraphy"]).optional(),
  effectTone: z.enum(["auto", "clean", "shadow", "outline", "emboss", "bubble"]).optional(),
});

const DirectGenerateBodySchema = z.object({
  referenceImageUrl: z.string().optional(),
  referenceImageUrls: z.array(z.string()).max(5).optional(),
  productImageUrl: z.string().optional(),
  productName: z.string().optional(),
  imageModelId: z.string().min(1),
  aspectRatio: z.enum(["1:1", "4:5", "9:16"]),
  textMode: z.enum(["in_image", "minimal_text", "no_text"]),
  visual: z.string().min(1),
  headline: z.string().min(1),
  subhead: z.string().default(""),
  cta: z.string().default(""),
  negative: z.string().default(""),
  promptTitle: z.string().max(80).optional(),
  extraTexts: z.array(ExtraTextSchema).default([]),
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

function resolveRuntimeModelCandidates(selectedModelId: string): string[] {
  const fastFallback =
    process.env.STUDIO_RUNTIME_FAST_IMAGE_MODEL || "gemini-2.0-flash-exp-image-generation";
  const qualityFallback =
    process.env.STUDIO_RUNTIME_QUALITY_IMAGE_MODEL || "gemini-3-pro-image-preview";

  const primary = selectedModelId.startsWith("imagen-4.0-fast")
    ? fastFallback
    : selectedModelId.startsWith("imagen-4.0")
      ? qualityFallback
      : selectedModelId;

  const dedup = new Set<string>([
    primary,
    ...IMAGE_RUNTIME_FALLBACKS,
    "gemini-3-pro-image-preview",
    "gemini-2.0-flash-exp-image-generation",
  ]);
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

async function toInlineDataFromUrlSafe(
  imageUrl: string | null,
  label: string,
): Promise<InlineData | null> {
  if (!imageUrl) return null;
  try {
    return await toInlineDataFromUrl(imageUrl, label);
  } catch {
    return null;
  }
}

function buildProjectTitle(input: {
  productName?: string;
  headline: string;
  promptTitle?: string;
}) {
  const titleFromPrompt = input.promptTitle?.trim();
  if (titleFromPrompt) return titleFromPrompt;

  const name = input.productName?.trim();
  if (name) return `${name} 직접 생성 프로젝트`;

  return `${input.headline.slice(0, 24)}${input.headline.length > 24 ? "..." : ""} 직접 생성`;
}

export async function POST(request: Request) {
  let shouldRefund = false;
  let refundCreditDelta = 0;
  let userId = "";

  try {
    const user = await requireStudioUserFromAuthHeader(request);
    userId = user.id;

    const payload = await request.json().catch(() => null);
    const parsed = DirectGenerateBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const effectiveCopyToggles = {
      useSubcopy: body.copyToggles?.useSubcopy ?? true,
      useCTA: body.copyToggles?.useCTA ?? true,
      useBadge: body.copyToggles?.useBadge ?? true,
    };
    const effectiveTextStyle = {
      headline: {
        fontTone: body.textStyle?.headline?.fontTone ?? "auto",
        effectTone: body.textStyle?.headline?.effectTone ?? "auto",
      },
      subhead: {
        fontTone: body.textStyle?.subhead?.fontTone ?? "auto",
        effectTone: body.textStyle?.subhead?.effectTone ?? "auto",
      },
      cta: {
        fontTone: body.textStyle?.cta?.fontTone ?? "auto",
        effectTone: body.textStyle?.cta?.effectTone ?? "auto",
      },
      badge: {
        fontTone: body.textStyle?.badge?.fontTone ?? "auto",
        effectTone: body.textStyle?.badge?.effectTone ?? "auto",
      },
    } as const;
    if (effectiveCopyToggles.useCTA && !body.cta.trim()) {
      return NextResponse.json(
        { error: "CTA 토글이 켜져 있을 때는 CTA 문구를 입력해 주세요." },
        { status: 400 },
      );
    }
    const normalizedReferenceImageUrls = Array.from(
      new Set(
        (body.referenceImageUrls ?? [])
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).slice(0, 5);
    const singleReferenceImageUrl = body.referenceImageUrl?.trim() || "";
    if (singleReferenceImageUrl && !normalizedReferenceImageUrls.includes(singleReferenceImageUrl)) {
      normalizedReferenceImageUrls.unshift(singleReferenceImageUrl);
    }
    const referenceImageUrl = normalizedReferenceImageUrls[0] || "";
    const productImageUrl = body.productImageUrl?.trim() || "";
    const projectReferenceUrl = referenceImageUrl || productImageUrl || "about:blank";

    const priced = getModelPriceById(body.imageModelId, "1K");
    if (!priced) {
      return NextResponse.json({ error: "지원하지 않는 생성 모델입니다." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
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
        ref_id: null,
        meta_json: {
          status: "insufficient",
          source: "direct-generate",
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

    const balanceAfter = Number(updated.data.balance);

    const ledgerInsert = await supabase.from("credit_ledger").insert({
      user_id: user.id,
      image_model_id: UNIFIED_CREDIT_BUCKET_ID,
      delta: -creditsToConsume,
      reason: "GENERATE",
      ref_id: null,
      meta_json: {
        source: "direct-generate",
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

    shouldRefund = true;
    refundCreditDelta = creditsToConsume;

    const normalizedExtraTexts = body.extraTexts.map((item) => ({
      label: item.label?.trim() || "",
      value: item.value.trim(),
    }));

    const productContext = {
      mode: "DIRECT",
      productName: body.productName?.trim() || "",
      referenceImageUrl: referenceImageUrl || undefined,
      referenceImageUrls: normalizedReferenceImageUrls,
      productImageUrl: productImageUrl || undefined,
      extraTexts: normalizedExtraTexts,
    };

    const projectInsert = await supabase
      .from("studio_projects")
      .insert({
        user_id: user.id,
        title: buildProjectTitle({
          productName: body.productName,
          headline: body.headline,
          promptTitle: body.promptTitle,
        }),
        reference_image_url: projectReferenceUrl,
        product_context: productContext,
      })
      .select("id, created_at")
      .single();

    if (projectInsert.error || !projectInsert.data) {
      throw new Error(`프로젝트 저장에 실패했습니다. (${projectInsert.error?.message ?? "unknown"})`);
    }

    const promptInsert = await supabase
      .from("studio_prompts")
      .insert({
        project_id: projectInsert.data.id,
        role: "DESIGNER",
        title: body.promptTitle?.trim() || "직접 입력 프롬프트",
        copy_json: {
          headline: body.headline,
          subhead: body.subhead,
          cta: body.cta,
          badges: normalizedExtraTexts.map((item) => item.value),
          additionalTexts: normalizedExtraTexts,
        },
        visual_json: {
          scene: body.visual,
          composition: "",
          style: "",
          lighting: "",
          colorPaletteHint: "",
          negative: body.negative,
        },
        generation_hints: {
          aspectRatioDefault: body.aspectRatio,
          textModeDefault: body.textMode,
          copyToggles: effectiveCopyToggles,
          textStyle: effectiveTextStyle,
        },
      })
      .select("id")
      .single();

    if (promptInsert.error || !promptInsert.data) {
      throw new Error(`프롬프트 저장에 실패했습니다. (${promptInsert.error?.message ?? "unknown"})`);
    }

    const finalPrompt = await buildStudioDirectImagePrompt({
      visual: body.visual,
      headline: body.headline,
      subhead: body.subhead,
      cta: body.cta,
      extraTexts: normalizedExtraTexts,
      negative: body.negative,
      productContext,
      aspectRatio: body.aspectRatio,
      textMode: body.textMode,
      copyToggles: effectiveCopyToggles,
      textStyle: effectiveTextStyle,
    });
    const styleLockedPrompt = await buildReferenceLockedImagePrompt({
      referenceImageUrl,
      basePrompt: finalPrompt,
      headline: body.headline,
      subhead: body.subhead,
      cta: body.cta,
    });

    const [referenceInlineData, productInlineData, additionalReferenceInlineDataRaw] = await Promise.all([
      toInlineDataFromUrlSafe(referenceImageUrl || null, "레퍼런스 이미지"),
      toInlineDataFromUrlSafe(productImageUrl || null, "제품 이미지"),
      Promise.all(
        normalizedReferenceImageUrls.slice(1, 5).map((refUrl, index) =>
          toInlineDataFromUrlSafe(refUrl, `추가 레퍼런스 이미지 ${index + 2}`),
        ),
      ),
    ]);
    const additionalReferenceInlineData = additionalReferenceInlineDataRaw.filter(
      (item): item is InlineData => Boolean(item),
    );

    const runtimeCandidates = resolveRuntimeModelCandidates(body.imageModelId);
    let generated: Awaited<ReturnType<typeof generateImageWithGeminiAdvanced>> | null = null;
    let lastModelError: Error | null = null;

    for (const runtimeModel of runtimeCandidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        generated = await generateImageWithGeminiAdvanced({
          model: runtimeModel,
          prompt: styleLockedPrompt,
          aspectRatio: body.aspectRatio,
          responseModalities: ["IMAGE"],
          ...(referenceInlineData ? { referenceInlineData } : {}),
          ...(additionalReferenceInlineData.length > 0
            ? { referenceInlineDataList: additionalReferenceInlineData }
            : {}),
          ...(productInlineData ? { productInlineData } : {}),
        });
        break;
      } catch (error) {
        lastModelError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (!generated) {
      throw lastModelError ?? new Error("사용 가능한 이미지 생성 모델을 찾지 못했습니다.");
    }

    const generationId = crypto.randomUUID();
    const ext = generated.mimeType.includes("jpeg") ? "jpg" : "png";
    const storagePath = `users/${user.id}/projects/${projectInsert.data.id}/${generationId}.${ext}`;

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
        : await estimateTextFidelityScore({
            imageUrl,
            intendedHeadline: body.headline,
            intendedCta: body.cta,
          });

    const generationInsert = await supabase
      .from("studio_generations")
      .insert({
        id: generationId,
        user_id: user.id,
        project_id: projectInsert.data.id,
        prompt_id: promptInsert.data.id,
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

    if (generationInsert.error || !generationInsert.data) {
      throw new Error(
        `생성 결과 저장에 실패했습니다. (${generationInsert.error?.message ?? "unknown"})`,
      );
    }

    shouldRefund = false;

    return NextResponse.json(
      {
        projectId: projectInsert.data.id,
        promptId: promptInsert.data.id,
        generation: {
          id: generationInsert.data.id,
          projectId: generationInsert.data.project_id,
          promptId: generationInsert.data.prompt_id,
          imageModelId: generationInsert.data.image_model_id,
          imageUrl: generationInsert.data.image_url,
          aspectRatio: generationInsert.data.aspect_ratio,
          costUsd: generationInsert.data.cost_usd,
          costKrw: generationInsert.data.cost_krw,
          sellKrw: generationInsert.data.sell_krw,
          textFidelityScore: generationInsert.data.text_fidelity_score,
          createdAt: generationInsert.data.created_at,
        },
        balanceAfter,
        creditsUsed: creditsToConsume,
        message: "직접 입력 기반 이미지 생성이 완료되었습니다.",
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
              source: "direct-generate-refund",
            },
          });
        }
      } catch {
        // no-op
      }
    }

    const message = error instanceof Error ? error.message : "직접 생성 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json(
      {
        error:
          status === 500
            ? `직접 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요. (${message})`
            : message,
      },
      { status },
    );
  }
}
