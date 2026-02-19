import { NextResponse } from "next/server";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { buildMetaOauthUrl } from "@/lib/meta/server";

export async function GET(request: Request) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const { url } = buildMetaOauthUrl(user.id);
    return NextResponse.json({ authUrl: url }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta OAuth 시작에 실패했습니다.";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
