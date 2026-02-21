"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { authFetchJson, formatDateTime } from "@/lib/studio/client";

type CreditModel = {
  id: string;
  provider: string;
  name: string;
  textSuccess: "상" | "중상" | "중";
  speed: "빠름" | "보통" | "느림";
  price: { creditsRequired: number };
  balance: number;
};

type CreditsResponse = {
  models: CreditModel[];
  globalBalance: number;
};

type UploadAssetType = "reference" | "product";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

type PlanSlide = {
  id: string;
  index: number;
  title: string;
  headline: string;
  subhead: string;
  body: string;
  cta: string;
  badge: string;
  frameworkTag: string;
  visual: string;
  narrative: string;
  designCue: string;
  generation?: {
    id: string;
    imageUrl: string;
    imageModelId: string;
    textFidelityScore: number | null;
    createdAt: string;
  };
  projectId?: string;
};

type CardNewsPlanResponse = {
  title: string;
  concept: string;
  slides: Array<{
    index: number;
    title: string;
    headline: string;
    subhead: string;
    body: string;
    cta: string;
    badge: string;
    frameworkTag: string;
    visual: string;
    narrative: string;
    designCue: string;
  }>;
  warnings: string[];
  analysisCreditUsed?: number;
};

type DirectGenerateResponse = {
  projectId: string;
  promptId: string;
  generation: {
    id: string;
    imageUrl: string;
    imageModelId: string;
    textFidelityScore: number | null;
    createdAt: string;
  };
  creditsUsed: number;
  balanceAfter: number;
};

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function inferTextMode(slide: PlanSlide): "in_image" | "no_text" {
  const hasHeadline = slide.headline.trim().length > 0;
  const hasSubhead = slide.subhead.trim().length > 0 || slide.body.trim().length > 0;
  const hasCta = slide.cta.trim().length > 0;
  const hasBadge = slide.badge.trim().length > 0;
  return hasHeadline || hasSubhead || hasCta || hasBadge ? "in_image" : "no_text";
}

export default function StudioCardNewsWorkbench() {
  const fallbackModels: CreditModel[] = [];
  const [models, setModels] = useState<CreditModel[]>(fallbackModels);
  const [selectedModelId, setSelectedModelId] = useState<string>(fallbackModels[0]?.id || "");

  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [productImageUrl, setProductImageUrl] = useState("");
  const [uploadingAsset, setUploadingAsset] = useState<UploadAssetType | null>(null);

  const [topic, setTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("프리미엄, 미니멀");
  const [productName, setProductName] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const aspectRatio: "4:5" = "4:5";
  const [analysisModel, setAnalysisModel] = useState<"gemini-2.5-flash" | "gemini-2.5-pro">(
    "gemini-2.5-flash",
  );

  const [planTitle, setPlanTitle] = useState("");
  const [planConcept, setPlanConcept] = useState("");
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [slides, setSlides] = useState<PlanSlide[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);

  const [planning, setPlanning] = useState(false);
  const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === selectedModelId) ?? null,
    [models, selectedModelId],
  );
  const selectedSlide = useMemo(
    () => slides.find((slide) => slide.id === selectedSlideId) ?? null,
    [slides, selectedSlideId],
  );
  const totalCreditsForAll = (selectedModel?.price.creditsRequired ?? 1) * slides.length;
  const selectedSlideTextWarnings = useMemo(() => {
    if (!selectedSlide) return [];
    const warnings: string[] = [];
    if (selectedSlide.headline.trim().length < 8) warnings.push("헤드카피가 너무 짧습니다. 8자 이상 권장.");
    if (
      selectedSlide.subhead.trim().length > 0 &&
      selectedSlide.subhead.trim().length < 18
    ) {
      warnings.push("서브카피가 짧습니다. 18자 이상 권장.");
    }
    const bodyLen = selectedSlide.body.trim().length;
    if (bodyLen > 0 && bodyLen < 45) warnings.push("본문이 짧습니다. 45자 이상 권장.");
    if (bodyLen > 110) warnings.push("본문이 깁니다. 110자 이내 권장.");
    return warnings;
  }, [selectedSlide]);

  async function reloadCredits() {
    const payload = await authFetchJson<CreditsResponse>("/api/studio/credits");
    setModels(payload.models);
    if (!payload.models.some((item) => item.id === selectedModelId) && payload.models[0]) {
      setSelectedModelId(payload.models[0].id);
    }
  }

  useEffect(() => {
    void reloadCredits().catch((err) => {
      setError(err instanceof Error ? err.message : "크레딧 정보를 불러오지 못했습니다.");
    });
  }, []);

  async function uploadStudioAsset(file: File, assetType: UploadAssetType): Promise<string> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `${file.name} 파일 용량이 큽니다. 카드뉴스 업로드는 이미지당 최대 4MB까지 지원합니다.`,
      );
    }
    setUploadingAsset(assetType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetType", assetType);
      const payload = await authFetchJson<{ imageUrl?: string; referenceImageUrl?: string }>(
        "/api/studio/reference/upload",
        {
          method: "POST",
          body: formData,
        },
      );

      const uploadedUrl = payload.imageUrl || payload.referenceImageUrl;
      if (!uploadedUrl) throw new Error("업로드 URL을 받지 못했습니다.");
      return uploadedUrl;
    } finally {
      setUploadingAsset(null);
    }
  }

  async function ensureProductImageUrl(): Promise<string> {
    if (productImageUrl) return productImageUrl;
    if (!productFile) return "";
    const uploadedUrl = await uploadStudioAsset(productFile, "product");
    setProductImageUrl(uploadedUrl);
    return uploadedUrl;
  }

  async function ensureReferenceImageUrls(): Promise<string[]> {
    const normalizedExisting = referenceImageUrls.map((item) => item.trim()).filter(Boolean).slice(0, 5);
    if (normalizedExisting.length > 0) return normalizedExisting;
    if (referenceFiles.length === 0) return [];

    const uploaded: string[] = [];
    for (const file of referenceFiles.slice(0, 5)) {
      // eslint-disable-next-line no-await-in-loop
      const uploadedUrl = await uploadStudioAsset(file, "reference");
      uploaded.push(uploadedUrl);
    }
    setReferenceImageUrls(uploaded);
    return uploaded;
  }

  async function onPlanGenerate() {
    if (!topic.trim()) {
      setError("카드뉴스 주제는 필수입니다.");
      return;
    }

    setPlanning(true);
    setError(null);
    setMessage(null);
    setPlanWarnings([]);

    try {
      const uploadedReferenceImageUrls = await ensureReferenceImageUrls();
      const uploadedProductImageUrl = await ensureProductImageUrl();

      const payload = await authFetchJson<CardNewsPlanResponse>("/api/studio/cardnews/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          targetAudience: targetAudience.trim() || undefined,
          objective: objective.trim() || undefined,
          tone: tone.trim() || undefined,
          slideCount,
          aspectRatio,
          productName: productName.trim() || undefined,
          referenceImageUrl: uploadedReferenceImageUrls[0] || undefined,
          referenceImageUrls: uploadedReferenceImageUrls.length > 0 ? uploadedReferenceImageUrls : undefined,
          productImageUrl: uploadedProductImageUrl || undefined,
          additionalNotes: additionalNotes.trim() || undefined,
          analysisModel,
        }),
      });

      const normalizedSlides = payload.slides.map((slide, idx) => ({
        ...slide,
        body: slide.body ?? "",
        frameworkTag: slide.frameworkTag ?? "",
        id: uid(),
        index: slide.index || idx + 1,
      }));

      setPlanTitle(payload.title);
      setPlanConcept(payload.concept);
      setSlides(normalizedSlides);
      setSelectedSlideId(normalizedSlides[0]?.id ?? null);
      setPlanWarnings(payload.warnings ?? []);
      setMessage(
        (payload.analysisCreditUsed ?? 0) > 0
          ? `카드뉴스 ${normalizedSlides.length}장 기획이 생성되었습니다. 분석 ${payload.analysisCreditUsed}크레딧 차감`
          : `카드뉴스 ${normalizedSlides.length}장 기획이 생성되었습니다.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "카드뉴스 기획 생성에 실패했습니다.");
    } finally {
      setPlanning(false);
    }
  }

  function updateSlide(id: string, updater: (slide: PlanSlide) => PlanSlide) {
    setSlides((prev) => prev.map((slide) => (slide.id === id ? updater(slide) : slide)));
  }

  async function generateSlide(slide: PlanSlide, silent = false) {
    if (!selectedModel) throw new Error("모델을 선택해 주세요.");
    if (!slide.visual.trim() || !slide.headline.trim()) {
      throw new Error(`[${slide.index}장] 비주얼과 헤드카피는 필수입니다.`);
    }

    const composedSubhead = [slide.subhead.trim(), slide.body.trim()].filter(Boolean).join("\n");
    const copyToggles = {
      useSubcopy: composedSubhead.length > 0,
      useCTA: slide.cta.trim().length > 0,
      useBadge: slide.badge.trim().length > 0,
    };

    const uploadedReferenceImageUrls = await ensureReferenceImageUrls();
    const uploadedProductImageUrl = await ensureProductImageUrl();

    const payload = await authFetchJson<DirectGenerateResponse>("/api/studio/direct/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceImageUrl: uploadedReferenceImageUrls[0] || undefined,
        referenceImageUrls: uploadedReferenceImageUrls.length > 0 ? uploadedReferenceImageUrls : undefined,
        productImageUrl: uploadedProductImageUrl || undefined,
        productName: productName.trim() || undefined,
        imageModelId: selectedModel.id,
        aspectRatio,
        textMode: inferTextMode(slide),
        visual: slide.visual.trim(),
        headline: slide.headline.trim(),
        subhead: copyToggles.useSubcopy ? composedSubhead : "",
        cta: copyToggles.useCTA ? slide.cta.trim() : "",
        negative: "워터마크, 랜덤 문자, 오타, 저해상도, 깨진 디테일",
        extraTexts: [
          ...(copyToggles.useBadge
            ? [{ label: slide.badge.trim() ? "배지" : "", value: slide.badge.trim() }]
            : []),
          ...(slide.frameworkTag.trim()
            ? [{ label: "프레임워크", value: slide.frameworkTag.trim() }]
            : []),
        ],
        copyToggles,
        textStyle: {
          headline: { fontTone: "auto", effectTone: "auto" },
          subhead: { fontTone: "auto", effectTone: "auto" },
          cta: { fontTone: "auto", effectTone: "auto" },
          badge: { fontTone: "auto", effectTone: "auto" },
        },
      }),
    });

    updateSlide(slide.id, (prev) => ({
      ...prev,
      generation: payload.generation,
      projectId: payload.projectId,
    }));

    if (!silent) {
      setMessage(`[${slide.index}장] 생성 완료 · ${payload.creditsUsed}크레딧 차감`);
    }
  }

  async function onGenerateSelected() {
    if (!selectedSlide || !selectedModel) return;
    if (selectedModel.balance < selectedModel.price.creditsRequired) {
      setError(
        `크레딧이 부족합니다. 현재 ${selectedModel.balance}크레딧, 필요 ${selectedModel.price.creditsRequired}크레딧입니다.`,
      );
      return;
    }

    setGeneratingSlideId(selectedSlide.id);
    setError(null);
    setMessage(null);
    try {
      await generateSlide(selectedSlide);
      await reloadCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "슬라이드 생성에 실패했습니다.");
      await reloadCredits().catch(() => undefined);
    } finally {
      setGeneratingSlideId(null);
    }
  }

  async function onGenerateAll() {
    if (!selectedModel) {
      setError("모델을 선택해 주세요.");
      return;
    }
    if (slides.length === 0) {
      setError("먼저 카드뉴스 기획을 생성해 주세요.");
      return;
    }
    if (selectedModel.balance < totalCreditsForAll) {
      setError(
        `전체 생성에는 ${totalCreditsForAll}크레딧이 필요합니다. 현재 잔액은 ${selectedModel.balance}크레딧입니다.`,
      );
      return;
    }

    setGeneratingAll(true);
    setError(null);
    setMessage(null);

    try {
      for (const slide of slides) {
        setGeneratingSlideId(slide.id);
        // eslint-disable-next-line no-await-in-loop
        await generateSlide(slide, true);
      }
      setMessage(`카드뉴스 ${slides.length}장 생성이 완료되었습니다.`);
      await reloadCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "전체 생성 중 오류가 발생했습니다.");
      await reloadCredits().catch(() => undefined);
    } finally {
      setGeneratingSlideId(null);
      setGeneratingAll(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-10">
      <div className="rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_22px_50px_-35px_rgba(0,0,0,0.35)]">
        <div className="grid gap-4 lg:grid-cols-[1.08fr,0.92fr]">
          <div>
            <h1 className="text-2xl font-semibold text-[#0B0B0C]">카드뉴스 생성</h1>
            <p className="mt-1 text-sm text-black/60">
              주제 기반 기획안을 먼저 만들고, 슬라이드별로 편집 후 순차 생성합니다.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-3 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []).slice(0, 5);
                    setReferenceFiles(files);
                    setReferenceImageUrls([]);
                  }}
                />
                <span className="text-xs font-medium text-black/65">
                  {referenceFiles.length > 0
                    ? `레퍼런스 ${referenceFiles.length}장 선택됨`
                    : "레퍼런스 이미지 최대 5장 (선택)"}
                </span>
                <p className="mt-1 text-[11px] text-black/45">
                  카드 섹션별 스타일 참고용 (색감/타이포/구도)
                </p>
              </label>
              <label className="block rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-3 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    setProductFile(event.target.files?.[0] ?? null);
                    setProductImageUrl("");
                  }}
                />
                <span className="text-xs font-medium text-black/65">
                  {productFile ? `${productFile.name} 선택됨` : "제품 이미지 (선택)"}
                </span>
              </label>
            </div>
            {(referenceFiles.length > 0 || referenceImageUrls.length > 0) && (
              <div className="mt-2 rounded-xl border border-black/10 bg-black/[0.02] p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">
                    References ({referenceImageUrls.length > 0 ? referenceImageUrls.length : referenceFiles.length}/5)
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReferenceFiles([]);
                      setReferenceImageUrls([]);
                    }}
                    className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-black/60"
                  >
                    전체 해제
                  </button>
                </div>
                {referenceImageUrls.length > 0 ? (
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {referenceImageUrls.map((src, index) => (
                      <div
                        key={`${src}-${index}`}
                        className="overflow-hidden rounded-lg border border-black/10 bg-white"
                      >
                        <img src={src} alt={`reference-${index + 1}`} className="h-14 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 space-y-1">
                    {referenceFiles.map((file, index) => (
                      <p key={`${file.name}-${index}`} className="text-[11px] text-black/60">
                        {index + 1}. {file.name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="카드뉴스 주제 (필수)"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                placeholder="제품명 (선택)"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                placeholder="타깃"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                placeholder="목표 (예: 상담 유도/구매 전환)"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                placeholder="톤 (예: 프리미엄, 신뢰, 역동적)"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={slideCount}
                onChange={(event) => setSlideCount(Math.max(3, Math.min(8, Number(event.target.value) || 3)))}
                type="number"
                min={3}
                max={8}
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={additionalNotes}
              onChange={(event) => setAdditionalNotes(event.target.value)}
              rows={2}
              placeholder="추가 요청사항 (선택)"
              className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">모델 선택</span>
              <select
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} | 잔액 {model.balance} | 차감 {model.price.creditsRequired}cr
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-black/65">
                비율
                <div className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#0B0B0C]">
                  4:5 (세로 고정)
                </div>
              </label>
              <label className="text-xs font-medium text-black/65">
                기획 모델
                <select
                  value={analysisModel}
                  onChange={(event) =>
                    setAnalysisModel(event.target.value as "gemini-2.5-flash" | "gemini-2.5-pro")
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => void onPlanGenerate()}
              disabled={planning || Boolean(uploadingAsset)}
              className="mt-3 w-full rounded-full border border-black/10 bg-[#0B0B0C] px-4 py-2.5 text-sm font-semibold text-[#D6FF4F] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {planning ? "기획 생성 중..." : "카드뉴스 기획 생성"}
            </button>

            <button
              type="button"
              onClick={() => void onGenerateAll()}
              disabled={generatingAll || slides.length === 0 || Boolean(uploadingAsset)}
              className="mt-2 w-full rounded-full border border-black/10 bg-[#D6FF4F] px-4 py-2.5 text-sm font-semibold text-[#0B0B0C] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {generatingAll ? "전체 생성 중..." : `전체 생성 (${slides.length}장)`}
            </button>

            {slides.length > 0 ? (
              <p className="mt-2 text-xs text-black/60">
                전체 생성 예상 소모: {totalCreditsForAll}크레딧
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {planWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ul className="list-disc pl-4">
            {planWarnings.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {slides.length > 0 && (
        <div className="rounded-[28px] border border-black/10 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Card Plan</p>
          <h2 className="mt-1 text-xl font-semibold text-[#0B0B0C]">{planTitle || "카드뉴스 기획안"}</h2>
          <p className="mt-1 text-sm text-black/60">{planConcept}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {slides.map((slide) => (
              <button
                type="button"
                key={slide.id}
                onClick={() => setSelectedSlideId(slide.id)}
                className={[
                  "rounded-2xl border p-3 text-left transition",
                  selectedSlideId === slide.id
                    ? "border-[#0B0B0C] bg-[#0B0B0C] text-[#D6FF4F]"
                    : "border-black/10 bg-white text-black/75 hover:-translate-y-0.5",
                ].join(" ")}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Slide {slide.index}</p>
                <p className="mt-1 text-sm font-semibold">{slide.title}</p>
                <p className="mt-1 line-clamp-2 text-xs opacity-85">{slide.headline}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] opacity-80">{slide.frameworkTag}</p>
                {slide.generation ? (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-500">생성 완료</p>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.06fr,0.94fr]">
        <section className="rounded-[28px] border border-black/10 bg-white p-4">
          <h3 className="text-lg font-semibold text-[#0B0B0C]">슬라이드 편집</h3>
          {!selectedSlide ? (
            <p className="mt-2 text-sm text-black/55">기획 생성 후 슬라이드를 선택하세요.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                value={selectedSlide.title}
                onChange={(event) =>
                  updateSlide(selectedSlide.id, (slide) => ({ ...slide, title: event.target.value }))
                }
                placeholder="슬라이드 제목"
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={selectedSlide.headline}
                onChange={(event) =>
                  updateSlide(selectedSlide.id, (slide) => ({ ...slide, headline: event.target.value }))
                }
                placeholder="헤드카피"
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={selectedSlide.subhead}
                onChange={(event) =>
                  updateSlide(selectedSlide.id, (slide) => ({ ...slide, subhead: event.target.value }))
                }
                placeholder="서브카피 (권장 18~40자)"
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <textarea
                value={selectedSlide.body}
                onChange={(event) =>
                  updateSlide(selectedSlide.id, (slide) => ({ ...slide, body: event.target.value }))
                }
                rows={3}
                placeholder="본문 (권장 45~110자, 2~4문장)"
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={selectedSlide.cta}
                  onChange={(event) =>
                    updateSlide(selectedSlide.id, (slide) => ({ ...slide, cta: event.target.value }))
                  }
                  placeholder="CTA (선택)"
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                />
                <input
                  value={selectedSlide.badge}
                  onChange={(event) =>
                    updateSlide(selectedSlide.id, (slide) => ({ ...slide, badge: event.target.value }))
                  }
                  placeholder="배지 텍스트 (선택)"
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                />
              </div>
              <input
                value={selectedSlide.frameworkTag}
                onChange={(event) =>
                  updateSlide(selectedSlide.id, (slide) => ({ ...slide, frameworkTag: event.target.value }))
                }
                placeholder="프레임워크 태그 (예: AIDA:Interest | 기승전결:승 | MECE:근거)"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <textarea
                value={selectedSlide.visual}
                onChange={(event) =>
                  updateSlide(selectedSlide.id, (slide) => ({ ...slide, visual: event.target.value }))
                }
                rows={4}
                placeholder="비주얼 프롬프트"
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <textarea
                  value={selectedSlide.narrative}
                  onChange={(event) =>
                    updateSlide(selectedSlide.id, (slide) => ({ ...slide, narrative: event.target.value }))
                  }
                  rows={2}
                  placeholder="메시지 의도"
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs"
                />
                <textarea
                  value={selectedSlide.designCue}
                  onChange={(event) =>
                    updateSlide(selectedSlide.id, (slide) => ({ ...slide, designCue: event.target.value }))
                  }
                  rows={2}
                  placeholder="디자인 지시"
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => void onGenerateSelected()}
                disabled={generatingAll || generatingSlideId === selectedSlide.id || Boolean(uploadingAsset)}
                className="w-full rounded-full border border-black/10 bg-[#0B0B0C] px-4 py-2.5 text-sm font-semibold text-[#D6FF4F] transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {generatingSlideId === selectedSlide.id ? "선택 슬라이드 생성 중..." : "선택 슬라이드 생성"}
              </button>
              {selectedSlideTextWarnings.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <ul className="list-disc pl-4">
                    {selectedSlideTextWarnings.map((item, idx) => (
                      <li key={`${item}-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white p-4">
          <h3 className="text-lg font-semibold text-[#0B0B0C]">슬라이드 결과</h3>
          {!selectedSlide ? (
            <div className="mt-3 flex aspect-[4/5] items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03] text-sm text-black/45">
              생성 결과가 여기에 표시됩니다.
            </div>
          ) : selectedSlide.generation ? (
            <div className="mt-3 space-y-3">
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]">
                <div className="relative aspect-[4/5] w-full">
                  <img
                    src={selectedSlide.generation.imageUrl}
                    alt={`카드뉴스 ${selectedSlide.index}장`}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 text-xs text-black/65">
                <p>생성 시각: {formatDateTime(selectedSlide.generation.createdAt)}</p>
                <p className="mt-1">모델: {selectedSlide.generation.imageModelId}</p>
                {selectedSlide.generation.textFidelityScore !== null ? (
                  <p className="mt-1">텍스트 일치도: {selectedSlide.generation.textFidelityScore}점</p>
                ) : null}
                <p className="mt-1">프레임워크: {selectedSlide.frameworkTag || "-"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={selectedSlide.generation.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                  >
                    새 탭 보기
                  </a>
                  {selectedSlide.projectId ? (
                    <Link
                      href={`/project/${selectedSlide.projectId}`}
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                    >
                      프로젝트 보기
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-4 text-sm text-black/55">
              선택 슬라이드를 생성하면 결과가 표시됩니다.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
