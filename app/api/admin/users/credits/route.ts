import { NextResponse } from "next/server";
import { z } from "zod";

import { UNIFIED_CREDIT_BUCKET_ID } from "@/lib/studio/pricing";
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

    const creditRes = await supabase.rpc("studio_add_credit", {
      p_user_id: userId,
      p_image_model_id: UNIFIED_CREDIT_BUCKET_ID,
      p_delta: delta,
      p_reason: "ADMIN",
      p_ref_id: null,
    });

    if (creditRes.error || !Array.isArray(creditRes.data) || !creditRes.data[0]) {
      return NextResponse.json(
        { error: `크레딧 조정 실패 (${creditRes.error?.message ?? "unknown"})` },
        { status: 500 },
      );
    }

    const row = creditRes.data[0] as { balance?: number; ledger_id?: string };
    const balance = Number(row.balance ?? 0);
    const ledgerId = row.ledger_id ?? null;

    if (ledgerId && note) {
      await supabase
        .from("credit_ledger")
        .update({
          meta_json: {
            note,
            source: "admin-console",
          },
        })
        .eq("id", ledgerId);
    }

    return NextResponse.json(
      {
        ok: true,
        userId,
        delta,
        balance,
        ledgerId,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "관리자 크레딧 조정 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

