"use client";

import { useEffect, useMemo, useState } from "react";

import { getPricedModelCatalog } from "@/lib/studio/pricing";
import type {
  ProductContext,
  ReferenceAnalysis,
  StudioPromptDraft,
} from "@/lib/studio/types";

type PromptTemplateItem = {
  filename: string;
  content: string;
  updatedAt: string;
};

type PromptFileMeta = {
  koTitle: string;
  description: string;
  recommended: boolean;
};

type AnalyzeResponse = {
  analysis: ReferenceAnalysis;
  prompts: StudioPromptDraft[];
  warnings: string[];
  recommendedTemplateIds?: string[];
};

type PromptPreviewResponse = {
  finalPrompt: string;
  model?: string;
  image?: {
    mimeType: string;
    base64: string;
    dataUrl: string;
  };
  debug?: {
    runtimeCandidates: string[];
    referenceUsed: boolean;
    typographyCropUsed: boolean;
    productUsed: boolean;
    logoUsed: boolean;
  };
};

const DEFAULT_ANALYSIS: ReferenceAnalysis = {
  layoutBBoxes: {
    headline: [0.08, 0.1, 0.72, 0.2],
    subhead: [0.08, 0.33, 0.6, 0.14],
    product: [0.58, 0.12, 0.32, 0.55],
    cta: [0.08, 0.78, 0.28, 0.12],
  },
  palette: ["#0B0B0C", "#F5F5F0", "#D6FF4F"],
  moodKeywords: ["premium", "minimal"],
  hookPattern: "PREMIUM_POSITIONING",
  typographyStyle: "REFERENCE_DRIVEN",
  readabilityWarnings: [],
  strongPoints: ["대비 중심 구성", "명확한 시선 흐름"],
};

const DEFAULT_PROMPT: StudioPromptDraft = {
  id: "planner",
  role: "PLANNER",
  title: "시니어 기획자 시선",
  copy: {
    headline: "",
    subhead: "",
    cta: "",
    badges: [],
  },
  visual: {
    scene: "",
    composition: "",
    style: "",
    lighting: "",
    colorPaletteHint: "",
    negative: "워터마크, 로고, 랜덤 문자, 오타, 저해상도, 깨진 디테일",
  },
  generationHints: {
    aspectRatioDefault: "1:1",
    textModeDefault: "in_image",
    copyToggles: {
      useSubcopy: true,
      useCTA: true,
      useBadge: true,
    },
    textStyle: {
      headline: { fontTone: "auto", effectTone: "auto" },
      subhead: { fontTone: "auto", effectTone: "auto" },
      cta: { fontTone: "auto", effectTone: "auto" },
      badge: { fontTone: "auto", effectTone: "auto" },
    },
  },
};
const FIXED_STYLE_TRANSFER_MODE = "style_transfer" as const;
const FIXED_TEXT_ACCURACY_MODE = "normal" as const;

function copyPrompt(prompt: StudioPromptDraft): StudioPromptDraft {
  return JSON.parse(JSON.stringify(prompt)) as StudioPromptDraft;
}

const PROMPT_FILE_META: Record<string, PromptFileMeta> = {
  "reference_to_triple_prompts.md": {
    koTitle: "레퍼런스 분석 + 3역할 패키지",
    description: "기획자/마케터/디자이너 분석 JSON의 품질을 결정합니다.",
    recommended: true,
  },
  "style_fusion_v2.md": {
    koTitle: "분석 후 생성 (스타일 전이)",
    description: "레퍼런스 느낌을 유지하며 새 문구로 생성할 때 사용합니다.",
    recommended: true,
  },
  "ref_text_replace_v2.md": {
    koTitle: "문구 교체 고정 생성",
    description: "레퍼런스 구성을 거의 유지하고 문구만 바꾸는 모드입니다.",
    recommended: true,
  },
  "studio_direct_generation.md": {
    koTitle: "직접 입력 생성",
    description: "분석 없이 바로 생성하는 직접 입력 모드용 프롬프트입니다.",
    recommended: true,
  },
  "no_ref_concept_v2.md": {
    koTitle: "무레퍼런스 컨셉 생성",
    description: "레퍼런스 없이 3개 방향 컨셉을 만들 때 사용합니다.",
    recommended: true,
  },
  "creative_background_v3.md": {
    koTitle: "배경 전용 생성",
    description: "텍스트 없는 배경만 생성하는 규칙입니다.",
    recommended: false,
  },
};

function getPromptMeta(filename: string): PromptFileMeta {
  return (
    PROMPT_FILE_META[filename] || {
      koTitle: filename,
      description: "보조/레거시 프롬프트 파일",
      recommended: false,
    }
  );
}

export default function AdminPromptLab() {
  const modelCatalog = getPricedModelCatalog();

  const [templates, setTemplates] = useState<PromptTemplateItem[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [editorContent, setEditorContent] = useState("");
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(true);

  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [logoImageUrl, setLogoImageUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [target, setTarget] = useState("");
  const [offer, setOffer] = useState("");
  const [platform, setPlatform] = useState("meta_feed");
  const [tone, setTone] = useState("premium");

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [promptDraft, setPromptDraft] = useState<StudioPromptDraft>(copyPrompt(DEFAULT_PROMPT));
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5" | "9:16">("1:1");
  const [textMode, setTextMode] = useState<"in_image" | "minimal_text" | "no_text">("in_image");
  const [imageModelId, setImageModelId] = useState(modelCatalog[0]?.id || "gemini-3-pro-image-preview");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [previewModel, setPreviewModel] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.filename === selectedFilename) || null,
    [templates, selectedFilename],
  );
  const selectedTemplateMeta = useMemo(
    () => (selectedTemplate ? getPromptMeta(selectedTemplate.filename) : null),
    [selectedTemplate],
  );
  const visibleTemplates = useMemo(
    () =>
      showRecommendedOnly
        ? templates.filter((item) => getPromptMeta(item.filename).recommended)
        : templates,
    [showRecommendedOnly, templates],
  );

  const promptByRole = useMemo(() => {
    const map = new Map<string, StudioPromptDraft>();
    for (const item of analysisResult?.prompts ?? []) {
      map.set(item.role, item);
    }
    return map;
  }, [analysisResult]);

  function buildProductContext(): ProductContext {
    return {
      brandName: brandName.trim() || undefined,
      productName: productName.trim() || undefined,
      category: category.trim() || undefined,
      target: target.trim() || undefined,
      offer: offer.trim() || undefined,
      platform: platform.trim() || undefined,
      tone: tone.trim() || undefined,
      productImageUrl: productImageUrl.trim() || undefined,
      logoImageUrl: logoImageUrl.trim() || undefined,
    };
  }

  async function loadTemplates() {
    setTemplatesLoading(true);
    setTemplateError(null);
    try {
      const response = await fetch("/api/admin/prompts", { cache: "no-store" });
      const payload = (await response.json()) as {
        items?: PromptTemplateItem[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "프롬프트 목록 조회 실패");
      }

      const items = payload.items || [];
      setTemplates(items);

      if (items.length > 0 && !selectedFilename) {
        const defaultItem =
          items.find((item) => item.filename === "style_fusion_v2.md") || items[0];
        setSelectedFilename(defaultItem.filename);
        setEditorContent(defaultItem.content);
      }
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "프롬프트 목록 조회 실패");
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTemplate) return;
    setEditorContent(selectedTemplate.content);
  }, [selectedTemplate]);

  function applyPromptFromAnalysis(role: "PLANNER" | "MARKETER" | "DESIGNER") {
    const source = promptByRole.get(role);
    if (!source) return;
    setPromptDraft(copyPrompt(source));
    setAspectRatio(source.generationHints.aspectRatioDefault || "1:1");
    setTextMode(source.generationHints.textModeDefault || "in_image");
    setPreviewInfo(`${role} 프롬프트를 테스트 폼에 반영했습니다.`);
    setPreviewError(null);
  }

  async function onSaveTemplate() {
    if (!selectedFilename) return;
    setTemplateSaving(true);
    setTemplateMessage(null);
    setTemplateError(null);
    try {
      const response = await fetch("/api/admin/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFilename,
          content: editorContent,
        }),
      });
      const payload = (await response.json()) as {
        item?: PromptTemplateItem;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "프롬프트 저장 실패");
      }

      setTemplates((prev) =>
        prev.map((item) =>
          item.filename === selectedFilename
            ? {
                filename: selectedFilename,
                content: editorContent,
                updatedAt: payload.item?.updatedAt || new Date().toISOString(),
              }
            : item,
        ),
      );
      setTemplateMessage(payload.message || "프롬프트를 저장했습니다.");
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "프롬프트 저장 실패");
    } finally {
      setTemplateSaving(false);
    }
  }

  async function onReloadSelectedTemplate() {
    if (!selectedFilename) return;
    setTemplateMessage(null);
    setTemplateError(null);
    try {
      const response = await fetch(
        `/api/admin/prompts?filename=${encodeURIComponent(selectedFilename)}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        item?: PromptTemplateItem;
        error?: string;
      };
      if (!response.ok || !payload.item) {
        throw new Error(payload.error || "프롬프트를 다시 불러오지 못했습니다.");
      }
      setEditorContent(payload.item.content);
      setTemplates((prev) =>
        prev.map((item) =>
          item.filename === selectedFilename
            ? {
                filename: item.filename,
                content: payload.item!.content,
                updatedAt: payload.item!.updatedAt,
              }
            : item,
        ),
      );
      setTemplateMessage("최신 파일 내용으로 다시 불러왔습니다.");
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "프롬프트 재조회 실패");
    }
  }

  async function onAnalyzeReference() {
    if (!referenceImageUrl.trim()) {
      setAnalysisError("레퍼런스 이미지 URL을 입력해 주세요.");
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError(null);
    setPreviewInfo(null);
    try {
      const response = await fetch("/api/admin/prompt-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_reference",
          referenceImageUrl: referenceImageUrl.trim(),
          productContext: buildProductContext(),
        }),
      });
      const payload = (await response.json()) as AnalyzeResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "분석에 실패했습니다.");
      }
      setAnalysisResult(payload);
      setAnalysisError(null);
      if ((payload.prompts ?? []).length > 0) {
        setPromptDraft(copyPrompt(payload.prompts[0]));
        setAspectRatio(payload.prompts[0].generationHints.aspectRatioDefault || "1:1");
        setTextMode(payload.prompts[0].generationHints.textModeDefault || "in_image");
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "분석 실패");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function onAnalyzeNoReference() {
    setAnalysisLoading(true);
    setAnalysisError(null);
    setPreviewInfo(null);
    try {
      const response = await fetch("/api/admin/prompt-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_no_reference",
          productContext: buildProductContext(),
        }),
      });
      const payload = (await response.json()) as AnalyzeResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "무레퍼런스 분석에 실패했습니다.");
      }
      setAnalysisResult(payload);
      setAnalysisError(null);
      if ((payload.prompts ?? []).length > 0) {
        setPromptDraft(copyPrompt(payload.prompts[0]));
        setAspectRatio(payload.prompts[0].generationHints.aspectRatioDefault || "1:1");
        setTextMode(payload.prompts[0].generationHints.textModeDefault || "in_image");
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "무레퍼런스 분석 실패");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function onBuildPromptOnly() {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewInfo(null);
    try {
      const response = await fetch("/api/admin/prompt-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "build_image_prompt",
          analysis: analysisResult?.analysis ?? DEFAULT_ANALYSIS,
          prompt: promptDraft,
          productContext: buildProductContext(),
          aspectRatio,
          textMode,
          styleTransferMode: FIXED_STYLE_TRANSFER_MODE,
          textAccuracyMode: FIXED_TEXT_ACCURACY_MODE,
        }),
      });
      const payload = (await response.json()) as PromptPreviewResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "프롬프트 빌드 실패");
      }
      setFinalPrompt(payload.finalPrompt || "");
      setPreviewInfo("최종 생성 프롬프트를 갱신했습니다.");
      setPreviewDataUrl("");
      setPreviewModel("");
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "프롬프트 빌드 실패");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function onRunPreviewImage() {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewInfo(null);
    try {
      const response = await fetch("/api/admin/prompt-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_image",
          analysis: analysisResult?.analysis ?? DEFAULT_ANALYSIS,
          prompt: promptDraft,
          productContext: buildProductContext(),
          aspectRatio,
          textMode,
          styleTransferMode: FIXED_STYLE_TRANSFER_MODE,
          textAccuracyMode: FIXED_TEXT_ACCURACY_MODE,
          imageModelId,
          referenceImageUrl: referenceImageUrl.trim() || undefined,
          productImageUrl: productImageUrl.trim() || undefined,
          logoImageUrl: logoImageUrl.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as PromptPreviewResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "미리보기 생성 실패");
      }
      setFinalPrompt(payload.finalPrompt || "");
      setPreviewDataUrl(payload.image?.dataUrl || "");
      setPreviewModel(payload.model || "");
      setPreviewInfo("미리보기 생성이 완료되었습니다.");
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "미리보기 생성 실패");
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <section className="rounded-[28px] border border-black/10 bg-white p-4 md:p-5">
        <h2 className="text-xl font-semibold text-[#0B0B0C]">프롬프트 파일 편집</h2>
        <p className="mt-1 text-sm text-black/60">
          `/prompts` 파일을 웹에서 수정하고 즉시 저장합니다.
        </p>
        <div className="mt-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-black/70">
          권장 수정 파일: `style_fusion_v2.md` / `ref_text_replace_v2.md` /
          `reference_to_triple_prompts.md` / `studio_direct_generation.md`
        </div>

        {templateMessage ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {templateMessage}
          </div>
        ) : null}
        {templateError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {templateError}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-[280px,1fr]">
          <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-black/70">파일 목록</p>
              <label className="inline-flex items-center gap-1 text-[11px] text-black/65">
                <input
                  type="checkbox"
                  checked={showRecommendedOnly}
                  onChange={(event) => setShowRecommendedOnly(event.target.checked)}
                />
                핵심 파일만 보기
              </label>
            </div>
            {templatesLoading ? (
              <p className="p-3 text-sm text-black/55">불러오는 중...</p>
            ) : visibleTemplates.length === 0 ? (
              <p className="p-3 text-sm text-black/55">프롬프트 파일이 없습니다.</p>
            ) : (
              <div className="max-h-96 space-y-1 overflow-auto">
                {visibleTemplates.map((item) => {
                  const meta = getPromptMeta(item.filename);
                  return (
                  <button
                    key={item.filename}
                    type="button"
                    onClick={() => {
                      setSelectedFilename(item.filename);
                      setTemplateMessage(null);
                      setTemplateError(null);
                    }}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left text-sm",
                      selectedFilename === item.filename
                        ? "bg-[#0B0B0C] text-[#D6FF4F]"
                        : "bg-white text-black/80 hover:bg-black/[0.04]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{meta.koTitle}</p>
                      {meta.recommended ? (
                        <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px]">
                          핵심
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] opacity-75">{item.filename}</p>
                    <p className="mt-0.5 text-[11px] opacity-65">{meta.description}</p>
                    <p className="mt-0.5 text-[11px] opacity-70">
                      수정: {new Date(item.updatedAt).toLocaleString("ko-KR")}
                    </p>
                  </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/10 bg-black/[0.01] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-black/75">
                  {selectedTemplateMeta?.koTitle || "파일 선택"}
                </p>
                <p className="text-[11px] text-black/55">
                  {selectedFilename || ""}
                  {selectedTemplateMeta ? ` · ${selectedTemplateMeta.description}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void onReloadSelectedTemplate()}
                  disabled={!selectedFilename || templateSaving}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/70 disabled:opacity-50"
                >
                  다시 불러오기
                </button>
                <button
                  type="button"
                  onClick={() => void onSaveTemplate()}
                  disabled={!selectedFilename || templateSaving}
                  className="rounded-full bg-[#0B0B0C] px-3 py-1.5 text-xs font-semibold text-[#D6FF4F] disabled:opacity-50"
                >
                  {templateSaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
            <textarea
              value={editorContent}
              onChange={(event) => setEditorContent(event.target.value)}
              className="h-[420px] w-full rounded-xl border border-black/10 bg-white p-3 font-mono text-xs leading-relaxed text-black/85"
              placeholder="프롬프트 내용을 편집하세요."
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-4 md:p-5">
        <h2 className="text-xl font-semibold text-[#0B0B0C]">프롬프트 실험실 (분석 → 역할별 생성)</h2>
        <p className="mt-1 text-sm text-black/60">
          레퍼런스 분석 결과를 기획자/마케터/디자이너 프롬프트로 바로 확인하고, 동일 화면에서 생성 미리보기까지 테스트합니다.
        </p>

        {analysisError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {analysisError}
          </div>
        ) : null}
        {previewError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {previewError}
          </div>
        ) : null}
        {previewInfo ? (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
            {previewInfo}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <input
            value={referenceImageUrl}
            onChange={(event) => setReferenceImageUrl(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="레퍼런스 이미지 URL (Supabase public URL)"
          />
          <input
            value={productImageUrl}
            onChange={(event) => setProductImageUrl(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="제품 이미지 URL (선택)"
          />
          <input
            value={logoImageUrl}
            onChange={(event) => setLogoImageUrl(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="로고 이미지 URL (선택)"
          />
          <input
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="브랜드명"
          />
          <input
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="제품명"
          />
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="카테고리"
          />
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="타깃"
          />
          <input
            value={offer}
            onChange={(event) => setOffer(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="오퍼"
          />
          <input
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="플랫폼 (meta_feed 등)"
          />
          <input
            value={tone}
            onChange={(event) => setTone(event.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="톤 (premium/minimal)"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onAnalyzeReference()}
            disabled={analysisLoading}
            className="rounded-full bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F] disabled:opacity-60"
          >
            {analysisLoading ? "분석 중..." : "레퍼런스 분석 실행"}
          </button>
          <button
            type="button"
            onClick={() => void onAnalyzeNoReference()}
            disabled={analysisLoading}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70 disabled:opacity-60"
          >
            무레퍼런스 컨셉 분석
          </button>
          <button
            type="button"
            onClick={() => applyPromptFromAnalysis("PLANNER")}
            disabled={!analysisResult}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/75 disabled:opacity-50"
          >
            기획자 로드
          </button>
          <button
            type="button"
            onClick={() => applyPromptFromAnalysis("MARKETER")}
            disabled={!analysisResult}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/75 disabled:opacity-50"
          >
            마케터 로드
          </button>
          <button
            type="button"
            onClick={() => applyPromptFromAnalysis("DESIGNER")}
            disabled={!analysisResult}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/75 disabled:opacity-50"
          >
            디자이너 로드
          </button>
        </div>

        {analysisResult?.warnings?.length ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800">분석 경고</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
              {analysisResult.warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-black/10 bg-black/[0.015] p-3">
            <p className="text-sm font-semibold text-black/80">선택 프롬프트 편집</p>
            <input
              value={promptDraft.title}
              onChange={(event) =>
                setPromptDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="프롬프트 제목"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={promptDraft.copy.headline}
                onChange={(event) =>
                  setPromptDraft((prev) => ({
                    ...prev,
                    copy: { ...prev.copy, headline: event.target.value },
                  }))
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                placeholder="헤드카피"
              />
              <input
                value={promptDraft.copy.subhead}
                onChange={(event) =>
                  setPromptDraft((prev) => ({
                    ...prev,
                    copy: { ...prev.copy, subhead: event.target.value },
                  }))
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                placeholder="서브카피"
              />
              <input
                value={promptDraft.copy.cta}
                onChange={(event) =>
                  setPromptDraft((prev) => ({
                    ...prev,
                    copy: { ...prev.copy, cta: event.target.value },
                  }))
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                placeholder="CTA"
              />
              <input
                value={promptDraft.copy.badges.join(", ")}
                onChange={(event) =>
                  setPromptDraft((prev) => ({
                    ...prev,
                    copy: {
                      ...prev.copy,
                      badges: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    },
                  }))
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                placeholder="뱃지(콤마 구분)"
              />
            </div>
            <textarea
              value={promptDraft.visual.scene}
              onChange={(event) =>
                setPromptDraft((prev) => ({
                  ...prev,
                  visual: { ...prev.visual, scene: event.target.value },
                }))
              }
              className="h-20 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="비주얼 scene"
            />
            <textarea
              value={promptDraft.visual.composition}
              onChange={(event) =>
                setPromptDraft((prev) => ({
                  ...prev,
                  visual: { ...prev.visual, composition: event.target.value },
                }))
              }
              className="h-16 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="composition"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={promptDraft.visual.style}
                onChange={(event) =>
                  setPromptDraft((prev) => ({
                    ...prev,
                    visual: { ...prev.visual, style: event.target.value },
                  }))
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                placeholder="style"
              />
              <input
                value={promptDraft.visual.lighting}
                onChange={(event) =>
                  setPromptDraft((prev) => ({
                    ...prev,
                    visual: { ...prev.visual, lighting: event.target.value },
                  }))
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                placeholder="lighting"
              />
            </div>
            <input
              value={promptDraft.visual.colorPaletteHint}
              onChange={(event) =>
                setPromptDraft((prev) => ({
                  ...prev,
                  visual: { ...prev.visual, colorPaletteHint: event.target.value },
                }))
              }
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="color palette hint"
            />
            <textarea
              value={promptDraft.visual.negative}
              onChange={(event) =>
                setPromptDraft((prev) => ({
                  ...prev,
                  visual: { ...prev.visual, negative: event.target.value },
                }))
              }
              className="h-16 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="negative prompt"
            />
          </div>

          <div className="space-y-2 rounded-2xl border border-black/10 bg-black/[0.015] p-3">
            <p className="text-sm font-semibold text-black/80">생성 옵션</p>
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={aspectRatio}
                onChange={(event) =>
                  setAspectRatio(event.target.value as "1:1" | "4:5" | "9:16")
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              >
                <option value="1:1">1:1</option>
                <option value="4:5">4:5</option>
                <option value="9:16">9:16</option>
              </select>
              <select
                value={textMode}
                onChange={(event) =>
                  setTextMode(event.target.value as "in_image" | "minimal_text" | "no_text")
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              >
                <option value="in_image">텍스트 포함 생성</option>
                <option value="minimal_text">텍스트 최소화</option>
                <option value="no_text">텍스트 없음</option>
              </select>
              <select
                value={imageModelId}
                onChange={(event) => setImageModelId(event.target.value)}
                className="rounded-xl border border-black/10 px-3 py-2 text-sm md:col-span-2"
              >
                {modelCatalog.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} | {model.provider} | ₩{model.price.sellKrw.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <p className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/60">
              생성 정책 고정: 스타일 전이(새 구성) / 텍스트 정확도 보통
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void onBuildPromptOnly()}
                disabled={previewLoading}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/75 disabled:opacity-60"
              >
                최종 프롬프트 빌드
              </button>
              <button
                type="button"
                onClick={() => void onRunPreviewImage()}
                disabled={previewLoading}
                className="rounded-full bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F] disabled:opacity-60"
              >
                {previewLoading ? "생성 중..." : "이미지 미리보기 생성"}
              </button>
            </div>

            <textarea
              value={finalPrompt}
              readOnly
              className="h-48 w-full rounded-xl border border-black/10 bg-white p-3 font-mono text-[11px] leading-relaxed text-black/80"
              placeholder="빌드된 최종 프롬프트가 여기에 표시됩니다."
            />
          </div>
        </div>

        {previewDataUrl ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.01] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-black/80">생성 미리보기</p>
              <p className="text-xs text-black/55">{previewModel}</p>
            </div>
            <img
              src={previewDataUrl}
              alt="Prompt preview"
              className="w-full rounded-2xl border border-black/10 object-cover"
            />
          </div>
        ) : null}
      </section>
    </section>
  );
}
