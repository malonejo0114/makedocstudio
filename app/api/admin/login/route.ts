import { NextResponse } from "next/server";

import {
  buildAdminSessionToken,
  getAdminCookieName,
  getAdminSessionTtlSec,
  isAdminAuthConfigured,
  verifyAdminPassword,
} from "@/lib/adminSession";

export async function POST(request: Request) {
  try {
    if (!isAdminAuthConfigured()) {
      return NextResponse.json(
        { error: "ADMIN_PASSWORD is not configured." },
        { status: 500 },
      );
    }

    const payload = await request.json();
    const password = typeof payload?.password === "string" ? payload.password : "";
    const valid = await verifyAdminPassword(password);
    if (!valid) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const token = await buildAdminSessionToken();
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set({
      name: getAdminCookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getAdminSessionTtlSec(),
    });

    return response;
  } catch (error) {
    console.error("[/api/admin/login] failed:", error);
    return NextResponse.json({ error: "로그인 처리 실패" }, { status: 500 });
  }
}

