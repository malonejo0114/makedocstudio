import { NextResponse } from "next/server";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const supabase = getSupabaseServiceClient();

    const projectsRes = await supabase
      .from("studio_projects")
      .select("id, title, reference_image_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectsRes.error) {
      return NextResponse.json(
        { error: `프로젝트 목록을 불러오지 못했습니다. (${projectsRes.error.message})` },
        { status: 500 },
      );
    }

    const projects = projectsRes.data ?? [];
    const projectIds = projects.map((item) => item.id);

    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [] }, { status: 200 });
    }

    const [promptsRes, generationsRes] = await Promise.all([
      supabase
        .from("studio_prompts")
        .select("id, project_id")
        .in("project_id", projectIds),
      supabase
        .from("studio_generations")
        .select("id, project_id, image_url, created_at")
        .eq("user_id", user.id)
        .in("project_id", projectIds)
        .order("created_at", { ascending: false }),
    ]);

    if (promptsRes.error) {
      return NextResponse.json(
        { error: `프롬프트 정보를 불러오지 못했습니다. (${promptsRes.error.message})` },
        { status: 500 },
      );
    }

    if (generationsRes.error) {
      return NextResponse.json(
        { error: `생성 이력을 불러오지 못했습니다. (${generationsRes.error.message})` },
        { status: 500 },
      );
    }

    const promptsByProject = new Map<string, number>();
    for (const row of promptsRes.data ?? []) {
      promptsByProject.set(row.project_id, (promptsByProject.get(row.project_id) ?? 0) + 1);
    }

    const generationsByProject = new Map<
      string,
      { count: number; latestImageUrl: string | null; latestCreatedAt: string | null }
    >();

    for (const row of generationsRes.data ?? []) {
      const current = generationsByProject.get(row.project_id);
      if (!current) {
        generationsByProject.set(row.project_id, {
          count: 1,
          latestImageUrl: row.image_url,
          latestCreatedAt: row.created_at,
        });
        continue;
      }

      generationsByProject.set(row.project_id, {
        count: current.count + 1,
        latestImageUrl: current.latestImageUrl,
        latestCreatedAt: current.latestCreatedAt,
      });
    }

    const result = projects.map((project) => {
      const generationMeta = generationsByProject.get(project.id);
      return {
        id: project.id,
        title: project.title,
        referenceImageUrl: project.reference_image_url,
        createdAt: project.created_at,
        promptCount: promptsByProject.get(project.id) ?? 0,
        generationCount: generationMeta?.count ?? 0,
        latestImageUrl: generationMeta?.latestImageUrl ?? null,
        latestGeneratedAt: generationMeta?.latestCreatedAt ?? null,
      };
    });

    return NextResponse.json({ projects: result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로젝트 목록 조회 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
