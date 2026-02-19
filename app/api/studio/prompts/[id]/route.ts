import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

const PromptPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  copy: z
    .object({
      headline: z.string().optional(),
      subhead: z.string().optional(),
      cta: z.string().optional(),
      badges: z.array(z.string()).optional(),
    })
    .optional(),
  visual: z
    .object({
      scene: z.string().optional(),
      composition: z.string().optional(),
      style: z.string().optional(),
      lighting: z.string().optional(),
      colorPaletteHint: z.string().optional(),
      negative: z.string().optional(),
    })
    .optional(),
  generationHints: z
    .object({
      aspectRatioDefault: z.enum(["1:1", "4:5", "9:16"]).optional(),
      textModeDefault: z.enum(["in_image", "minimal_text", "no_text"]).optional(),
      copyToggles: z
        .object({
          useSubcopy: z.boolean().optional(),
          useCTA: z.boolean().optional(),
          useBadge: z.boolean().optional(),
        })
        .optional(),
      textStyle: z
        .object({
          headline: z
            .object({
              fontTone: z.enum(["auto", "gothic", "myeongjo", "rounded", "calligraphy"]).optional(),
              effectTone: z.enum(["auto", "clean", "shadow", "outline", "emboss", "bubble"]).optional(),
            })
            .optional(),
          subhead: z
            .object({
              fontTone: z.enum(["auto", "gothic", "myeongjo", "rounded", "calligraphy"]).optional(),
              effectTone: z.enum(["auto", "clean", "shadow", "outline", "emboss", "bubble"]).optional(),
            })
            .optional(),
          cta: z
            .object({
              fontTone: z.enum(["auto", "gothic", "myeongjo", "rounded", "calligraphy"]).optional(),
              effectTone: z.enum(["auto", "clean", "shadow", "outline", "emboss", "bubble"]).optional(),
            })
            .optional(),
          badge: z
            .object({
              fontTone: z.enum(["auto", "gothic", "myeongjo", "rounded", "calligraphy"]).optional(),
              effectTone: z.enum(["auto", "clean", "shadow", "outline", "emboss", "bubble"]).optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const promptId = context.params.id;

    const payload = await request.json().catch(() => null);
    const parsed = PromptPatchSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "프롬프트 수정 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServiceClient();

    const promptLoad = await supabase
      .from("studio_prompts")
      .select("id, project_id, title, copy_json, visual_json, generation_hints")
      .eq("id", promptId)
      .single();

    if (promptLoad.error || !promptLoad.data) {
      return NextResponse.json({ error: "프롬프트를 찾을 수 없습니다." }, { status: 404 });
    }

    const ownerCheck = await supabase
      .from("studio_projects")
      .select("id")
      .eq("id", promptLoad.data.project_id)
      .eq("user_id", user.id)
      .single();

    if (ownerCheck.error || !ownerCheck.data) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const nextTitle = parsed.data.title ?? promptLoad.data.title;
    const nextCopy = {
      ...(promptLoad.data.copy_json as Record<string, unknown>),
      ...(parsed.data.copy ?? {}),
    };
    const nextVisual = {
      ...(promptLoad.data.visual_json as Record<string, unknown>),
      ...(parsed.data.visual ?? {}),
    };
    const nextHints = {
      ...(promptLoad.data.generation_hints as Record<string, unknown>),
      ...(parsed.data.generationHints ?? {}),
    };

    const updated = await supabase
      .from("studio_prompts")
      .update({
        title: nextTitle,
        copy_json: nextCopy,
        visual_json: nextVisual,
        generation_hints: nextHints,
      })
      .eq("id", promptId)
      .select("id, role, title, copy_json, visual_json, generation_hints, created_at, updated_at")
      .single();

    if (updated.error || !updated.data) {
      return NextResponse.json(
        { error: `프롬프트 저장에 실패했습니다. (${updated.error?.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        prompt: {
          id: updated.data.id,
          role: updated.data.role,
          title: updated.data.title,
          copy: updated.data.copy_json,
          visual: updated.data.visual_json,
          generationHints: updated.data.generation_hints,
          createdAt: updated.data.created_at,
          updatedAt: updated.data.updated_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "프롬프트 저장 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
