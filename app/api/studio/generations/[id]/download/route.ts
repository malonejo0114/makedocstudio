import { NextResponse } from "next/server";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const generationId = context.params.id;

    const supabase = getSupabaseServiceClient();
    const row = await supabase
      .from("studio_generations")
      .select("id, image_url, created_at")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();

    if (row.error || !row.data) {
      return NextResponse.json({ error: "다운로드할 이미지를 찾을 수 없습니다." }, { status: 404 });
    }

    const imageResponse = await fetch(row.data.image_url);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "이미지 파일을 가져오지 못했습니다." },
        { status: 500 },
      );
    }

    const contentType = imageResponse.headers.get("content-type") || "image/png";
    const bytes = await imageResponse.arrayBuffer();
    const ext = contentType.includes("jpeg") ? "jpg" : "png";
    const filename = `makedoc-studio-${generationId}.${ext}`;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "다운로드 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
