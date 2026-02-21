"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { authFetchJson, formatDateTime } from "@/lib/studio/client";

type ProjectItem = {
  id: string;
  title: string;
  referenceImageUrl: string;
  createdAt: string;
  promptCount: number;
  generationCount: number;
  latestImageUrl: string | null;
  latestGeneratedAt: string | null;
};

export default function ProjectsPageClient() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    authFetchJson<{ projects: ProjectItem[] }>("/api/studio/projects")
      .then((payload) => {
        if (!mounted) return;
        setProjects(payload.projects || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "프로젝트 조회 실패");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-8">
      <section className="rounded-[32px] border border-black/10 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Projects</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">히스토리 / 프로젝트</h1>
        <p className="mt-2 text-sm text-black/65">생성 결과를 프로젝트 단위로 확인하고 상세에서 다운로드할 수 있습니다.</p>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-black/10 bg-white p-8 text-sm text-black/55">불러오는 중...</div>
      ) : error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{error}</div>
      ) : projects.length === 0 ? (
        <div className="rounded-[28px] border border-black/10 bg-white p-8 text-sm text-black/55">
          저장된 프로젝트가 없습니다. <Link href="/studio" className="font-semibold underline">스튜디오에서 생성 시작</Link>
        </div>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_16px_35px_-28px_rgba(0,0,0,0.45)]"
            >
              <img
                src={project.latestImageUrl || project.referenceImageUrl}
                alt={project.title}
                className="h-44 w-full object-cover"
              />
              <div className="space-y-1 p-3">
                <h2 className="line-clamp-1 text-sm font-semibold text-[#0B0B0C]">{project.title}</h2>
                <p className="text-xs text-black/55">생성 {project.generationCount}장 · 프롬프트 {project.promptCount}개</p>
                <p className="text-xs text-black/45">{formatDateTime(project.createdAt)}</p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
