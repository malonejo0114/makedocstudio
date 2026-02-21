import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import {
  analyzeReferenceAndBuildPrompts,
  generateConceptPromptsWithoutReference,
} from "@/lib/studio/gemini.server";
import { UNIFIED_CREDIT_BUCKET_ID } from "@/lib/studio/pricing";
import type { CopyToggles, ProductContext } from "@/lib/studio/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const AnalyzeBodySchema = z.object({
  referenceImageUrl: z.string().optional(),
  analysisModel: z.enum(["gemini-2.5-flash", "gemini-2.5-pro"]).optional(),
  productContext: z
    .object({
      brandName: z.string().optional(),
      productName: z.string().optional(),
      category: z.string().optional(),
      target: z.string().optional(),
      offer: z.string().optional(),
      platform: z.string().optional(),
      tone: z.string().optional(),
      ratio: z.enum(["1:1", "4:5", "9:16"]).optional(),
      benefits: z.array(z.string()).optional(),
      bannedWords: z.array(z.string()).optional(),
      useProductImage: z.boolean().optional(),
      useLogoImage: z.boolean().optional(),
      usePersonImage: z.boolean().optional(),
      productImageUrl: z.string().optional(),
      logoImageUrl: z.string().optional(),
      personImageUrl: z.string().optional(),
      additionalContext: z.string().optional(),
      supplementalInputs: z
        .array(
          z.object({
            label: z.string().max(180),
            value: z.string().max(4000),
          }),
        )
        .max(20)
        .optional(),
    })
    .optional(),
  copyToggles: z
    .object({
      useSubcopy: z.boolean().optional(),
      useCTA: z.boolean().optional(),
      useBadge: z.boolean().optional(),
    })
    .optional(),
  isSupplementalReanalyze: z.boolean().optional(),
});

function buildProjectTitle(productContext: ProductContext) {
  const productName = productContext.productName?.trim();
  if (productName) {
    return `${productName} 스튜디오 프로젝트`;
  }
  return `새 프로젝트 ${new Date().toISOString().slice(0, 10)}`;
}

function shouldFilterByAssetSelection(
  label: string,
  options: { useProductImage: boolean; useLogoImage: boolean; usePersonImage: boolean },
) {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return false;

  const logoRelated = /(로고|logo|brand\s*mark|브랜드\s*로고|아이덴티티)/i.test(normalized);
  const productRelated = /(제품|상품|product|누끼|패키지|성분|원물)/i.test(normalized);
  const personRelated = /(인물|모델|person|human|얼굴|착용컷|라이프스타일컷)/i.test(normalized);

  if (!options.useLogoImage && logoRelated) return true;
  if (!options.useProductImage && productRelated) return true;
  if (!options.usePersonImage && personRelated) return true;
  return false;
}

function filterMissingInputLabels(
  items: string[] | undefined,
  options: { useProductImage: boolean; useLogoImage: boolean; usePersonImage: boolean },
) {
  return (items ?? []).filter((item) => !shouldFilterByAssetSelection(item, options));
}

function filterWarningsByAssetSelection(
  warnings: string[] | undefined,
  options: { useProductImage: boolean; useLogoImage: boolean; usePersonImage: boolean },
) {
  return (warnings ?? []).filter((warning) => {
    const normalized = warning.trim().toLowerCase();
    if (!normalized) return false;
    const requirementLike =
      normalized.includes("입력 필요") ||
      normalized.includes("없습니다") ||
      normalized.includes("누락") ||
      normalized.includes("보강");
    if (!requirementLike) return true;
    return !shouldFilterByAssetSelection(warning, options);
  });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServiceClient();
  let chargedUserId: string | null = null;
  let chargedProCredit = false;

  try {
    const user = await requireStudioUserFromAuthHeader(request);
    chargedUserId = user.id;

    const payload = await request.json().catch(() => null);
    const parsed = AnalyzeBodySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const referenceImageUrl = parsed.data.referenceImageUrl?.trim() || "";
    const inputContext = parsed.data.productContext ?? {};
    const copyToggles: CopyToggles = {
      useSubcopy: parsed.data.copyToggles?.useSubcopy ?? true,
      useCTA: parsed.data.copyToggles?.useCTA ?? true,
      useBadge: parsed.data.copyToggles?.useBadge ?? true,
    };
    const resolvedAnalysisModel =
      parsed.data.analysisModel || process.env.STUDIO_ANALYSIS_MODEL || "gemini-2.5-flash";

    const rawProductImageUrl = inputContext.productImageUrl?.trim() || "";
    const rawLogoImageUrl = inputContext.logoImageUrl?.trim() || "";
    const rawPersonImageUrl = inputContext.personImageUrl?.trim() || "";
    const useProductImage = inputContext.useProductImage ?? Boolean(rawProductImageUrl);
    const useLogoImage = inputContext.useLogoImage ?? Boolean(rawLogoImageUrl);
    const usePersonImage = inputContext.usePersonImage ?? Boolean(rawPersonImageUrl);

    const productContext: ProductContext = {
      ...inputContext,
      useProductImage,
      useLogoImage,
      usePersonImage,
      productImageUrl: useProductImage ? rawProductImageUrl || undefined : undefined,
      logoImageUrl: useLogoImage ? rawLogoImageUrl || undefined : undefined,
      personImageUrl: usePersonImage ? rawPersonImageUrl || undefined : undefined,
      additionalContext: inputContext.additionalContext?.trim() || undefined,
      supplementalInputs:
        inputContext.supplementalInputs
          ?.map((item) => ({
            label: item.label.trim(),
            value: item.value.trim(),
          }))
          .filter((item) => item.label.length > 0 && item.value.length > 0) ?? undefined,
    };

    const requestedSupplementalReanalyze = parsed.data.isSupplementalReanalyze === true;
    const hasSupplementalInputs = Boolean(
      productContext.additionalContext || (productContext.supplementalInputs ?? []).length > 0,
    );
    const useFreeSupplementalReanalyze = requestedSupplementalReanalyze && hasSupplementalInputs;
    const shouldChargeProAnalysis =
      resolvedAnalysisModel === "gemini-2.5-pro" && !useFreeSupplementalReanalyze;

    let analysisCreditUsed = 0;

    if (shouldChargeProAnalysis) {
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
          { error: `크레딧 잔액 초기화에 실패했습니다. (${ensureRow.error.message})` },
          { status: 500 },
        );
      }

      const current = await supabase
        .from("user_model_credits")
        .select("balance")
        .eq("user_id", user.id)
        .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
        .maybeSingle();

      if (current.error || !current.data) {
        return NextResponse.json(
          { error: `크레딧 잔액 확인에 실패했습니다. (${current.error?.message ?? "row 없음"})` },
          { status: 500 },
        );
      }

      const currentBalance = Number(current.data.balance);
      if (!Number.isFinite(currentBalance) || currentBalance < 1) {
        await supabase.from("credit_ledger").insert({
          user_id: user.id,
          image_model_id: UNIFIED_CREDIT_BUCKET_ID,
          delta: 0,
          reason: "GENERATE",
          meta_json: {
            source: "analysis_pro",
            status: "insufficient_credit",
            required_credits: 1,
            balance: Number.isFinite(currentBalance) ? currentBalance : 0,
          },
        });

        return NextResponse.json(
          {
            error: `Pro 분석은 1크레딧이 필요합니다. 현재 잔액은 ${Number.isFinite(currentBalance) ? currentBalance : 0}크레딧입니다.`,
            balance: Number.isFinite(currentBalance) ? currentBalance : 0,
            requiredCredits: 1,
          },
          { status: 402 },
        );
      }

      const nextBalance = currentBalance - 1;
      const updated = await supabase
        .from("user_model_credits")
        .update({ balance: nextBalance })
        .eq("user_id", user.id)
        .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
        .select("balance")
        .maybeSingle();

      if (updated.error || !updated.data) {
        return NextResponse.json(
          { error: `Pro 분석 크레딧 차감에 실패했습니다. (${updated.error?.message})` },
          { status: 500 },
        );
      }

      chargedProCredit = true;
      analysisCreditUsed = 1;

      const ledgerInsert = await supabase.from("credit_ledger").insert({
        user_id: user.id,
        image_model_id: UNIFIED_CREDIT_BUCKET_ID,
        delta: -1,
        reason: "GENERATE",
        meta_json: {
          source: "analysis_pro",
          credits_used: 1,
          balance_after: Number(updated.data.balance),
        },
      });

      if (ledgerInsert.error) {
        throw new Error(`Pro 분석 차감 원장 기록에 실패했습니다. (${ledgerInsert.error.message})`);
      }
    }

    const analyzed = referenceImageUrl
      ? await analyzeReferenceAndBuildPrompts({
          referenceImageUrl,
          productContext,
          analysisModel: resolvedAnalysisModel,
          copyToggles,
        })
      : await generateConceptPromptsWithoutReference({
          productContext,
          analysisModel: resolvedAnalysisModel,
          copyToggles,
        });

    const assetSelection = {
      useProductImage: productContext.useProductImage ?? false,
      useLogoImage: productContext.useLogoImage ?? false,
      usePersonImage: productContext.usePersonImage ?? false,
    };
    const filteredMissingInputs = filterMissingInputLabels(analyzed.analysis.missingInputs, assetSelection);
    const warningsAfterAssetSelection = filterWarningsByAssetSelection(analyzed.warnings, assetSelection);
    const suppressMissingOnResult = useFreeSupplementalReanalyze;
    const analysisForSave = suppressMissingOnResult
      ? {
          ...analyzed.analysis,
          missingInputs: [],
        }
      : {
          ...analyzed.analysis,
          missingInputs: filteredMissingInputs,
        };
    const warningsForResponse = suppressMissingOnResult
      ? warningsAfterAssetSelection.filter((item) => !item.startsWith("입력 필요:"))
      : warningsAfterAssetSelection;

    const fallbackReferenceImageUrl =
      productContext.productImageUrl || productContext.personImageUrl || "about:blank";
    const projectReferenceImageUrl = referenceImageUrl || fallbackReferenceImageUrl;

    const projectInsert = await supabase
      .from("studio_projects")
      .insert({
        user_id: user.id,
        title: buildProjectTitle(productContext),
        reference_image_url: projectReferenceImageUrl,
        product_context: productContext,
      })
      .select("id, title, reference_image_url, product_context, created_at")
      .single();

    if (projectInsert.error || !projectInsert.data) {
      if (projectInsert.error?.code === "42P01") {
        return NextResponse.json(
          {
            error:
              "스튜디오 DB 마이그레이션이 아직 적용되지 않았습니다. Supabase SQL Editor에서 `supabase/migrations/20260216_000009_makedoc_studio_core.sql`을 실행해 주세요.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: `프로젝트 생성에 실패했습니다. (${projectInsert.error?.message})` },
        { status: 500 },
      );
    }

    const project = projectInsert.data;

    const analysisInsert = await supabase
      .from("studio_reference_analysis")
      .insert({
        project_id: project.id,
        analysis_json: analysisForSave,
      })
      .select("id, analysis_json, created_at")
      .single();

    if (analysisInsert.error || !analysisInsert.data) {
      return NextResponse.json(
        {
          error: `분석 결과 저장에 실패했습니다. (${analysisInsert.error?.message})`,
        },
        { status: 500 },
      );
    }

    const promptRows = analyzed.prompts.map((item) => {
      const generationHints = suppressMissingOnResult
        ? {
            ...item.generationHints,
            seniorPack: item.generationHints.seniorPack
              ? {
                  ...item.generationHints.seniorPack,
                  missingInputs: [],
                }
              : item.generationHints.seniorPack,
          }
        : {
            ...item.generationHints,
            seniorPack: item.generationHints.seniorPack
              ? {
                  ...item.generationHints.seniorPack,
                  missingInputs: filterMissingInputLabels(
                    item.generationHints.seniorPack.missingInputs,
                    assetSelection,
                  ),
                }
              : item.generationHints.seniorPack,
          };

      return {
        project_id: project.id,
        role: item.role,
        title: item.title,
        copy_json: item.copy,
        visual_json: item.visual,
        generation_hints: {
          ...generationHints,
          aspectRatioDefault: "1:1",
          copyToggles: generationHints.copyToggles ?? copyToggles,
          textStyle: generationHints.textStyle ?? {
            headline: { fontTone: "auto", effectTone: "auto" },
            subhead: { fontTone: "auto", effectTone: "auto" },
            cta: { fontTone: "auto", effectTone: "auto" },
            badge: { fontTone: "auto", effectTone: "auto" },
          },
        },
      };
    });

    const promptsInsert = await supabase
      .from("studio_prompts")
      .insert(promptRows)
      .select(
        "id, role, title, copy_json, visual_json, generation_hints, created_at, updated_at",
      )
      .order("created_at", { ascending: true });

    if (promptsInsert.error) {
      return NextResponse.json(
        { error: `프롬프트 저장에 실패했습니다. (${promptsInsert.error.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        project,
        analysis: analysisInsert.data.analysis_json,
        prompts: (promptsInsert.data ?? []).map((row) => ({
          id: row.id,
          role: row.role,
          title: row.title,
          copy: row.copy_json,
          visual: row.visual_json,
          generationHints: {
            ...((row.generation_hints ?? {}) as Record<string, unknown>),
            aspectRatioDefault:
              (row.generation_hints as { aspectRatioDefault?: "1:1" | "4:5" | "9:16" } | null)
                ?.aspectRatioDefault ?? "1:1",
          },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        warnings: warningsForResponse,
        recommendedTemplateIds: analyzed.recommendedTemplateIds,
        analysisCreditUsed,
        inputCase: referenceImageUrl
          ? productContext.productImageUrl || productContext.logoImageUrl || productContext.personImageUrl
            ? "REFERENCE_AND_PRODUCT"
            : "REFERENCE_ONLY"
          : productContext.productImageUrl || productContext.logoImageUrl || productContext.personImageUrl
            ? "PRODUCT_ONLY"
            : "NONE",
      },
      { status: 200 },
    );
  } catch (error) {
    if (chargedProCredit && chargedUserId) {
      try {
        await supabase.from("user_model_credits").upsert(
          {
            user_id: chargedUserId,
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
          .eq("user_id", chargedUserId)
          .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
          .maybeSingle();

        const currentBalance = Number(current.data?.balance ?? 0);
        if (Number.isFinite(currentBalance)) {
          await supabase
            .from("user_model_credits")
            .update({ balance: currentBalance + 1 })
            .eq("user_id", chargedUserId)
            .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID);

          await supabase.from("credit_ledger").insert({
            user_id: chargedUserId,
            image_model_id: UNIFIED_CREDIT_BUCKET_ID,
            delta: 1,
            reason: "REFUND",
            meta_json: {
              source: "analysis_pro",
              refunded_credits: 1,
              reason: "analysis_request_failed",
            },
          });
        }
      } catch {
        // best effort refund
      }
    }

    const message = error instanceof Error ? error.message : "분석 실패";
    const status = message.includes("로그인") || message.includes("세션") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
