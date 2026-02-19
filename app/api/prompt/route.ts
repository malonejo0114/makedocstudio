import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { DEFAULT_VISUAL_GUIDE } from "@/lib/prompts";
import { AspectRatioSchema, createDefaultLayout, LayoutSchema } from "@/lib/layoutSchema";
import { buildBackgroundOnlyPrompt, buildFullCreativePrompt } from "@/lib/promptBuilders.server";

const PromptRequestSchema = z.object({
  mode: z.enum(["background_only", "full_creative"]),
  aspectRatio: AspectRatioSchema.default("1:1"),
  visualGuide: z.string().optional(),
  headline: z.string().optional(),
  subText: z.string().optional(),
  ctaText: z.string().optional(),
  badgeText: z.string().optional(),
  legalText: z.string().optional(),
  layoutJson: LayoutSchema.optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = PromptRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid prompt request.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const layout = payload.layoutJson ?? createDefaultLayout(payload.aspectRatio);
    const width = layout.canvas.width;
    const height = layout.canvas.height;
    const visualGuide = (payload.visualGuide ?? "").trim() || DEFAULT_VISUAL_GUIDE;

    const prompt =
      payload.mode === "background_only"
        ? await buildBackgroundOnlyPrompt({
            visualGuide,
            aspectRatio: payload.aspectRatio,
            width,
            height,
          })
        : await buildFullCreativePrompt({
            visualGuide,
            headline: (payload.headline ?? "").trim(),
            subText: (payload.subText ?? "").trim(),
            ctaText: (payload.ctaText ?? "").trim(),
            badgeText: (payload.badgeText ?? "").trim(),
            legalText: (payload.legalText ?? "").trim(),
            aspectRatio: payload.aspectRatio,
            width,
            height,
            layoutJson: layout,
          });

    return NextResponse.json({ prompt }, { status: 200 });
  } catch (error) {
    console.error("[/api/prompt] failed:", error);
    return NextResponse.json(
      { error: "Prompt build failed." },
      { status: 500 },
    );
  }
}
