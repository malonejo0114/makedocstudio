import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { SIGNUP_INITIAL_CREDITS, UNIFIED_CREDIT_BUCKET_ID } from "@/lib/studio/pricing";
import { getSupabaseServiceClient } from "@/lib/supabase";

const TopupSchema = z.object({
  amount: z.number().int().positive(),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "운영 환경에서는 개발용 크레딧 충전이 비활성화됩니다." },
      { status: 403 },
    );
  }

  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const payload = await request.json().catch(() => null);
    const parsed = TopupSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "충전 요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
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
        { error: `크레딧 행 초기화에 실패했습니다. (${ensureRow.error.message})` },
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
        {
          error: `현재 크레딧을 불러오지 못했습니다. (${current.error?.message ?? "unknown"})`,
        },
        { status: 500 },
      );
    }

    const nextBalance = Number(current.data.balance) + parsed.data.amount;

    const updated = await supabase
      .from("user_model_credits")
      .update({
        balance: nextBalance,
      })
      .eq("user_id", user.id)
      .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
      .select("balance")
      .single();

    if (updated.error || !updated.data) {
      return NextResponse.json(
        {
          error: `크레딧 충전에 실패했습니다. (${updated.error?.message ?? "unknown"})`,
        },
        { status: 500 },
      );
    }

    const ledgerInsert = await supabase.from("credit_ledger").insert({
      user_id: user.id,
      image_model_id: UNIFIED_CREDIT_BUCKET_ID,
      delta: parsed.data.amount,
      reason: "ADMIN",
      ref_id: null,
      meta_json: {
        source: "dev-topup",
      },
    });

    if (ledgerInsert.error) {
      return NextResponse.json(
        {
          error: `원장 기록 저장에 실패했습니다. (${ledgerInsert.error.message})`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        imageModelId: UNIFIED_CREDIT_BUCKET_ID,
        amount: parsed.data.amount,
        balance: updated.data.balance,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "크레딧 충전 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
