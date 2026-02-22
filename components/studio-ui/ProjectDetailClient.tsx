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

type MetaObjective = "OUTCOME_TRAFFIC" | "OUTCOME_LEADS" | "OUTCOME_SALES";

type MetaPublishDraft = {
  campaignName: string;
  objective: MetaObjective;
  specialAdCategories: string;
  adSetName: string;
  dailyBudget: string;
  countryCodes: string;
  ageMin: string;
  ageMax: string;
  adName: string;
  headline: string;
  primaryText: string;
  linkUrl: string;
};

const META_WIZARD_STEPS = ["캠페인", "광고세트", "광고", "확인"];

function getContextImageUrl(context: Record<string, unknown>, key: string): string | null {
  const value = context[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildDefaultMetaDraft(params: {
  projectTitle: string;
  prompt?: ProjectPrompt;
}): MetaPublishDraft {
  const baseTitle = params.projectTitle.trim() || "MakeDoc Project";
  const prompt = params.prompt;
  const headline = prompt?.copy.headline?.trim() || prompt?.title?.trim() || `${baseTitle} 광고`;
  const primaryText =
    prompt?.copy.subhead?.trim() ||
    prompt?.copy.cta?.trim() ||
    "마케닥 스튜디오에서 생성한 광고 초안입니다.";

  return {
    campaignName: `${baseTitle} Campaign`,
    objective: "OUTCOME_TRAFFIC",
    specialAdCategories: "",
    adSetName: `${baseTitle} AdSet`,
    dailyBudget: "10000",
    countryCodes: "KR",
    ageMin: "20",
    ageMax: "55",
    adName: prompt?.title?.trim() ? `${prompt.title} Ad` : `${baseTitle} Ad`,
    headline,
    primaryText,
    linkUrl: "https://makedocstudio.com",
  };
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
  const [wizardGeneration, setWizardGeneration] = useState<ProjectGeneration | null>(null);
  const [wizardPrompt, setWizardPrompt] = useState<ProjectPrompt | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardDraft, setWizardDraft] = useState<MetaPublishDraft | null>(null);

  const generationPromptMap = useMemo(() => {
    const map = new Map<string, ProjectPrompt>();
    for (const prompt of data?.prompts ?? []) map.set(prompt.id, prompt);
    return map;
  }, [data?.prompts]);

  const productImageUrl = data ? getContextImageUrl(data.project.productContext, "productImageUrl") : null;
  const logoImageUrl = data ? getContextImageUrl(data.project.productContext, "logoImageUrl") : null;

  const wizardCanProceed = useMemo(() => {
    if (!wizardDraft) return false;

    if (wizardStep === 1) {
      return wizardDraft.campaignName.trim().length > 0;
    }

    if (wizardStep === 2) {
      const budget = Number(wizardDraft.dailyBudget);
      const ageMin = Number(wizardDraft.ageMin);
      const ageMax = Number(wizardDraft.ageMax);
      return (
        wizardDraft.adSetName.trim().length > 0 &&
        Number.isFinite(budget) &&
        budget >= 100 &&
        parseCommaList(wizardDraft.countryCodes).length > 0 &&
        Number.isFinite(ageMin) &&
        Number.isFinite(ageMax) &&
        ageMin >= 13 &&
        ageMax >= ageMin &&
        ageMax <= 65
      );
    }

    if (wizardStep === 3) {
      return (
        wizardDraft.adName.trim().length > 0 &&
        wizardDraft.headline.trim().length > 0 &&
        wizardDraft.primaryText.trim().length > 0 &&
        isValidUrl(wizardDraft.linkUrl)
      );
    }

    return true;
  }, [wizardDraft, wizardStep]);

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

  function openMetaWizard(generation: ProjectGeneration, prompt?: ProjectPrompt) {
    if (!data) return;
    setPublishMessage(null);
    setPublishError(null);
    setWizardGeneration(generation);
    setWizardPrompt(prompt || null);
    setWizardStep(1);
    setWizardDraft(
      buildDefaultMetaDraft({
        projectTitle: titleDraft.trim() || data.project.title,
        prompt,
      }),
    );
  }

  function closeMetaWizard() {
    if (publishingGenerationId) return;
    setWizardGeneration(null);
    setWizardPrompt(null);
    setWizardDraft(null);
    setWizardStep(1);
  }

  function updateWizardField<K extends keyof MetaPublishDraft>(key: K, value: MetaPublishDraft[K]) {
    setWizardDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function submitMetaWizard() {
    if (!wizardGeneration || !wizardDraft) return;

    const dailyBudget = Math.floor(Number(wizardDraft.dailyBudget));
    const ageMin = Math.floor(Number(wizardDraft.ageMin));
    const ageMax = Math.floor(Number(wizardDraft.ageMax));
    const countryCodes = parseCommaList(wizardDraft.countryCodes)
      .map((code) => code.toUpperCase())
      .filter((code) => /^[A-Z]{2}$/.test(code));
    const specialAdCategories = parseCommaList(wizardDraft.specialAdCategories).map((item) => item.toUpperCase());

    setPublishMessage(null);
    setPublishError(null);
    setPublishingGenerationId(wizardGeneration.id);

    try {
      const payload = await authFetchJson<{
        ok: boolean;
        message: string;
        publish: { campaignId: string; adsetId: string; creativeId: string; adId: string };
      }>("/api/meta/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: wizardGeneration.id,
          campaignName: wizardDraft.campaignName.trim(),
          objective: wizardDraft.objective,
          specialAdCategories,
          adSetName: wizardDraft.adSetName.trim(),
          dailyBudget,
          countryCodes,
          ageMin,
          ageMax,
          adName: wizardDraft.adName.trim(),
          headline: wizardDraft.headline.trim(),
          primaryText: wizardDraft.primaryText.trim(),
          linkUrl: wizardDraft.linkUrl.trim(),
        }),
      });

      setPublishMessage(
        `${payload.message} (Campaign ${payload.publish.campaignId}, Ad ${payload.publish.adId})`,
      );
      closeMetaWizard();
    } catch (apiError) {
      setPublishError(apiError instanceof Error ? apiError.message : "Meta 업로드에 실패했습니다.");
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
                  <div className="aspect-square w-full bg-black/[0.04] p-2">
                    <img
                      src={generation.imageUrl}
                      alt={generation.id}
                      className="h-full w-full rounded-xl border border-black/10 bg-white object-contain"
                    />
                  </div>
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
                      onClick={() => openMetaWizard(generation, prompt)}
                      disabled={publishingGenerationId !== null}
                      className="mt-1 rounded-full border border-black/10 bg-[#D6FF4F] px-3 py-1.5 text-[11px] font-semibold text-[#0B0B0C] disabled:opacity-60"
                    >
                      {publishingGenerationId === generation.id
                        ? "Meta 업로드 중..."
                        : "Meta 광고 설정 시작"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {wizardGeneration && wizardDraft && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-3xl rounded-[30px] border border-black/10 bg-white p-5 shadow-[0_32px_70px_-45px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/45">Meta Wizard</p>
                <h3 className="text-lg font-semibold text-[#0B0B0C]">광고 업로드 설정 ({wizardStep}/4)</h3>
                <p className="mt-0.5 text-xs text-black/55">{wizardPrompt?.title || wizardGeneration.promptId}</p>
              </div>
              <button
                type="button"
                onClick={closeMetaWizard}
                disabled={Boolean(publishingGenerationId)}
                className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/70 disabled:opacity-60"
              >
                닫기
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {META_WIZARD_STEPS.map((label, index) => {
                const step = index + 1;
                const active = step === wizardStep;
                return (
                  <div
                    key={label}
                    className={`rounded-full border px-3 py-1 text-center text-xs font-semibold ${
                      active
                        ? "border-[#0B0B0C] bg-[#0B0B0C] text-[#D6FF4F]"
                        : "border-black/10 bg-black/[0.03] text-black/65"
                    }`}
                  >
                    {step}. {label}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {wizardStep === 1 && (
                <>
                  <label className="space-y-1 text-xs font-medium text-black/65">
                    <span>캠페인 이름</span>
                    <input
                      value={wizardDraft.campaignName}
                      onChange={(event) => updateWizardField("campaignName", event.target.value)}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                      placeholder="예: 벨브 립스틱 3월 캠페인"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-black/65">
                    <span>목표(Objective)</span>
                    <select
                      value={wizardDraft.objective}
                      onChange={(event) => updateWizardField("objective", event.target.value as MetaObjective)}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                    >
                      <option value="OUTCOME_TRAFFIC">트래픽</option>
                      <option value="OUTCOME_LEADS">리드</option>
                      <option value="OUTCOME_SALES">판매</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-black/65">
                    <span>특별 광고 카테고리(선택, 쉼표 구분)</span>
                    <input
                      value={wizardDraft.specialAdCategories}
                      onChange={(event) => updateWizardField("specialAdCategories", event.target.value)}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                      placeholder="예: CREDIT,EMPLOYMENT"
                    />
                  </label>
                </>
              )}

              {wizardStep === 2 && (
                <>
                  <label className="space-y-1 text-xs font-medium text-black/65">
                    <span>광고세트 이름</span>
                    <input
                      value={wizardDraft.adSetName}
                      onChange={(event) => updateWizardField("adSetName", event.target.value)}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                      placeholder="예: 20-55 여성 타겟"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-black/65">
                      <span>일 예산 (KRW)</span>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={wizardDraft.dailyBudget}
                        onChange={(event) => updateWizardField("dailyBudget", event.target.value)}
                        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-black/65">
                      <span>국가 코드 (쉼표 구분)</span>
                      <input
                        value={wizardDraft.countryCodes}
                        onChange={(event) => updateWizardField("countryCodes", event.target.value)}
                        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                        placeholder="KR,US"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-black/65">
                      <span>최소 연령</span>
                      <input
                        type="number"
                        min={13}
                        max={65}
                        value={wizardDraft.ageMin}
                        onChange={(event) => updateWizardField("ageMin", event.target.value)}
                        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-black/65">
                      <span>최대 연령</span>
                      <input
                        type="number"
                        min={13}
                        max={65}
                        value={wizardDraft.ageMax}
                        onChange={(event) => updateWizardField("ageMax", event.target.value)}
                        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </>
              )}

              {wizardStep === 3 && (
                <>
                  <label className="space-y-1 text-xs font-medium text-black/65">
                    <span>광고 이름</span>
                    <input
                      value={wizardDraft.adName}
                      onChange={(event) => updateWizardField("adName", event.target.value)}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                      placeholder="예: 기획자 시선 Ad"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-black/65">
                    <span>헤드라인</span>
                    <input
                      value={wizardDraft.headline}
                      onChange={(event) => updateWizardField("headline", event.target.value)}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-black/65">
                    <span>설명(Primary Text)</span>
                    <textarea
                      value={wizardDraft.primaryText}
                      onChange={(event) => updateWizardField("primaryText", event.target.value)}
                      className="h-24 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-black/65">
                    <span>랜딩 URL</span>
                    <input
                      value={wizardDraft.linkUrl}
                      onChange={(event) => updateWizardField("linkUrl", event.target.value)}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                      placeholder="https://makedocstudio.com"
                    />
                  </label>
                </>
              )}

              {wizardStep === 4 && (
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-xs text-black/70">
                  <p className="font-semibold text-black/80">최종 확인</p>
                  <ul className="mt-2 space-y-1">
                    <li>캠페인: {wizardDraft.campaignName}</li>
                    <li>목표: {wizardDraft.objective}</li>
                    <li>광고세트: {wizardDraft.adSetName}</li>
                    <li>일예산: ₩{Number(wizardDraft.dailyBudget || 0).toLocaleString("ko-KR")}</li>
                    <li>타겟: {wizardDraft.countryCodes} / {wizardDraft.ageMin}~{wizardDraft.ageMax}세</li>
                    <li>광고명: {wizardDraft.adName}</li>
                    <li>헤드라인: {wizardDraft.headline}</li>
                    <li>설명: {wizardDraft.primaryText}</li>
                    <li>URL: {wizardDraft.linkUrl}</li>
                  </ul>
                  <p className="mt-2 text-[11px] text-black/55">생성되는 광고는 Meta에 PAUSED 초안으로 업로드됩니다.</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={closeMetaWizard}
                disabled={Boolean(publishingGenerationId)}
                className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-black/70 disabled:opacity-60"
              >
                취소
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
                  disabled={wizardStep === 1 || Boolean(publishingGenerationId)}
                  className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-black/70 disabled:opacity-40"
                >
                  이전
                </button>
                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep((prev) => Math.min(4, prev + 1))}
                    disabled={!wizardCanProceed || Boolean(publishingGenerationId)}
                    className="rounded-full bg-[#0B0B0C] px-4 py-2 text-xs font-semibold text-[#D6FF4F] disabled:opacity-50"
                  >
                    다음
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submitMetaWizard()}
                    disabled={!wizardCanProceed || Boolean(publishingGenerationId)}
                    className="rounded-full bg-[#D6FF4F] px-4 py-2 text-xs font-semibold text-[#0B0B0C] disabled:opacity-50"
                  >
                    {publishingGenerationId === wizardGeneration.id ? "Meta 업로드 중..." : "Meta 초안 생성"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Link href="/projects" className="inline-flex text-sm font-semibold text-black/65 underline">
        프로젝트 목록으로 돌아가기
      </Link>
    </main>
  );
}
