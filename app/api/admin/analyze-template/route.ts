import { NextRequest, NextResponse } from "next/server";

import { analyzeTemplateStyleWithGemini } from "@/lib/gemini";

function readFile(formData: FormData, key: string): File | undefined {
  const value = formData.get(key);
  if (!(value instanceof File)) {
    return undefined;
  }
  return value.size > 0 ? value : undefined;
}

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "multipart/form-data 형식으로 요청해 주세요." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const image = readFile(formData, "image") ?? readFile(formData, "referenceImage");
    const width = parseNumber(formData.get("width"), 1080);
    const height = parseNumber(formData.get("height"), 1080);

    if (!image) {
      return NextResponse.json({ error: "image 파일이 필요합니다." }, { status: 400 });
    }

    const style = await analyzeTemplateStyleWithGemini({
      referenceImageFile: image,
      width,
      height,
    });

    return NextResponse.json({ ok: true, style }, { status: 200 });
  } catch (error) {
    console.error("[/api/admin/analyze-template] failed:", error);
    const message = error instanceof Error ? error.message : "분석 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

