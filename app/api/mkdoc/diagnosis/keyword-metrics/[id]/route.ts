import { NextResponse } from "next/server";

import { requireUserFromAuthHeader } from "@/lib/mkdoc/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const user = await requireUserFromAuthHeader(request);
    const id = String(context.params.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    const { data: ownerRow } = await supabase
      .from("diagnosis_requests")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ownerRow?.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("keyword_metrics")
      .select("keyword, pc_volume, m_volume, pc_ctr, m_ctr, comp_idx, est_bid_p1, est_bid_p2, est_bid_p3, est_bid_p4, est_bid_p5, cluster, intent, priority")
      .eq("request_id", id)
      .order("priority", { ascending: false })
      .limit(200);
    if (error) throw error;

    return NextResponse.json(
      { ok: true, status: ownerRow.status, rows: Array.isArray(data) ? data : [] },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Keyword metrics load failed.";
    const status = msg.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

