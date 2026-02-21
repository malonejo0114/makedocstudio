import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { generateCardNewsPlan } from "@/lib/studio/gemini.server";

const CardNewsPlanBodySchema = z.object({
  topic: z.string().min(1).max(180),
  targetAudience: z.string().max(180).optional(),
  objective: z.string().max(180).optional(),
  tone: z.string().max(80).optional(),
  slideCount: z.number().int().min(3).max(8),
  aspectRatio: z.enum(["1:1", "4:5", "9:16"]).default("4:5"),
  productName: z.string().max(120).optional(),
  referenceImageUrl: z.string().optional(),
  referenceImageUrls: z.array(z.string()).max(5).optional(),
  productImageUrl: z.string().optional(),
  additionalNotes: z.string().max(2000).optional(),
  analysisModel: z.enum(["gemini-2.5-flash", "gemini-2.5-pro"]).optional(),
});

export async function POST(request: Request) {
  try {
    await requireStudioUserFromAuthHeader(request);
    const payload = await request.json().catch(() => null);
    const parsed = CardNewsPlanBodySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await generateCardNewsPlan({
      ...parsed.data,
      referenceImageUrl: parsed.data.referenceImageUrl?.trim() || undefined,
      referenceImageUrls:
        parsed.data.referenceImageUrls
          ?.map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 5) ?? undefined,
      productImageUrl: parsed.data.productImageUrl?.trim() || undefined,
      targetAudience: parsed.data.targetAudience?.trim() || undefined,
      objective: parsed.data.objective?.trim() || undefined,
      tone: parsed.data.tone?.trim() || undefined,
      productName: parsed.data.productName?.trim() || undefined,
      additionalNotes: parsed.data.additionalNotes?.trim() || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드뉴스 기획 생성 실패";
    const status = message.includes("로그인") || message.includes("세션") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
