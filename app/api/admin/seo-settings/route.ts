import { NextResponse } from "next/server";

import {
  DEFAULT_SEO_SETTINGS,
  getRuntimeSeoSettings,
  parseSeoSettingsInput,
  toSeoSettingsRow,
} from "@/lib/seo/settings";
import { getSupabaseServiceClient } from "@/lib/supabase";

function isMissingSeoSettingsTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || message.includes("seo_settings");
}

export async function GET() {
  try {
    const settings = await getRuntimeSeoSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO 설정 조회 실패";
    return NextResponse.json(
      {
        settings: DEFAULT_SEO_SETTINGS,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const settings = parseSeoSettingsInput(payload);
    const row = toSeoSettingsRow(settings);
    const supabase = getSupabaseServiceClient();

    const upsert = await supabase.from("seo_settings").upsert(row, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (upsert.error) {
      if (isMissingSeoSettingsTable(upsert.error)) {
        return NextResponse.json(
          {
            error:
              "seo_settings 테이블이 없습니다. Supabase SQL Editor에서 20260222_000015_runtime_hotfixes.sql 을 먼저 실행해 주세요.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: `SEO 설정 저장 실패 (${upsert.error.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, settings }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO 설정 저장 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
