import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

const ProjectPatchSchema = z.object({
  title: z.string().min(1).max(120),
});

type RouteContext = {
  params: {
    id: string;
  };
};

async function loadProjectBundle(userId: string, projectId: string) {
  const supabase = getSupabaseServiceClient();

  const project = await supabase
    .from("studio_projects")
    .select("id, user_id, title, reference_image_url, product_context, created_at")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (project.error || !project.data) {
    return { error: "프로젝트를 찾을 수 없습니다." } as const;
  }

  const [analysisRes, promptsRes, generationsRes] = await Promise.all([
    supabase
      .from("studio_reference_analysis")
      .select("id, analysis_json, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("studio_prompts")
      .select("id, role, title, copy_json, visual_json, generation_hints, created_at, updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("studio_generations")
      .select(
        "id, prompt_id, image_model_id, image_url, aspect_ratio, cost_usd, cost_krw, sell_krw, text_fidelity_score, created_at",
      )
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (analysisRes.error) {
    return { error: `분석 정보를 불러오지 못했습니다. (${analysisRes.error.message})` } as const;
  }
  if (promptsRes.error) {
    return { error: `프롬프트를 불러오지 못했습니다. (${promptsRes.error.message})` } as const;
  }
  if (generationsRes.error) {
    return { error: `생성 이력을 불러오지 못했습니다. (${generationsRes.error.message})` } as const;
  }

  return {
    data: {
      project: {
        id: project.data.id,
        title: project.data.title,
        referenceImageUrl: project.data.reference_image_url,
        productContext: project.data.product_context,
        createdAt: project.data.created_at,
      },
      analysis: analysisRes.data
        ? {
            id: analysisRes.data.id,
            analysis: analysisRes.data.analysis_json,
            createdAt: analysisRes.data.created_at,
          }
        : null,
      prompts: (promptsRes.data ?? []).map((row) => ({
        id: row.id,
        role: row.role,
        title: row.title,
        copy: row.copy_json,
        visual: row.visual_json,
        generationHints: row.generation_hints,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      generations: (generationsRes.data ?? []).map((row) => ({
        id: row.id,
        promptId: row.prompt_id,
        imageModelId: row.image_model_id,
        imageUrl: row.image_url,
        aspectRatio: row.aspect_ratio,
        costUsd: row.cost_usd,
        costKrw: row.cost_krw,
        sellKrw: row.sell_krw,
        textFidelityScore: row.text_fidelity_score,
        createdAt: row.created_at,
      })),
    },
  } as const;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const projectId = context.params.id;

    const result = await loadProjectBundle(user.id, projectId);
    if ("error" in result) {
      const errorMessage = result.error || "프로젝트 조회 실패";
      const status = errorMessage.includes("찾을 수 없습니다") ? 404 : 500;
      return NextResponse.json({ error: errorMessage }, { status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로젝트 조회 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const projectId = context.params.id;

    const payload = await request.json().catch(() => null);
    const parsed = ProjectPatchSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "프로젝트 제목 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServiceClient();

    const updated = await supabase
      .from("studio_projects")
      .update({ title: parsed.data.title })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (updated.error || !updated.data) {
      return NextResponse.json({ error: "프로젝트를 수정할 수 없습니다." }, { status: 404 });
    }

    const result = await loadProjectBundle(user.id, projectId);
    if ("error" in result) {
      const errorMessage = result.error || "프로젝트 조회 실패";
      const status = errorMessage.includes("찾을 수 없습니다") ? 404 : 500;
      return NextResponse.json({ error: errorMessage }, { status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로젝트 수정 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
