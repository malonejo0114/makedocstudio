import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUserFromAuthHeader } from "@/lib/mkdoc/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

const RequestSchema = z.object({
  requestId: z.string().uuid(),
  paymentKey: z.string().min(10),
  orderId: z.string().min(6),
  amount: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUserFromAuthHeader(request);
    const body = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", detail: parsed.error.flatten() }, { status: 400 });
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "TOSS_SECRET_KEY is not configured." }, { status: 501 });
    }

    // 1) Ensure request ownership
    const supabase = getSupabaseServiceClient();
    const { data: dr } = await supabase
      .from("diagnosis_requests")
      .select("id, user_id, status")
      .eq("id", parsed.data.requestId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!dr?.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // 2) Confirm payment with Toss (server-to-server)
    const auth = Buffer.from(`${secretKey}:`).toString("base64");
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey: parsed.data.paymentKey,
        orderId: parsed.data.orderId,
        amount: parsed.data.amount,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Toss confirm failed.", detail: json ?? null },
        { status: 400 },
      );
    }

    // 3) Mark request as paid
    await supabase
      .from("diagnosis_requests")
      .update({ status: "paid" })
      .eq("id", parsed.data.requestId)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, toss: json }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Confirm failed.";
    const status = msg.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

