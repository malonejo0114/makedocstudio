import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUserFromAuthHeader } from "@/lib/mkdoc/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

const RequestSchema = z.object({
  placeRawInput: z.string().trim().optional(),
  placeResolved: z.any().optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
  uploads: z.any().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUserFromAuthHeader(request);
    const body = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", detail: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("diagnosis_requests")
      .insert({
        user_id: user.id,
        status: "preview",
        place_raw_input: parsed.data.placeRawInput ?? null,
        place_resolved_json: parsed.data.placeResolved ?? {},
        answers_json: parsed.data.answers ?? {},
        uploads_json: parsed.data.uploads ?? {},
      })
      .select("id, status, created_at")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || "Failed to create diagnosis request.");
    }

    return NextResponse.json({ ok: true, request: data }, { status: 200 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Request create failed.";
    const msg =
      raw.includes("diagnosis_requests") && raw.toLowerCase().includes("schema cache")
        ? "Supabase DB에 `diagnosis_requests` 테이블이 없습니다. Supabase SQL Editor에서 `supabase/one_click_setup_mkdoc.sql` (또는 `supabase/migrations/20260214_000007_makedoc_diagnosis_requests.sql`) 를 실행한 뒤 30초~1분 기다리고 새로고침 후 다시 시도해 주세요."
        : raw;
    const status = msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("authorization") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
