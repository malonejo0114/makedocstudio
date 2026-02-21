"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { authFetchJson, formatDateTime, getAccessToken } from "@/lib/studio/client";

type ProjectPrompt = {
  id: string;
  role: string;
  title: string;
  copy: {
    headline: string;
    subhead: string;
    cta: string;
    badges: string[];
  };
};

type ProjectGeneration = {
  id: string;
  promptId: string;
  imageModelId: string;
  imageUrl: string;
  aspectRatio: string;
  textFidelityScore: number | null;
  createdAt: string;
};

type ProjectPayload = {
  project: {
    id: string;
    title: string;
    referenceImageUrl: string;
    productContext: Record<string, unknown>;
    createdAt: string;
  };
  analysis: {
    id: string;
    analysis: {
      moodKeywords: string[];
      strongPoints: string[];
      readabilityWarnings: string[];
    };
    createdAt: string;
  } | null;
  prompts: ProjectPrompt[];
  generations: ProjectGeneration[];
};

function getContextImageUrl(context: Record<string, unknown>, key: string): string | null {
  const value = context[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export default function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [publishingGenerationId, setPublishingGenerationId] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const generationPromptMap = useMemo(() => {
    const map = new Map<string, ProjectPrompt>();
    for (const prompt of data?.prompts ?? []) map.set(prompt.id, prompt);
    return map;
  }, [data?.prompts]);
  const productImageUrl = data
    ? getContextImageUrl(data.project.productContext, "productImageUrl")
    : null;
  const logoImageUrl = data ? getContextImageUrl(data.project.productContext, "logoImageUrl") : null;

  async function load() {
    const payload = await authFetchJson<ProjectPayload>(`/api/studio/projects/${projectId}`);
    setData(payload);
    setTitleDraft(payload.project.title);
  }

  useEffect(() => {
    let mounted = true;
    load()
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "프로젝트 로드 실패");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  async function saveTitle() {
    if (!titleDraft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = await authFetchJson<ProjectPayload>(`/api/studio/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft.trim() }),
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "제목 수정 실패");
    } finally {
      setSaving(false);
    }
  }

  async function downloadGeneration(generation: ProjectGeneration) {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const response = await fetch(`/api/studio/generations/${generation.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("다운로드에 실패했습니다.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `makedoc-studio-${generation.id}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(generation.imageUrl, "_blank");
    }
  }

  async function publishGenerationToMeta(generation: ProjectGeneration, prompt?: ProjectPrompt) {
    setPublishMessage(null);
    setPublishError(null);
    setPublishingGenerationId(generation.id);
    try {
      const payload = await authFetchJson<{
        ok: boolean;
        message: string;
        publish: { campaignId: string; adsetId: string; creativeId: string; adId: string };
      }>("/api/meta/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: generation.id,
          campaignName: `${titleDraft.trim() || data?.project.title || "MakeDoc Project"} Campaign`,
          adSetName: `${titleDraft.trim() || data?.project.title || "MakeDoc Project"} AdSet`,
          adName: prompt?.title || "MakeDoc Ad",
        }),
      });

      setPublishMessage(
        `${payload.message} (Campaign ${payload.publish.campaignId}, Ad ${payload.publish.adId})`,
      );
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Meta 업로드에 실패했습니다.");
    } finally {
      setPublishingGenerationId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <div className="rounded-[28px] border border-black/10 bg-white p-8 text-sm text-black/55">불러오는 중...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">
          {error || "프로젝트를 찾을 수 없습니다."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-20 pt-8">
      <section className="rounded-[32px] border border-black/10 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Project Detail</p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            className="w-full rounded-2xl border border-black/10 px-3 py-2 text-xl font-semibold"
          />
          <button
            type="button"
            onClick={() => void saveTitle()}
            disabled={saving}
            className="rounded-full border border-black/10 bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F]"
          >
            {saving ? "저장 중..." : "제목 저장"}
          </button>
        </div>
        <p className="mt-2 text-xs text-black/55">생성일 {formatDateTime(data.project.createdAt)}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr,1.1fr]">
        <div className="rounded-[28px] border border-black/10 bg-white p-4">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">레퍼런스</h2>
          <img src={data.project.referenceImageUrl} alt="reference" className="mt-3 w-full rounded-2xl border border-black/10" />
          {(productImageUrl || logoImageUrl) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {productImageUrl && (
                <div className="overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                    Product
                  </p>
                  <img src={productImageUrl} alt="product" className="h-32 w-full object-cover" />
                </div>
              )}
              {logoImageUrl && (
                <div className="overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                    Logo
                  </p>
                  <img src={logoImageUrl} alt="logo" className="h-32 w-full object-contain bg-white p-3" />
                </div>
              )}
            </div>
          )}
          {data.analysis && (
            <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 text-xs text-black/65">
              <p className="font-semibold text-black/75">핵심 포인트</p>
              <p className="mt-1">{data.analysis.analysis.strongPoints?.join(" / ") || "-"}</p>
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white p-4">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">프롬프트</h2>
          <div className="mt-3 space-y-2">
            {data.prompts.map((prompt) => (
              <div key={prompt.id} className="rounded-xl border border-black/10 bg-black/[0.02] p-3 text-xs">
                <p className="font-semibold text-black/80">{prompt.title}</p>
                <p className="mt-1 text-black/65">{prompt.copy.headline}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-[28px] border border-black/10 bg-white p-4">
        <h2 className="text-lg font-semibold text-[#0B0B0C]">생성 결과 ({data.generations.length})</h2>
        {publishMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {publishMessage}
          </div>
        )}
        {publishError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {publishError}
          </div>
        )}
        {data.generations.length === 0 ? (
          <p className="text-sm text-black/55">아직 생성된 이미지가 없습니다.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.generations.map((generation) => {
              const prompt = generationPromptMap.get(generation.promptId);
              return (
                <article
                  key={generation.id}
                  className="overflow-hidden rounded-2xl border border-black/10 bg-white"
                >
                  <img src={generation.imageUrl} alt={generation.id} className="h-44 w-full object-cover" />
                  <div className="space-y-1 p-3 text-xs text-black/65">
                    <p className="font-semibold text-black/80">{prompt?.title || generation.promptId}</p>
                    <p>{generation.imageModelId}</p>
                    <p>{formatDateTime(generation.createdAt)}</p>
                    <button
                      type="button"
                      onClick={() => void downloadGeneration(generation)}
                      className="mt-1 rounded-full border border-black/10 bg-black px-3 py-1.5 text-[11px] font-semibold text-[#D6FF4F]"
                    >
                      PNG 다운로드
                    </button>
                    <button
                      type="button"
                      onClick={() => void publishGenerationToMeta(generation, prompt)}
                      disabled={publishingGenerationId !== null}
                      className="mt-1 rounded-full border border-black/10 bg-[#D6FF4F] px-3 py-1.5 text-[11px] font-semibold text-[#0B0B0C] disabled:opacity-60"
                    >
                      {publishingGenerationId === generation.id
                        ? "Meta 업로드 중..."
                        : "Meta 광고 초안 업로드"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Link href="/projects" className="inline-flex text-sm font-semibold text-black/65 underline">
        프로젝트 목록으로 돌아가기
      </Link>
    </main>
  );
}
