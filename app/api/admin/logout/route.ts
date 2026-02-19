import { NextResponse } from "next/server";

import { getAdminCookieName } from "@/lib/adminSession";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: getAdminCookieName(),
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}

