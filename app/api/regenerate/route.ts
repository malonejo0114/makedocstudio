import { NextRequest, NextResponse } from "next/server";

import { generateImageWithGemini } from "@/lib/gemini";
import { getSupabaseServerClient } from "@/lib/supabase";

type RegenerateBody = {
  sourceGenerationId?: string;
  usedReferenceId?: string | null;
  scenario?: string;
  scenarioDesc?: string;
  outputMode?: "image_with_text" | "image_only";
  textMode?: "auto" | "custom";
  width?: number;
  height?: number;
  visualGuide?: string;
  headline?: string;
  subText?: string;
  cta?: string;
  finalPrompt?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegenerateBody;
    const prompt = typeof body.finalPrompt === "string" ? body.finalPrompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "finalPrompt is required." },
        { status: 400 },
      );
    }

    const generated = await generateImageWithGemini({ prompt });

    const scenarioBase = body.scenario || "REGENERATE";
    const scenario = `${scenarioBase}_REGEN`;

    try {
      const supabase = getSupabaseServerClient();
      const fullPayload = {
        used_reference_id: body.usedReferenceId ?? null,
        scenario,
        scenario_desc: body.scenarioDesc || "Regenerated from history",
        output_mode: body.outputMode || "image_with_text",
        text_mode: body.textMode || "auto",
        width: Number.isFinite(body.width) ? body.width : 1080,
        height: Number.isFinite(body.height) ? body.height : 1080,
        visual_guide: body.visualGuide || "",
        headline: body.headline || "",
        sub_text: body.subText || "",
        cta: body.cta || "",
        final_prompt: prompt,
        model: generated.model,
        generated_image: generated.dataUrl,
        source_generation_id: body.sourceGenerationId || null,
      };
      const { error } = await supabase.from("generations").insert(fullPayload);

      if (error) {
        const fallbackPayload = {
          used_reference_id: body.usedReferenceId ?? null,
          scenario,
          text_mode: body.textMode || "auto",
          headline: body.headline || "",
          sub_text: body.subText || "",
          cta: body.cta || "",
        };
        const { error: fallbackError } = await supabase
          .from("generations")
          .insert(fallbackPayload);

        if (fallbackError) {
          console.warn(
            "[/api/regenerate] insert skipped:",
            `${error.message} | fallback: ${fallbackError.message}`,
          );
        }
      }
    } catch (error) {
      console.warn("[/api/regenerate] insert failed:", error);
    }

    return NextResponse.json(
      {
        scenario,
        model: generated.model,
        generatedImage: generated.dataUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/regenerate] failed:", error);
    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    const message = rawMessage.includes("GEMINI_API_KEY")
      ? "Gemini API 키가 설정되지 않았습니다. .env.local을 확인하세요."
      : rawMessage.includes("429")
        ? "요청이 많아 일시적으로 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
        : rawMessage.includes("503") || rawMessage.includes("500")
          ? "이미지 생성 서버가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요."
          : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
