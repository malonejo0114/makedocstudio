import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { generateCardNewsPlan } from "@/lib/studio/gemini.server";
import {
  ANALYSIS_CREDITS_REQUIRED,
  SIGNUP_INITIAL_CREDITS,
  UNIFIED_CREDIT_BUCKET_ID,
} from "@/lib/studio/pricing";
import { getSupabaseServiceClient } from "@/lib/supabase";

const CardNewsPlanBodySchema = z.object({
  topic: z.string().min(1).max(180),
  targetAudience: z.string().max(180).optional(),
  objective: z.string().max(180).optional(),
  tone: z.string().max(80).optional(),
  slideCount: z.number().int().min(3).max(8),
  aspectRatio: z.enum(["1:1", "4:5", "9:16"]).default("4:5"),
  productName: z.string().max(120).optional(),
  referenceImageUrl: z.string().optional(),
  referenceImageUrls: z.array(z.string()).max(5).optional(),
  productImageUrl: z.string().optional(),
  additionalNotes: z.string().max(2000).optional(),
  analysisModel: z.enum(["gemini-2.5-flash", "gemini-2.5-pro"]).optional(),
});

export async function POST(request: Request) {
  let shouldRefund = false;
  let chargedUserId: string | null = null;

  try {
    const user = await requireStudioUserFromAuthHeader(request);
    chargedUserId = user.id;
    const payload = await request.json().catch(() => null);
    const parsed = CardNewsPlanBodySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServiceClient();
    const ensureRow = await supabase.from("user_model_credits").upsert(
      {
        user_id: user.id,
        image_model_id: UNIFIED_CREDIT_BUCKET_ID,
        balance: SIGNUP_INITIAL_CREDITS,
      },
      {
        onConflict: "user_id,image_model_id",
        ignoreDuplicates: true,
      },
    );

    if (ensureRow.error) {
      return NextResponse.json(
        { error: `분석 크레딧 초기화에 실패했습니다. (${ensureRow.error.message})` },
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
    if (!Number.isFinite(currentBalance) || currentBalance < ANALYSIS_CREDITS_REQUIRED) {
      await supabase.from("credit_ledger").insert({
        user_id: user.id,
        image_model_id: UNIFIED_CREDIT_BUCKET_ID,
        delta: 0,
        reason: "GENERATE",
        meta_json: {
          source: "cardnews_analysis",
          status: "insufficient_credit",
          required_credits: ANALYSIS_CREDITS_REQUIRED,
          balance: Number.isFinite(currentBalance) ? currentBalance : 0,
        },
      });

      return NextResponse.json(
        {
          error: `카드뉴스 기획 분석은 ${ANALYSIS_CREDITS_REQUIRED}크레딧이 필요합니다. 현재 잔액은 ${Number.isFinite(currentBalance) ? currentBalance : 0}크레딧입니다.`,
          balance: Number.isFinite(currentBalance) ? currentBalance : 0,
          requiredCredits: ANALYSIS_CREDITS_REQUIRED,
        },
        { status: 402 },
      );
    }

    const nextBalance = currentBalance - ANALYSIS_CREDITS_REQUIRED;
    const updated = await supabase
      .from("user_model_credits")
      .update({ balance: nextBalance })
      .eq("user_id", user.id)
      .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
      .select("balance")
      .maybeSingle();

    if (updated.error || !updated.data) {
      return NextResponse.json(
        { error: `카드뉴스 기획 분석 크레딧 차감에 실패했습니다. (${updated.error?.message})` },
        { status: 500 },
      );
    }

    const ledgerInsert = await supabase.from("credit_ledger").insert({
      user_id: user.id,
      image_model_id: UNIFIED_CREDIT_BUCKET_ID,
      delta: -ANALYSIS_CREDITS_REQUIRED,
      reason: "GENERATE",
      meta_json: {
        source: "cardnews_analysis",
        credits_used: ANALYSIS_CREDITS_REQUIRED,
        balance_after: Number(updated.data.balance),
      },
    });

    if (ledgerInsert.error) {
      throw new Error(`카드뉴스 분석 차감 원장 기록에 실패했습니다. (${ledgerInsert.error.message})`);
    }

    shouldRefund = true;

    const result = await generateCardNewsPlan({
      ...parsed.data,
      referenceImageUrl: parsed.data.referenceImageUrl?.trim() || undefined,
      referenceImageUrls:
        parsed.data.referenceImageUrls
          ?.map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 5) ?? undefined,
      productImageUrl: parsed.data.productImageUrl?.trim() || undefined,
      targetAudience: parsed.data.targetAudience?.trim() || undefined,
      objective: parsed.data.objective?.trim() || undefined,
      tone: parsed.data.tone?.trim() || undefined,
      productName: parsed.data.productName?.trim() || undefined,
      additionalNotes: parsed.data.additionalNotes?.trim() || undefined,
    });

    shouldRefund = false;

    return NextResponse.json(
      {
        ...result,
        analysisCreditUsed: ANALYSIS_CREDITS_REQUIRED,
      },
      { status: 200 },
    );
  } catch (error) {
    if (shouldRefund && chargedUserId) {
      try {
        const supabase = getSupabaseServiceClient();
        await supabase.from("user_model_credits").upsert(
          {
            user_id: chargedUserId,
            image_model_id: UNIFIED_CREDIT_BUCKET_ID,
            balance: SIGNUP_INITIAL_CREDITS,
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
            .update({ balance: currentBalance + ANALYSIS_CREDITS_REQUIRED })
            .eq("user_id", chargedUserId)
            .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID);

          await supabase.from("credit_ledger").insert({
            user_id: chargedUserId,
            image_model_id: UNIFIED_CREDIT_BUCKET_ID,
            delta: ANALYSIS_CREDITS_REQUIRED,
            reason: "REFUND",
            meta_json: {
              source: "cardnews_analysis",
              refunded_credits: ANALYSIS_CREDITS_REQUIRED,
              reason: "analysis_request_failed",
            },
          });
        }
      } catch {
        // best effort refund
      }
    }

    const message = error instanceof Error ? error.message : "카드뉴스 기획 생성 실패";
    const status = message.includes("로그인") || message.includes("세션") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
