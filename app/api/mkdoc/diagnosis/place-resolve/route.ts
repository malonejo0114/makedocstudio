import { NextResponse } from "next/server";

import { z } from "zod";

import { consumeRateLimit } from "@/lib/rateLimit";
import { searchNaverLocal } from "@/lib/naver/local";

const RequestSchema = z.object({
  query: z.string().trim().min(2),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = consumeRateLimit(`mkdoc:place-resolve:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limited. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload.", detail: parsed.error.flatten() }, { status: 400 });
  }

  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET is not configured." },
      { status: 501 },
    );
  }

  try {
    const res = await searchNaverLocal(parsed.data.query, { display: 5, sort: "comment" });
    return NextResponse.json({ ok: true, ...res }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Place resolve failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

