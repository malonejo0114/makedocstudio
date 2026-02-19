import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "@/lib/supabase";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const raw = payload[key];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed || null;
}

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();

    const rich = await supabase
      .from("reference_templates")
      .select(
        "id, category, image_url, description, created_at, visual_guide, headline_style, sub_text_style, cta_style",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (!rich.error) {
      return NextResponse.json({ items: rich.data ?? [], mode: "rich" }, { status: 200 });
    }

    const legacy = await supabase
      .from("reference_templates")
      .select("id, category, image_url, description, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (legacy.error) {
      return NextResponse.json(
        { error: `reference_templates 조회 실패: ${legacy.error.message}` },
        { status: 500 },
      );
    }

    const items = (legacy.data ?? []).map((row) => ({
      ...row,
      visual_guide: "",
      headline_style: "",
      sub_text_style: "",
      cta_style: "",
    }));
    return NextResponse.json({ items, mode: "legacy" }, { status: 200 });
  } catch (error) {
    console.error("[/api/admin/reference-templates] GET failed:", error);
    return NextResponse.json(
      { error: errorMessage(error, "템플릿 조회 실패") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = readString(payload, "id");
    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const category = readString(payload, "category");
    const description = readString(payload, "description");
    const visualGuide = readString(payload, "visual_guide");
    const headlineStyle = readString(payload, "headline_style");
    const subTextStyle = readString(payload, "sub_text_style");
    const ctaStyle = readString(payload, "cta_style");

    const supabase = getSupabaseServiceClient();
    const richPatch = {
      category,
      description,
      visual_guide: visualGuide,
      headline_style: headlineStyle,
      sub_text_style: subTextStyle,
      cta_style: ctaStyle,
    };

    const rich = await supabase
      .from("reference_templates")
      .update(richPatch)
      .eq("id", id)
      .select(
        "id, category, image_url, description, created_at, visual_guide, headline_style, sub_text_style, cta_style",
      )
      .single();

    if (!rich.error) {
      return NextResponse.json({ ok: true, row: rich.data, mode: "rich" }, { status: 200 });
    }

    const legacy = await supabase
      .from("reference_templates")
      .update({
        category,
        description,
      })
      .eq("id", id)
      .select("id, category, image_url, description, created_at")
      .single();

    if (legacy.error) {
      return NextResponse.json(
        {
          error: `reference_templates 업데이트 실패: ${rich.error.message} | fallback: ${legacy.error.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, row: legacy.data, mode: "legacy" }, { status: 200 });
  } catch (error) {
    console.error("[/api/admin/reference-templates] PATCH failed:", error);
    return NextResponse.json(
      { error: errorMessage(error, "템플릿 저장 실패") },
      { status: 500 },
    );
  }
}
