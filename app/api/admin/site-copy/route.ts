import { NextResponse } from "next/server";

import {
  getRuntimeSiteCopySettings,
  saveRuntimeSiteCopySettings,
} from "@/lib/siteCopy.server";

export async function GET() {
  try {
    const settings = await getRuntimeSiteCopySettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사이트 문구 설정 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const settings = await saveRuntimeSiteCopySettings(payload);
    return NextResponse.json({ ok: true, settings }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사이트 문구 설정 저장 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
