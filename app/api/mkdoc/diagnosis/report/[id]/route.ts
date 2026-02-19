import { NextResponse } from "next/server";

import { requireUserFromAuthHeader } from "@/lib/mkdoc/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const user = await requireUserFromAuthHeader(request);
    const id = String(context.params.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("mkdoc_reports")
      .select("id, request_id, total_score, axis_scores_json, main_type, sub_tags_json, report_json, created_at")
      .eq("request_id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // Ensure ownership via join on diagnosis_requests
    const { data: ownerRow } = await supabase
      .from("diagnosis_requests")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ownerRow?.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, report: data }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report load failed.";
    const status = msg.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

