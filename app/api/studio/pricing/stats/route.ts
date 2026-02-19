import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = getSupabaseServiceClient();

    const rows = await supabase
      .from("studio_generations")
      .select("image_model_id, text_fidelity_score, created_at")
      .gte("created_at", since)
      .not("text_fidelity_score", "is", null);

    if (rows.error) {
      return NextResponse.json(
        { error: `가격 통계를 불러오지 못했습니다. (${rows.error.message})` },
        { status: 500 },
      );
    }

    const statsMap = new Map<string, { sum: number; count: number }>();

    for (const row of rows.data ?? []) {
      const score = Number(row.text_fidelity_score);
      if (!Number.isFinite(score)) continue;

      const current = statsMap.get(row.image_model_id) ?? { sum: 0, count: 0 };
      statsMap.set(row.image_model_id, {
        sum: current.sum + score,
        count: current.count + 1,
      });
    }

    const stats = Array.from(statsMap.entries()).map(([imageModelId, value]) => ({
      imageModelId,
      avgScore: Math.round((value.sum / value.count) * 10) / 10,
      count: value.count,
    }));

    return NextResponse.json({ stats, since }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "통계 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
