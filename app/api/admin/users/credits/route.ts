import { NextResponse } from "next/server";
import { z } from "zod";

import { SIGNUP_INITIAL_CREDITS, UNIFIED_CREDIT_BUCKET_ID } from "@/lib/studio/pricing";
import { getSupabaseServiceClient } from "@/lib/supabase";

const AdjustCreditSchema = z.object({
  userId: z.string().uuid(),
  delta: z.number().int().refine((value) => value !== 0, "delta must not be 0"),
  note: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = AdjustCreditSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "크레딧 조정 요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { userId, delta, note } = parsed.data;
    const supabase = getSupabaseServiceClient();

    const ensureRow = await supabase.from("user_model_credits").upsert(
      {
        user_id: userId,
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
        { error: `크레딧 행 초기화 실패 (${ensureRow.error.message})` },
        { status: 500 },
      );
    }

    const current = await supabase
      .from("user_model_credits")
      .select("balance")
      .eq("user_id", userId)
      .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
      .single();

    if (current.error || !current.data) {
      return NextResponse.json(
        { error: `현재 크레딧 조회 실패 (${current.error?.message ?? "unknown"})` },
        { status: 500 },
      );
    }

    const currentBalance = Number(current.data.balance ?? 0);
    const nextBalance = Math.max(0, currentBalance + delta);
    const appliedDelta = nextBalance - currentBalance;

    const updated = await supabase
      .from("user_model_credits")
      .update({ balance: nextBalance })
      .eq("user_id", userId)
      .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
      .select("balance")
      .single();

    if (updated.error || !updated.data) {
      return NextResponse.json(
        { error: `크레딧 잔액 업데이트 실패 (${updated.error?.message ?? "unknown"})` },
        { status: 500 },
      );
    }

    const ledgerInsert = await supabase
      .from("credit_ledger")
      .insert({
        user_id: userId,
        image_model_id: UNIFIED_CREDIT_BUCKET_ID,
        delta: appliedDelta,
        reason: "ADMIN",
        ref_id: null,
        meta_json: {
          source: "admin-console",
          note: note || null,
          requested_delta: delta,
        },
      })
      .select("id")
      .single();

    if (ledgerInsert.error) {
      return NextResponse.json(
        { error: `크레딧 원장 기록 실패 (${ledgerInsert.error.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        userId,
        delta: appliedDelta,
        requestedDelta: delta,
        balance: Number(updated.data.balance ?? 0),
        ledgerId: ledgerInsert.data?.id ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "관리자 크레딧 조정 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
