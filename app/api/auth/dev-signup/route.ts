import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "@/lib/supabase";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const email =
    body && typeof body === "object" && "email" in body
      ? String((body as any).email ?? "").trim()
      : "";
  const password =
    body && typeof body === "object" && "password" in body
      ? String((body as any).password ?? "")
      : "";

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      const message = error.message || "Failed to create user.";
      const isAlreadyRegistered =
        /already registered/i.test(message) ||
        /already exists/i.test(message) ||
        /duplicate/i.test(message);

      if (!isAlreadyRegistered) {
        return NextResponse.json({ error: message }, { status: 400 });
      }

      // If the user already exists, auto-confirm and reset the password
      // to make local dev onboarding smooth (dev-only endpoint).
      const { data: listData, error: listError } =
        await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
      if (listError) {
        return NextResponse.json(
          { error: listError.message || message },
          { status: 400 },
        );
      }

      const existing = listData?.users?.find(
        (user) => (user.email || "").toLowerCase() === email.toLowerCase(),
      );
      if (!existing?.id) {
        return NextResponse.json({ error: message }, { status: 400 });
      }

      const { data: updated, error: updateError } =
        await supabase.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
        });
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || message },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        user: { id: updated.user?.id ?? existing.id, email },
        mode: "updated",
      });
    }

    return NextResponse.json({
      ok: true,
      user: { id: data.user?.id ?? null, email: data.user?.email ?? email },
      mode: "created",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create user.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
