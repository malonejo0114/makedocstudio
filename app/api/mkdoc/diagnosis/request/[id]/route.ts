import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUserFromAuthHeader } from "@/lib/mkdoc/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

const PatchSchema = z.object({
  status: z.enum(["preview", "paid", "report_ready"]).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  uploads: z.any().optional(),
  placeResolved: z.any().optional(),
});

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const request = _request;
    const user = await requireUserFromAuthHeader(request);
    const id = String(context.params.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("diagnosis_requests")
      .select("id, user_id, status, place_raw_input, place_resolved_json, answers_json, uploads_json, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, request: data }, { status: 200 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Request load failed.";
    const msg =
      raw.includes("diagnosis_requests") && raw.toLowerCase().includes("schema cache")
        ? "Supabase DB에 `diagnosis_requests` 테이블이 없습니다. Supabase SQL Editor에서 `supabase/one_click_setup_mkdoc.sql` (또는 `supabase/migrations/20260214_000007_makedoc_diagnosis_requests.sql`) 를 실행한 뒤 30초~1분 기다리고 새로고침 후 다시 시도해 주세요."
        : raw;
    const status = msg.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const user = await requireUserFromAuthHeader(request);
    const id = String(context.params.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", detail: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // Load current for merge updates
    const { data: current, error: loadError } = await supabase
      .from("diagnosis_requests")
      .select("id, answers_json, uploads_json, place_resolved_json")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError || !current) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const nextAnswers =
      parsed.data.answers ? { ...(current.answers_json as any), ...(parsed.data.answers as any) } : current.answers_json;
    const nextUploads =
      parsed.data.uploads ? { ...(current.uploads_json as any), ...(parsed.data.uploads as any) } : current.uploads_json;
    const nextPlace =
      parsed.data.placeResolved ? { ...(current.place_resolved_json as any), ...(parsed.data.placeResolved as any) } : current.place_resolved_json;

    const update: any = {
      answers_json: nextAnswers,
      uploads_json: nextUploads,
      place_resolved_json: nextPlace,
    };
    if (parsed.data.status) update.status = parsed.data.status;

    const { data, error } = await supabase
      .from("diagnosis_requests")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, status, updated_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Update failed.");
    }

    return NextResponse.json({ ok: true, request: data }, { status: 200 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Request update failed.";
    const msg =
      raw.includes("diagnosis_requests") && raw.toLowerCase().includes("schema cache")
        ? "Supabase DB에 `diagnosis_requests` 테이블이 없습니다. Supabase SQL Editor에서 `supabase/one_click_setup_mkdoc.sql` (또는 `supabase/migrations/20260214_000007_makedoc_diagnosis_requests.sql`) 를 실행한 뒤 30초~1분 기다리고 새로고침 후 다시 시도해 주세요."
        : raw;
    const status = msg.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
