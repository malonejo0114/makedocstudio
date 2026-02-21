"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { motion } from "framer-motion";

import {
  authFetchJson,
  formatDateTime,
  getAccessToken,
} from "@/lib/studio/client";

type StudioPrompt = {
  id: string;
  role: "PLANNER" | "MARKETER" | "DESIGNER";
  title: string;
  copy: {
    headline: string;
    subhead: string;
    cta: string;
    badges: string[];
  };
  visual: {
    scene: string;
    composition: string;
    style: string;
    lighting: string;
    colorPaletteHint: string;
    negative: string;
  };
  generationHints: {
    aspectRatioDefault: "1:1" | "4:5" | "9:16";
    textModeDefault: "in_image" | "minimal_text" | "no_text";
    copyToggles?: {
      useSubcopy?: boolean;
      useCTA?: boolean;
      useBadge?: boolean;
    };
    textStyle?: {
      headline?: {
        fontTone?: "auto" | "gothic" | "myeongjo" | "rounded" | "calligraphy";
        effectTone?: "auto" | "clean" | "shadow" | "outline" | "emboss" | "bubble";
      };
      subhead?: {
        fontTone?: "auto" | "gothic" | "myeongjo" | "rounded" | "calligraphy";
        effectTone?: "auto" | "clean" | "shadow" | "outline" | "emboss" | "bubble";
      };
      cta?: {
        fontTone?: "auto" | "gothic" | "myeongjo" | "rounded" | "calligraphy";
        effectTone?: "auto" | "clean" | "shadow" | "outline" | "emboss" | "bubble";
      };
      badge?: {
        fontTone?: "auto" | "gothic" | "myeongjo" | "rounded" | "calligraphy";
        effectTone?: "auto" | "clean" | "shadow" | "outline" | "emboss" | "bubble";
      };
    };
    seniorPack?: {
      personaId?: "planner" | "designer" | "performance";
      evidence?: string[];
      why?: {
        observations?: string[];
        interpretation?: string[];
        decisions?: string[];
        risks?: string[];
      };
      validation?: {
        mustPass?: string[];
        autoFixRules?: string[];
      };
      strategy?: Record<string, unknown>;
      hypothesis?: Record<string, unknown>;
      finalPrompt?: string;
      mode?: string;
      missingInputs?: string[];
    };
  };
  createdAt: string;
  updatedAt: string;
};

type AnalysisBox = [number, number, number, number];

type StudioAnalysis = {
  layoutBBoxes: {
    headline: AnalysisBox;
    subhead: AnalysisBox;
    product: AnalysisBox;
    cta: AnalysisBox;
  };
  palette: string[];
  moodKeywords: string[];
  hookPattern: string;
  typographyStyle: string;
  readabilityWarnings: string[];
  strongPoints: string[];
  referenceInsights?: {
    visualFacts?: Record<string, unknown>;
    persuasionFacts?: Record<string, unknown>;
    channelRisk?: Record<string, unknown>;
  };
  missingInputs?: string[];
};

type GenerationResult = {
  id: string;
  promptId: string;
  imageUrl: string;
  imageModelId: string;
  createdAt: string;
  textFidelityScore: number | null;
};

type CreditModel = {
  id: string;
  provider: string;
  name: string;
  textSuccess: "상" | "중상" | "중";
  speed: "빠름" | "보통" | "느림";
  price: { creditsRequired: number };
  highRes:
    | { creditsRequired: number }
    | null;
  balance: number;
};

type AnalyzeResponse = {
  project: {
    id: string;
    title: string;
    reference_image_url: string;
    created_at: string;
  };
  analysis: StudioAnalysis;
  prompts: StudioPrompt[];
  warnings: string[];
  analysisCreditUsed?: number;
  recommendedTemplateIds?: string[];
  inputCase?: "REFERENCE_AND_PRODUCT" | "REFERENCE_ONLY" | "PRODUCT_ONLY" | "NONE";
};

type GenerateResponse = {
  generation: {
    id: string;
    projectId: string;
    promptId: string;
    imageModelId: string;
    imageUrl: string;
    textFidelityScore: number | null;
    createdAt: string;
  };
  balanceAfter: number;
  creditsUsed: number;
};

type CreditsResponse = {
  models: CreditModel[];
  globalBalance: number;
};

type UploadAssetType = "reference" | "product" | "logo" | "person";
type CopyToggles = { useSubcopy: boolean; useCTA: boolean; useBadge: boolean };
type FontTone = "auto" | "gothic" | "myeongjo" | "rounded" | "calligraphy";
type EffectTone = "auto" | "clean" | "shadow" | "outline" | "emboss" | "bubble";
type TextStyleSlot = { fontTone: FontTone; effectTone: EffectTone };
type TemplateItem = {
  id: string;
  title: string;
  tags: string[];
  imageUrl: string;
  isFeatured: boolean;
  createdAt: string;
  analysisJson?: {
    layoutBBoxes?: StudioAnalysis["layoutBBoxes"];
    palette?: string[];
    moodKeywords?: string[];
    hookPattern?: string;
    typographyStyle?: string;
    readabilityWarnings?: string[];
    strongPoints?: string[];
  } | null;
};

const DEFAULT_COPY_TOGGLES: CopyToggles = {
  useSubcopy: true,
  useCTA: true,
  useBadge: true,
};

const ROLE_LABEL: Record<StudioPrompt["role"], string> = {
  PLANNER: "기획자",
  MARKETER: "마케터",
  DESIGNER: "디자이너",
};

const NEGATIVE_PROMPT_EXAMPLES = [
  "워터마크, 로고, 랜덤 문자, 오타",
  "흐림, 저해상도, 노이즈, 깨진 디테일",
  "왜곡된 손/얼굴, 비정상 비율, 잘린 피사체",
];
const FONT_TONE_OPTIONS: Array<{ value: FontTone; label: string }> = [
  { value: "auto", label: "자동(레퍼런스 추종)" },
  { value: "gothic", label: "고딕" },
  { value: "myeongjo", label: "명조" },
  { value: "rounded", label: "동글한 글씨" },
  { value: "calligraphy", label: "장식/캘리" },
];
const EFFECT_TONE_OPTIONS: Array<{ value: EffectTone; label: string }> = [
  { value: "auto", label: "자동" },
  { value: "clean", label: "효과 최소" },
  { value: "shadow", label: "그림자" },
  { value: "outline", label: "외곽선" },
  { value: "emboss", label: "튀어나온 글씨(엠보)" },
  { value: "bubble", label: "동글/버블" },
];
const FIXED_STYLE_TRANSFER_MODE = "style_transfer" as const;
const FIXED_TEXT_ACCURACY_MODE = "normal" as const;

function normalizeCopyToggles(value?: Partial<CopyToggles>) {
  return {
    useSubcopy: value?.useSubcopy ?? true,
    useCTA: value?.useCTA ?? true,
    useBadge: value?.useBadge ?? true,
  };
}

function normalizeTextStyle(value?: StudioPrompt["generationHints"]["textStyle"]) {
  const fallback: TextStyleSlot = { fontTone: "auto", effectTone: "auto" };
  return {
    headline: { ...fallback, ...(value?.headline ?? {}) },
    subhead: { ...fallback, ...(value?.subhead ?? {}) },
    cta: { ...fallback, ...(value?.cta ?? {}) },
    badge: { ...fallback, ...(value?.badge ?? {}) },
  };
}

function textLengthWarnings(prompt: StudioPrompt, textMode: string) {
  if (textMode !== "in_image") return [];
  const warnings: string[] = [];
  const copyToggles = normalizeCopyToggles(prompt.generationHints.copyToggles);
  if ((prompt.copy.headline || "").trim().length > 18) {
    warnings.push("헤드라인이 18자를 초과합니다.");
  }
  if (copyToggles.useCTA && (prompt.copy.cta || "").trim().length > 12) {
    warnings.push("CTA가 12자를 초과합니다.");
  }
  return warnings;
}

function inferPromptTextMode(prompt: StudioPrompt): "in_image" | "no_text" {
  const toggles = normalizeCopyToggles(prompt.generationHints.copyToggles);
  const hasHeadline = prompt.copy.headline.trim().length > 0;
  const hasSubhead = toggles.useSubcopy && prompt.copy.subhead.trim().length > 0;
  const hasCta = toggles.useCTA && prompt.copy.cta.trim().length > 0;
  const hasBadge =
    toggles.useBadge &&
    prompt.copy.badges.some((badge) => typeof badge === "string" && badge.trim().length > 0);
  return hasHeadline || hasSubhead || hasCta || hasBadge ? "in_image" : "no_text";
}

const STRATEGY_KEY_LABEL_KO: Record<string, string> = {
  objective: "목표",
  funnelstage: "퍼널 단계",
  singlemindedpromise: "핵심 약속",
  reasontobelieve: "근거",
  ctaintent: "CTA 의도",
  primarykpi: "핵심 KPI",
  hooktype: "훅 유형",
  testnotes: "테스트 노트",
};

const CHECKLIST_LABEL_KO: Record<string, string> = {
  korean_text_exact: "한글 텍스트 오탈자 없음",
  style_match_high: "레퍼런스 스타일 매칭 높음",
  contrast_ok: "텍스트 대비 양호",
  safe_zone_ok: "세이프존 준수",
  no_watermark: "워터마크/랜덤 로고 없음",
  readability_ok: "가독성 확보",
  increase_headline_size: "헤드라인 크기 확대",
  reduce_subtext_length: "서브카피 길이 축소",
  simplify_background_behind_text: "텍스트 뒤 배경 단순화",
  increase_contrast: "텍스트 대비 강화",
  tighten_layout: "레이아웃 밀도 조정",
};

function localizeChecklistText(text: string) {
  const key = text.trim().toLowerCase();
  return CHECKLIST_LABEL_KO[key] ?? text.trim();
}

function summarizeRecord(value?: Record<string, unknown>) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .map(([key, raw]) => {
      const keyLabel = STRATEGY_KEY_LABEL_KO[key.toLowerCase()] ?? key;
      if (Array.isArray(raw)) {
        const items = raw
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 3);
        return items.length > 0 ? `${keyLabel}: ${items.join(", ")}` : "";
      }
      if (raw && typeof raw === "object") {
        return "";
      }
      const text = String(raw ?? "").trim();
      return text ? `${keyLabel}: ${text}` : "";
    })
    .filter(Boolean)
    .slice(0, 4);
}

function panelVisible(step: number, target: number) {
  return step === target ? "block" : "hidden";
}

function dedupeWarnings(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function buildSupplementalDrafts(
  missingInputs: string[] | undefined,
  previousDrafts: Array<{ label: string; value: string }>,
) {
  const prevMap = new Map(previousDrafts.map((item) => [item.label, item.value]));
  return (missingInputs ?? [])
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => ({
      label,
      value: prevMap.get(label) ?? "",
    }));
}

export default function StudioWorkbench() {
  const fallbackModels: CreditModel[] = [];

  const [mobileStep, setMobileStep] = useState(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [logoImageFile, setLogoImageFile] = useState<File | null>(null);
  const [personImageFile, setPersonImageFile] = useState<File | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [logoImageUrl, setLogoImageUrl] = useState("");
  const [personImageUrl, setPersonImageUrl] = useState("");
  const [useProductAsset, setUseProductAsset] = useState(false);
  const [useLogoAsset, setUseLogoAsset] = useState(false);
  const [usePersonAsset, setUsePersonAsset] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<UploadAssetType | null>(null);

  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [target, setTarget] = useState("");
  const [benefits, setBenefits] = useState("");
  const [bannedWords, setBannedWords] = useState("");
  const [analysisModel, setAnalysisModel] = useState<"gemini-2.5-flash" | "gemini-2.5-pro">(
    "gemini-2.5-flash",
  );

  const [projectId, setProjectId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<StudioAnalysis | null>(null);
  const [prompts, setPrompts] = useState<StudioPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<"copy" | "visual">("copy");

  const [models, setModels] = useState<CreditModel[]>(fallbackModels);
  const [selectedModelId, setSelectedModelId] = useState<string>(fallbackModels[0]?.id || "");
  const [generations, setGenerations] = useState<GenerationResult[]>([]);
  const [generatingPromptId, setGeneratingPromptId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisElapsedSec, setAnalysisElapsedSec] = useState(0);
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);
  const [promptStatusById, setPromptStatusById] = useState<
    Record<string, "clean" | "edited" | "saved">
  >({});
  const [supplementalDrafts, setSupplementalDrafts] = useState<Array<{ label: string; value: string }>>(
    [],
  );
  const [supplementalPanelOpen, setSupplementalPanelOpen] = useState(false);
  const [recommendedTemplateIds, setRecommendedTemplateIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const selectedPrompt = useMemo(
    () => prompts.find((item) => item.id === selectedPromptId) ?? null,
    [prompts, selectedPromptId],
  );

  const selectedModel = useMemo(
    () => models.find((item) => item.id === selectedModelId) ?? null,
    [models, selectedModelId],
  );

  const selectedGeneration = useMemo(() => {
    if (!selectedPromptId) return null;
    return generations.find((item) => item.promptId === selectedPromptId) ?? null;
  }, [generations, selectedPromptId]);
  const recommendedTemplates = useMemo(() => {
    if (recommendedTemplateIds.length === 0 || templates.length === 0) return [];
    return recommendedTemplateIds
      .map((templateId) => templates.find((item) => item.id === templateId))
      .filter((item): item is TemplateItem => Boolean(item));
  }, [recommendedTemplateIds, templates]);
  const selectedModelCreditsRequired = selectedModel?.price.creditsRequired ?? 1;
  const allRequiredCredits = prompts.length * selectedModelCreditsRequired;
  const analysisEstimatedWindow = useMemo(() => {
    const hasExtraAsset = Boolean(
      referenceImageUrl ||
        uploadFile ||
        (useProductAsset && (productImageUrl || productImageFile)) ||
        (useLogoAsset && (logoImageUrl || logoImageFile)) ||
        (usePersonAsset && (personImageUrl || personImageFile)),
    );
    if (analysisModel === "gemini-2.5-pro") {
      return hasExtraAsset ? { min: 35, max: 75 } : { min: 25, max: 55 };
    }
    return hasExtraAsset ? { min: 18, max: 45 } : { min: 12, max: 30 };
  }, [
    analysisModel,
    logoImageFile,
    logoImageUrl,
    personImageFile,
    personImageUrl,
    productImageFile,
    productImageUrl,
    referenceImageUrl,
    useLogoAsset,
    usePersonAsset,
    useProductAsset,
    uploadFile,
  ]);
  const selectedPromptWarnings = useMemo(() => {
    if (!selectedPrompt) return [];
    return dedupeWarnings([
      ...analysisWarnings,
      ...textLengthWarnings(selectedPrompt, inferPromptTextMode(selectedPrompt)),
    ]);
  }, [analysisWarnings, selectedPrompt]);
  const selectedPromptStatus = selectedPrompt
    ? (promptStatusById[selectedPrompt.id] ?? "clean")
    : "clean";

  async function reloadCredits() {
    const payload = await authFetchJson<CreditsResponse>("/api/studio/credits");
    setModels(payload.models);
    if (!payload.models.some((item) => item.id === selectedModelId) && payload.models[0]) {
      setSelectedModelId(payload.models[0].id);
    }
  }

  async function loadTemplates() {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const response = await fetch("/api/templates?featured=1");
      const payload = (await response.json()) as { items?: TemplateItem[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "템플릿을 불러오지 못했습니다.");
      }
      const list = Array.isArray(payload.items) ? payload.items : [];
      setTemplates(list);
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : "템플릿을 불러오지 못했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  }

  function applyTemplate(template: TemplateItem) {
    setReferenceImageUrl(template.imageUrl);
    setUploadFile(null);
    setTemplateModalOpen(false);
    setMessage(`"${template.title}" 템플릿을 레퍼런스로 적용했습니다.`);

    if (template.analysisJson?.layoutBBoxes) {
      setAnalysis((prev) => ({
        layoutBBoxes: template.analysisJson?.layoutBBoxes || prev?.layoutBBoxes || {
          headline: [0.08, 0.1, 0.72, 0.2],
          subhead: [0.08, 0.33, 0.6, 0.14],
          product: [0.58, 0.12, 0.32, 0.55],
          cta: [0.08, 0.78, 0.28, 0.12],
        },
        palette: template.analysisJson?.palette || prev?.palette || ["#0B0B0C", "#F5F5F0", "#D6FF4F"],
        moodKeywords: template.analysisJson?.moodKeywords || prev?.moodKeywords || [],
        hookPattern: template.analysisJson?.hookPattern || prev?.hookPattern || "PREMIUM_POSITIONING",
        typographyStyle: template.analysisJson?.typographyStyle || prev?.typographyStyle || "MODERN_GROTESK",
        readabilityWarnings: template.analysisJson?.readabilityWarnings || prev?.readabilityWarnings || [],
        strongPoints: template.analysisJson?.strongPoints || prev?.strongPoints || [],
      }));
    }
  }

  useEffect(() => {
    void reloadCredits().catch((err) => {
      setError(err instanceof Error ? err.message : "크레딧 정보를 불러오지 못했습니다.");
    });
  }, []);

  useEffect(() => {
    if (!templateModalOpen) return;
    if (templates.length > 0) return;
    void loadTemplates();
  }, [templateModalOpen]);

  useEffect(() => {
    if (recommendedTemplateIds.length === 0) return;
    if (templates.length > 0 || templatesLoading) return;
    void loadTemplates();
  }, [recommendedTemplateIds, templates.length, templatesLoading]);

  useEffect(() => {
    if (!analyzing) {
      setAnalysisElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setAnalysisElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [analyzing]);

  async function uploadStudioAsset(file: File, assetType: UploadAssetType): Promise<string> {
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
      if (!uploadedUrl) {
        throw new Error("업로드 URL을 받지 못했습니다.");
      }
      return uploadedUrl;
    } finally {
      setUploadingAsset(null);
    }
  }

  async function ensureUploadedReference(): Promise<string> {
    if (referenceImageUrl) return referenceImageUrl;
    if (!uploadFile) return "";
    const uploadedUrl = await uploadStudioAsset(uploadFile, "reference");
    setReferenceImageUrl(uploadedUrl);
    return uploadedUrl;
  }

  async function onAnalyze(options?: { isSupplementalReanalyze?: boolean }) {
    setError(null);
    setMessage(null);
    setAnalysisWarnings([]);

    if (options?.isSupplementalReanalyze) {
      const hasSupplementalValue = supplementalDrafts.some((item) => item.value.trim().length > 0);
      if (!hasSupplementalValue) {
        setSupplementalPanelOpen(true);
        setError("보완 입력값을 1개 이상 작성한 뒤 다시 분석해 주세요.");
        return;
      }
    }

    setSupplementalPanelOpen(false);

    try {
      setAnalyzing(true);
      const uploadedUrl = await ensureUploadedReference();
      const uploadedProductImageUrl =
        useProductAsset && (productImageUrl || productImageFile)
          ? productImageUrl || !productImageFile
            ? productImageUrl
            : await uploadStudioAsset(productImageFile, "product")
          : "";
      const uploadedLogoImageUrl =
        useLogoAsset && (logoImageUrl || logoImageFile)
          ? logoImageUrl || !logoImageFile
            ? logoImageUrl
            : await uploadStudioAsset(logoImageFile, "logo")
          : "";
      const uploadedPersonImageUrl =
        usePersonAsset && (personImageUrl || personImageFile)
          ? personImageUrl || !personImageFile
            ? personImageUrl
            : await uploadStudioAsset(personImageFile, "person")
          : "";

      if (uploadedProductImageUrl && uploadedProductImageUrl !== productImageUrl) {
        setProductImageUrl(uploadedProductImageUrl);
      }
      if (uploadedLogoImageUrl && uploadedLogoImageUrl !== logoImageUrl) {
        setLogoImageUrl(uploadedLogoImageUrl);
      }
      if (uploadedPersonImageUrl && uploadedPersonImageUrl !== personImageUrl) {
        setPersonImageUrl(uploadedPersonImageUrl);
      }

      const supplementalInputs = supplementalDrafts
        .map((item) => ({
          label: item.label.trim(),
          value: item.value.trim(),
        }))
        .filter((item) => item.label.length > 0 && item.value.length > 0);
      const additionalContext = supplementalInputs
        .map((item) => `${item.label}: ${item.value}`)
        .join("\n");

      const payload = await authFetchJson<AnalyzeResponse>("/api/studio/reference/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referenceImageUrl: uploadedUrl || undefined,
          analysisModel,
          productContext: {
            platform: "meta_feed",
            productName,
            category,
            target,
            benefits: benefits
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            bannedWords: bannedWords
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            useProductImage: useProductAsset,
            useLogoImage: useLogoAsset,
            usePersonImage: usePersonAsset,
            productImageUrl: uploadedProductImageUrl || undefined,
            logoImageUrl: uploadedLogoImageUrl || undefined,
            personImageUrl: uploadedPersonImageUrl || undefined,
            additionalContext: additionalContext || undefined,
            supplementalInputs: supplementalInputs.length > 0 ? supplementalInputs : undefined,
          },
          copyToggles: DEFAULT_COPY_TOGGLES,
          isSupplementalReanalyze: options?.isSupplementalReanalyze ?? false,
        }),
      });

      const normalizedPrompts = payload.prompts.map((prompt) => ({
        ...prompt,
        generationHints: {
          ...prompt.generationHints,
          aspectRatioDefault: "1:1" as const,
          copyToggles: normalizeCopyToggles(prompt.generationHints.copyToggles),
          textStyle: normalizeTextStyle(prompt.generationHints.textStyle),
        },
      }));

      setProjectId(payload.project.id);
      setAnalysis(payload.analysis);
      setPrompts(normalizedPrompts);
      setPromptStatusById(
        Object.fromEntries(normalizedPrompts.map((prompt) => [prompt.id, "clean"])) as Record<
          string,
          "clean" | "edited" | "saved"
        >,
      );
      setSelectedPromptId(normalizedPrompts[0]?.id ?? null);
      setAnalysisWarnings(payload.warnings ?? []);
      setRecommendedTemplateIds(payload.recommendedTemplateIds ?? []);
      setSupplementalDrafts((prev) => buildSupplementalDrafts(payload.analysis.missingInputs, prev));
      setSupplementalPanelOpen((payload.analysis.missingInputs ?? []).length > 0);
      const baseMessage =
        payload.inputCase === "REFERENCE_AND_PRODUCT" || payload.inputCase === "REFERENCE_ONLY"
          ? "레퍼런스 분석과 3개 프롬프트 생성을 완료했습니다."
          : "레퍼런스 없이 3개 컨셉 프롬프트를 생성했습니다.";
      setMessage(
        (payload.analysisCreditUsed ?? 0) > 0
          ? `${baseMessage} Pro 분석 1크레딧이 차감되었습니다.`
          : baseMessage,
      );
      setMobileStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updatePromptLocal(id: string, updater: (prompt: StudioPrompt) => StudioPrompt) {
    setPrompts((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
    setPromptStatusById((prev) => ({
      ...prev,
      [id]: "edited",
    }));
  }

  async function persistPrompt(prompt: StudioPrompt) {
    await authFetchJson<{ prompt: StudioPrompt }>(`/api/studio/prompts/${prompt.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: prompt.title,
        copy: prompt.copy,
        visual: prompt.visual,
        generationHints: prompt.generationHints,
      }),
    });
    setPromptStatusById((prev) => ({
      ...prev,
      [prompt.id]: "saved",
    }));
    window.setTimeout(() => {
      setPromptStatusById((prev) =>
        prev[prompt.id] === "saved"
          ? {
              ...prev,
              [prompt.id]: "clean",
            }
          : prev,
      );
    }, 2000);
  }

  async function onGenerateOne(prompt: StudioPrompt) {
    if (!projectId) {
      setError("먼저 레퍼런스 분석을 실행해 주세요.");
      return;
    }
    if (!selectedModel) {
      setError("모델을 선택해 주세요.");
      return;
    }
    if (selectedModel.balance < selectedModel.price.creditsRequired) {
      setError(
        `크레딧이 부족합니다. 현재 ${selectedModel.balance}크레딧, 필요 ${selectedModel.price.creditsRequired}크레딧입니다.`,
      );
      return;
    }

    setError(null);
    setMessage(null);
    setGeneratingPromptId(prompt.id);

    try {
      try {
        await persistPrompt(prompt);
      } catch (persistError) {
        console.warn("prompt persist failed, continuing with prompt override", persistError);
      }

      const payload = await authFetchJson<GenerateResponse>("/api/studio/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          promptId: prompt.id,
          imageModelId: selectedModel.id,
          aspectRatio: prompt.generationHints.aspectRatioDefault,
          textMode: inferPromptTextMode(prompt),
          styleTransferMode: FIXED_STYLE_TRANSFER_MODE,
          textAccuracyMode: FIXED_TEXT_ACCURACY_MODE,
          promptOverride: {
            title: prompt.title,
            copy: prompt.copy,
            visual: prompt.visual,
            generationHints: {
              copyToggles: normalizeCopyToggles(prompt.generationHints.copyToggles),
              textStyle: normalizeTextStyle(prompt.generationHints.textStyle),
            },
          },
        }),
      });

      setGenerations((prev) => {
        const filtered = prev.filter((item) => item.promptId !== prompt.id);
        return [
          {
            id: payload.generation.id,
            promptId: payload.generation.promptId,
            imageUrl: payload.generation.imageUrl,
            imageModelId: payload.generation.imageModelId,
            createdAt: payload.generation.createdAt,
            textFidelityScore: payload.generation.textFidelityScore,
          },
          ...filtered,
        ];
      });

      setMobileStep(3);
      setMessage(
        `${ROLE_LABEL[prompt.role]} 프롬프트 이미지 생성이 완료되었습니다. ${payload.creditsUsed}크레딧이 차감되었습니다.`,
      );

      await reloadCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 생성에 실패했습니다.");
      await reloadCredits().catch(() => undefined);
    } finally {
      setGeneratingPromptId(null);
    }
  }

  async function onGenerateAll() {
    if (prompts.length === 0) {
      setError("생성할 프롬프트가 없습니다.");
      return;
    }
    if (!selectedModel) {
      setError("모델을 선택해 주세요.");
      return;
    }
    if (selectedModel.balance < allRequiredCredits) {
      setError(
        `모두 생성에는 ${allRequiredCredits}크레딧이 필요합니다. 현재 잔액은 ${selectedModel.balance}크레딧입니다.`,
      );
      return;
    }

    setGeneratingAll(true);
    setError(null);
    setMessage(null);

    for (const prompt of prompts) {
      // eslint-disable-next-line no-await-in-loop
      await onGenerateOne(prompt);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    setGeneratingAll(false);
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-10">
      {analyzing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-[#0B0B0C] p-5 text-[#F5F5F0] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.75)]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#D6FF4F]" />
              <p className="text-lg font-semibold">분석 중입니다</p>
            </div>
            <p className="mt-2 text-sm text-white/75">
              레퍼런스와 입력값을 기반으로 3개 시선 프롬프트를 생성하고 있습니다.
            </p>
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85">
              <p>
                예상 소요시간: 약 {analysisEstimatedWindow.min}~{analysisEstimatedWindow.max}초
              </p>
              <p className="mt-1 text-xs text-white/65">경과 시간: {analysisElapsedSec}초</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_22px_50px_-35px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#0B0B0C]">마케닥 스튜디오</h1>
            <p className="text-sm text-black/60">
              레퍼런스 분석 → 프롬프트 편집 → 이미지 생성까지 한 화면에서 진행합니다.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
            <label className="space-y-1" data-tour="studio-model-select">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                모델 선택
              </span>
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

            <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-black/65">
              생성 정책은 기본값으로 고정됩니다: 스타일 전이(새 구성) / 정확도 일반
            </div>

            <button
              type="button"
              data-tour="studio-generate-all"
              onClick={onGenerateAll}
              disabled={
                generatingAll ||
                prompts.length === 0 ||
                !selectedModel ||
                selectedModel.balance < allRequiredCredits
              }
              className="mt-auto rounded-full border border-black/10 bg-[#D6FF4F] px-4 py-2 text-sm font-semibold text-[#0B0B0C] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {generatingAll ? "모두 생성 중..." : "모두 생성하기"}
            </button>
          </div>
        </div>

        {selectedModel && selectedModel.balance < selectedModel.price.creditsRequired && (
          <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            현재 잔액으로는 생성이 어렵습니다. 이 모델은 1장 생성에 {selectedModel.price.creditsRequired}
            크레딧이 필요합니다.
            <Link href="/account" className="ml-2 font-semibold underline">
              크레딧 충전
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-2 lg:hidden">
        <div className="grid grid-cols-3 gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMobileStep(1)}
            className={[
              "rounded-xl px-2 py-2",
              mobileStep === 1 ? "bg-[#0B0B0C] text-[#D6FF4F]" : "bg-black/5 text-black/70",
            ].join(" ")}
          >
            Step 1 업로드
          </button>
          <button
            type="button"
            onClick={() => setMobileStep(2)}
            className={[
              "rounded-xl px-2 py-2",
              mobileStep === 2 ? "bg-[#0B0B0C] text-[#D6FF4F]" : "bg-black/5 text-black/70",
            ].join(" ")}
          >
            Step 2 프롬프트
          </button>
          <button
            type="button"
            onClick={() => setMobileStep(3)}
            className={[
              "rounded-xl px-2 py-2",
              mobileStep === 3 ? "bg-[#0B0B0C] text-[#D6FF4F]" : "bg-black/5 text-black/70",
            ].join(" ")}
          >
            Step 3 생성
          </button>
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

      {recommendedTemplateIds.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0B0B0C]">추천 레퍼런스</p>
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black/70"
            >
              전체 보기
            </button>
          </div>
          {recommendedTemplates.length > 0 ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {recommendedTemplates.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => applyTemplate(item)}
                  className="overflow-hidden rounded-2xl border border-black/10 text-left transition hover:-translate-y-0.5"
                >
                  <img src={item.imageUrl} alt={item.title} className="h-24 w-full object-cover" />
                  <p className="px-2 py-1.5 text-xs font-semibold text-black/75">{item.title}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-black/55">{recommendedTemplateIds.join(", ")}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.95fr,1.08fr,1.12fr]">
        <section className={`${panelVisible(mobileStep, 1)} rounded-[28px] border border-black/10 bg-white p-4 lg:block`}>
          <h2 className="text-lg font-semibold text-[#0B0B0C]">입력 / 분석</h2>
          <p className="mt-1 text-xs text-black/55">
            레퍼런스는 선택입니다. 없으면 추천 템플릿과 컨셉 제안으로 시작할 수 있습니다.
          </p>

          <label
            data-tour="studio-analyze-upload"
            className="mt-4 block rounded-2xl border border-dashed border-black/20 bg-black/[0.02] p-4 text-center"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                setUploadFile(event.target.files?.[0] ?? null);
                setReferenceImageUrl("");
              }}
            />
            <span className="text-sm font-medium text-black/70">
              {uploadFile ? `${uploadFile.name} 선택됨` : "레퍼런스 이미지 (선택)"}
            </span>
            <p className="mt-1 text-xs text-black/45">JPG/PNG/WEBP</p>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/75 transition hover:-translate-y-0.5"
            >
              추천 레퍼런스 보기 ↗
            </button>
            {referenceImageUrl && (
              <button
                type="button"
                onClick={() => setReferenceImageUrl("")}
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/60"
              >
                레퍼런스 해제
              </button>
            )}
          </div>
          {referenceImageUrl && (
            <div className="mt-2 overflow-hidden rounded-xl border border-black/10 bg-white">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">
                Reference
              </p>
              <img src={referenceImageUrl} alt="레퍼런스 이미지" className="h-24 w-full object-cover" />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setUseProductAsset((prev) => {
                  const next = !prev;
                  if (!next) {
                    setProductImageFile(null);
                    setProductImageUrl("");
                  }
                  return next;
                })
              }
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                useProductAsset
                  ? "border-[#0B0B0C] bg-[#0B0B0C] text-[#D6FF4F]"
                  : "border-black/10 bg-white text-black/65",
              ].join(" ")}
            >
              {useProductAsset ? "제품 이미지 사용 중" : "제품 이미지 추가"}
            </button>
            <button
              type="button"
              onClick={() =>
                setUseLogoAsset((prev) => {
                  const next = !prev;
                  if (!next) {
                    setLogoImageFile(null);
                    setLogoImageUrl("");
                  }
                  return next;
                })
              }
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                useLogoAsset
                  ? "border-[#0B0B0C] bg-[#0B0B0C] text-[#D6FF4F]"
                  : "border-black/10 bg-white text-black/65",
              ].join(" ")}
            >
              {useLogoAsset ? "로고 이미지 사용 중" : "로고 이미지 추가"}
            </button>
            <button
              type="button"
              onClick={() =>
                setUsePersonAsset((prev) => {
                  const next = !prev;
                  if (!next) {
                    setPersonImageFile(null);
                    setPersonImageUrl("");
                  }
                  return next;
                })
              }
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                usePersonAsset
                  ? "border-[#0B0B0C] bg-[#0B0B0C] text-[#D6FF4F]"
                  : "border-black/10 bg-white text-black/65",
              ].join(" ")}
            >
              {usePersonAsset ? "인물 이미지 사용 중" : "인물 이미지 추가"}
            </button>
          </div>

          {(useProductAsset || useLogoAsset || usePersonAsset) && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {useProductAsset && (
                <label className="block rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-3 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      setProductImageFile(event.target.files?.[0] ?? null);
                      setProductImageUrl("");
                    }}
                  />
                  <span className="text-xs font-medium text-black/65">
                    {productImageFile ? `${productImageFile.name} 선택됨` : "제품 이미지 업로드"}
                  </span>
                </label>
              )}
              {useLogoAsset && (
                <label className="block rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-3 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      setLogoImageFile(event.target.files?.[0] ?? null);
                      setLogoImageUrl("");
                    }}
                  />
                  <span className="text-xs font-medium text-black/65">
                    {logoImageFile ? `${logoImageFile.name} 선택됨` : "로고 이미지 업로드"}
                  </span>
                </label>
              )}
              {usePersonAsset && (
                <label className="block rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-3 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      setPersonImageFile(event.target.files?.[0] ?? null);
                      setPersonImageUrl("");
                    }}
                  />
                  <span className="text-xs font-medium text-black/65">
                    {personImageFile ? `${personImageFile.name} 선택됨` : "인물 이미지 업로드"}
                  </span>
                </label>
              )}
            </div>
          )}

          {(productImageUrl || logoImageUrl || personImageUrl) && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {productImageUrl && (
                <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">
                    Product
                  </p>
                  <img src={productImageUrl} alt="제품 이미지" className="h-20 w-full object-cover" />
                </div>
              )}
              {logoImageUrl && (
                <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">
                    Logo
                  </p>
                  <img src={logoImageUrl} alt="로고 이미지" className="h-20 w-full object-contain p-2" />
                </div>
              )}
              {personImageUrl && (
                <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">
                    Person
                  </p>
                  <img src={personImageUrl} alt="인물 이미지" className="h-20 w-full object-cover" />
                </div>
              )}
            </div>
          )}

          <div className="mt-4 space-y-2">
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="제품명"
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="업종/카테고리"
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="타깃"
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              value={benefits}
              onChange={(event) => setBenefits(event.target.value)}
              placeholder="핵심 혜택 (콤마 구분)"
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              value={bannedWords}
              onChange={(event) => setBannedWords(event.target.value)}
              placeholder="금지 요소/단어 (콤마 구분)"
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <label className="block text-xs font-medium text-black/65">
              분석 모델
              <select
                value={analysisModel}
                onChange={(event) =>
                  setAnalysisModel(
                    event.target.value as "gemini-2.5-flash" | "gemini-2.5-pro",
                  )
                }
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (기본/속도)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (품질 우선)</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            data-tour="studio-analyze-run"
            onClick={() => void onAnalyze()}
            disabled={analyzing || Boolean(uploadingAsset)}
            className="mt-4 w-full rounded-full bg-[#0B0B0C] px-4 py-2.5 text-sm font-semibold text-[#D6FF4F] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {uploadingAsset
              ? "이미지 업로드 중..."
                : analyzing
                  ? "분석 중..."
                : referenceImageUrl
                  ? "레퍼런스 분석하기"
                  : "컨셉 생성하기"}
          </button>

          {analysis && (
            <div className="mt-4 space-y-3 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-sm">
              <p className="font-semibold text-black/80">분석 결과</p>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">후킹 패턴</p>
                <p className="mt-1">{analysis.hookPattern}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">타이포 스타일</p>
                <p className="mt-1">{analysis.typographyStyle}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">강점 3개</p>
                <ul className="mt-1 list-disc pl-4 text-black/70">
                  {(analysis.strongPoints || []).map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
              {(analysis.readabilityWarnings || []).length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-800">
                  {(analysis.readabilityWarnings || []).join(" / ")}
                </div>
              )}
              {(analysis.missingInputs || []).length > 0 && (
                <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-2">
                  <p className="text-sm font-semibold text-rose-700">
                    입력 보강 필요: {(analysis.missingInputs || []).join(" / ")}
                  </p>
                  <p className="text-xs text-rose-700/90">
                    아래 항목을 채우면 카피 정확도와 설득 포인트가 더 선명해집니다.
                  </p>
                  {supplementalPanelOpen ? (
                    <div className="space-y-2">
                      {supplementalDrafts.map((item, index) => (
                        <label key={`${item.label}-${index}`} className="block space-y-1">
                          <span className="text-[11px] font-semibold text-rose-700">{item.label}</span>
                          <textarea
                            value={item.value}
                            onChange={(event) =>
                              setSupplementalDrafts((prev) =>
                                prev.map((draft, draftIndex) =>
                                  draftIndex === index
                                    ? {
                                        ...draft,
                                        value: event.target.value,
                                      }
                                    : draft,
                                ),
                              )
                            }
                            rows={2}
                            placeholder="이 항목의 구체 정보(숫자/조건/기간/근거)를 입력해 주세요."
                            className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs text-black/80"
                          />
                        </label>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void onAnalyze({ isSupplementalReanalyze: true })}
                          disabled={analyzing || Boolean(uploadingAsset)}
                          className="rounded-full border border-rose-300 bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          다시 분석하기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSupplementalPanelOpen(false);
                            setMessage("보강 없이 현재 분석 결과로 계속 진행합니다.");
                          }}
                          className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          그냥 진행하기
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSupplementalPanelOpen(true)}
                      className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      보강 항목 입력 다시 열기
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <section
          data-tour="studio-preview-panel"
          className={`${panelVisible(mobileStep, 3)} rounded-[28px] border border-black/10 bg-white p-4 lg:block`}
        >
          <h2 className="text-lg font-semibold text-[#0B0B0C]">미리보기 / 결과</h2>
          <p className="mt-1 text-xs text-black/55">
            생성 전에는 레퍼런스 미리보기, 생성 후에는 결과 이미지를 표시합니다.
          </p>

          <div className="mt-4 overflow-hidden rounded-[24px] border border-black/10 bg-black/[0.03]">
            <div className="relative aspect-square w-full">
              {selectedGeneration ? (
                <img
                  src={selectedGeneration.imageUrl}
                  alt="생성 결과"
                  className="h-full w-full object-cover"
                />
              ) : referenceImageUrl ? (
                <img src={referenceImageUrl} alt="레퍼런스 프리뷰" className="h-full w-full object-cover opacity-90" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-black/45">
                  분석 후 프리뷰가 표시됩니다.
                </div>
              )}
            </div>
          </div>

          {selectedGeneration && (
            <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-xs text-black/65">
              <p>생성 시각: {formatDateTime(selectedGeneration.createdAt)}</p>
              <p className="mt-1">모델: {selectedGeneration.imageModelId}</p>
              {selectedGeneration.textFidelityScore !== null && (
                <p className="mt-1">텍스트 일치도: {selectedGeneration.textFidelityScore}점</p>
              )}
              {selectedPrompt && (
                <div className="mt-2 rounded-xl border border-black/10 bg-white p-2 text-[11px] text-black/70">
                  <p className="font-semibold text-black/75">생성 텍스트 구조</p>
                  <p className="mt-1">헤드카피: {selectedPrompt.copy.headline || "-"}</p>
                  <p className="mt-0.5">
                    서브카피:{" "}
                    {normalizeCopyToggles(selectedPrompt.generationHints.copyToggles).useSubcopy
                      ? selectedPrompt.copy.subhead || "-"
                      : "(비활성화)"}
                  </p>
                  <p className="mt-0.5">
                    CTA:{" "}
                    {normalizeCopyToggles(selectedPrompt.generationHints.copyToggles).useCTA
                      ? selectedPrompt.copy.cta || "-"
                      : "(비활성화)"}
                  </p>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <a
                  href={selectedGeneration.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  새 탭 보기
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const token = await getAccessToken();
                      if (!token) throw new Error("로그인이 필요합니다.");

                      const response = await fetch(
                        `/api/studio/generations/${selectedGeneration.id}/download`,
                        {
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        },
                      );
                      if (!response.ok) {
                        throw new Error("다운로드 실패");
                      }
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = `makedoc-studio-${selectedGeneration.id}.png`;
                      document.body.appendChild(anchor);
                      anchor.click();
                      anchor.remove();
                      URL.revokeObjectURL(url);
                    } catch {
                      window.open(selectedGeneration.imageUrl, "_blank");
                    }
                  }}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  다운로드
                </button>
              </div>
            </div>
          )}
        </section>

        <section
          data-tour="studio-prompt-panel"
          className={`${panelVisible(mobileStep, 2)} rounded-[28px] border border-black/10 bg-white p-4 lg:block`}
        >
          <h2 className="text-lg font-semibold text-[#0B0B0C]">프롬프트 3개</h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                type="button"
                key={prompt.id}
                onClick={() => setSelectedPromptId(prompt.id)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  selectedPromptId === prompt.id
                    ? "bg-[#0B0B0C] text-[#D6FF4F]"
                    : "bg-black/5 text-black/70",
                ].join(" ")}
              >
                {ROLE_LABEL[prompt.role]}
                {promptStatusById[prompt.id] === "edited" && (
                  <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700">
                    수정됨
                  </span>
                )}
              </button>
            ))}
          </div>

          {selectedPrompt ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-black/10 p-3">
              <input
                value={selectedPrompt.title}
                onChange={(event) =>
                  updatePromptLocal(selectedPrompt.id, (prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
              />
              {selectedPromptStatus !== "clean" && (
                <p className="text-xs font-semibold text-emerald-700">
                  {selectedPromptStatus === "edited" ? "수정되었습니다." : "저장 완료되었습니다."}
                </p>
              )}

              {selectedPrompt.generationHints.seniorPack && (
                <div className="space-y-2 rounded-xl border border-black/10 bg-black/[0.02] p-2.5 text-xs">
                  <div className="rounded-lg border border-black/10 bg-white p-2">
                    <p className="font-semibold text-black/75">근거(Reference Evidence)</p>
                    <ul className="mt-1 list-disc pl-4 text-black/70">
                      {(selectedPrompt.generationHints.seniorPack.evidence ?? []).slice(0, 6).map((item, index) => (
                        <li key={`evidence-${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-black/10 bg-white p-2">
                    <p className="font-semibold text-black/75">의사결정(Decision)</p>
                    <ul className="mt-1 list-disc pl-4 text-black/70">
                      {(selectedPrompt.generationHints.seniorPack.why?.decisions ?? [])
                        .slice(0, 5)
                        .map((item, index) => (
                          <li key={`decision-${index}-${item}`}>{item}</li>
                        ))}
                    </ul>
                    {(selectedPrompt.generationHints.seniorPack.why?.risks ?? []).length > 0 && (
                      <p className="mt-1 text-[11px] text-black/55">
                        리스크: {(selectedPrompt.generationHints.seniorPack.why?.risks ?? []).join(" / ")}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-black/10 bg-white p-2">
                    <p className="font-semibold text-black/75">성공 판정(Definition of Done)</p>
                    <ul className="mt-1 list-disc pl-4 text-black/70">
                      {(selectedPrompt.generationHints.seniorPack.validation?.mustPass ?? [])
                        .slice(0, 6)
                        .map((item, index) => (
                          <li key={`must-${index}-${item}`}>{localizeChecklistText(item)}</li>
                        ))}
                    </ul>
                    {(selectedPrompt.generationHints.seniorPack.validation?.autoFixRules ?? []).length > 0 && (
                      <p className="mt-1 text-[11px] text-black/55">
                        자동 보정:{" "}
                        {(selectedPrompt.generationHints.seniorPack.validation?.autoFixRules ?? [])
                          .slice(0, 4)
                          .map((item) => localizeChecklistText(item))
                          .join(" / ")}
                      </p>
                    )}
                  </div>

                  {(summarizeRecord(selectedPrompt.generationHints.seniorPack.strategy).length > 0 ||
                    summarizeRecord(selectedPrompt.generationHints.seniorPack.hypothesis).length > 0) && (
                    <div className="rounded-lg border border-black/10 bg-white p-2 text-[11px] text-black/65">
                      {summarizeRecord(selectedPrompt.generationHints.seniorPack.strategy).length > 0 && (
                        <p>
                          전략: {summarizeRecord(selectedPrompt.generationHints.seniorPack.strategy).join(" / ")}
                        </p>
                      )}
                      {summarizeRecord(selectedPrompt.generationHints.seniorPack.hypothesis).length > 0 && (
                        <p className="mt-1">
                          가설: {summarizeRecord(selectedPrompt.generationHints.seniorPack.hypothesis).join(" / ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveEditorTab("copy")}
                  className={[
                    "rounded-full px-3 py-1.5",
                    activeEditorTab === "copy" ? "bg-black text-white" : "bg-black/5 text-black/70",
                  ].join(" ")}
                >
                  워딩
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEditorTab("visual")}
                  className={[
                    "rounded-full px-3 py-1.5",
                    activeEditorTab === "visual" ? "bg-black text-white" : "bg-black/5 text-black/70",
                  ].join(" ")}
                >
                  비주얼
                </button>
              </div>

              {activeEditorTab === "copy" ? (
                <div className="space-y-2">
                  <input
                    value={selectedPrompt.copy.headline}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        copy: {
                          ...prev.copy,
                          headline: event.target.value,
                        },
                      }))
                    }
                    placeholder="Headline"
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  />
                  <input
                    value={selectedPrompt.copy.subhead}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        copy: {
                          ...prev.copy,
                          subhead: event.target.value,
                        },
                      }))
                    }
                    disabled={!normalizeCopyToggles(selectedPrompt.generationHints.copyToggles).useSubcopy}
                    placeholder={
                      normalizeCopyToggles(selectedPrompt.generationHints.copyToggles).useSubcopy
                        ? "Subhead"
                        : "서브카피 비활성화됨"
                    }
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm disabled:bg-black/[0.04]"
                  />
                  <input
                    value={selectedPrompt.copy.cta}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        copy: {
                          ...prev.copy,
                          cta: event.target.value,
                        },
                      }))
                    }
                    disabled={!normalizeCopyToggles(selectedPrompt.generationHints.copyToggles).useCTA}
                    placeholder={
                      normalizeCopyToggles(selectedPrompt.generationHints.copyToggles).useCTA
                        ? "CTA"
                        : "CTA 비활성화됨"
                    }
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm disabled:bg-black/[0.04]"
                  />
                  <input
                    value={selectedPrompt.copy.badges.join(",")}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
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
                    disabled={!normalizeCopyToggles(selectedPrompt.generationHints.copyToggles).useBadge}
                    placeholder={
                      normalizeCopyToggles(selectedPrompt.generationHints.copyToggles).useBadge
                        ? "Badge (콤마 구분)"
                        : "뱃지 비활성화됨"
                    }
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm disabled:bg-black/[0.04]"
                  />

                  <div className="rounded-xl border border-black/10 bg-black/[0.02] p-2.5">
                    <p className="text-xs font-semibold text-black/75">
                      텍스트 역할별 스타일
                    </p>
                    <p className="mt-0.5 text-[11px] text-black/55">
                      헤드카피/서브카피/CTA를 구분해서 글꼴·효과를 지정합니다.
                    </p>
                    <div className="mt-2 space-y-2">
                      {([
                        { key: "headline", label: "헤드카피" },
                        { key: "subhead", label: "서브카피" },
                        { key: "cta", label: "CTA" },
                        { key: "badge", label: "뱃지" },
                      ] as const).map((slot) => {
                        const textStyle = normalizeTextStyle(selectedPrompt.generationHints.textStyle);
                        const styleValue = textStyle[slot.key];
                        const toggles = normalizeCopyToggles(selectedPrompt.generationHints.copyToggles);
                        const disabled =
                          (slot.key === "subhead" && !toggles.useSubcopy) ||
                          (slot.key === "cta" && !toggles.useCTA) ||
                          (slot.key === "badge" && !toggles.useBadge);

                        return (
                          <div
                            key={slot.key}
                            className="grid grid-cols-[88px,1fr,1fr] gap-1.5 rounded-lg border border-black/10 bg-white p-1.5"
                          >
                            <p className="self-center text-[11px] font-semibold text-black/65">{slot.label}</p>
                            <select
                              value={styleValue.fontTone}
                              disabled={disabled}
                              onChange={(event) =>
                                updatePromptLocal(selectedPrompt.id, (prev) => ({
                                  ...prev,
                                  generationHints: {
                                    ...prev.generationHints,
                                    textStyle: {
                                      ...normalizeTextStyle(prev.generationHints.textStyle),
                                      [slot.key]: {
                                        ...normalizeTextStyle(prev.generationHints.textStyle)[slot.key],
                                        fontTone: event.target.value as FontTone,
                                      },
                                    },
                                  },
                                }))
                              }
                              className="rounded-md border border-black/10 px-2 py-1 text-[11px] disabled:bg-black/[0.05]"
                            >
                              {FONT_TONE_OPTIONS.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={styleValue.effectTone}
                              disabled={disabled}
                              onChange={(event) =>
                                updatePromptLocal(selectedPrompt.id, (prev) => ({
                                  ...prev,
                                  generationHints: {
                                    ...prev.generationHints,
                                    textStyle: {
                                      ...normalizeTextStyle(prev.generationHints.textStyle),
                                      [slot.key]: {
                                        ...normalizeTextStyle(prev.generationHints.textStyle)[slot.key],
                                        effectTone: event.target.value as EffectTone,
                                      },
                                    },
                                  },
                                }))
                              }
                              className="rounded-md border border-black/10 px-2 py-1 text-[11px] disabled:bg-black/[0.05]"
                            >
                              {EFFECT_TONE_OPTIONS.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    value={selectedPrompt.visual.scene}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        visual: {
                          ...prev.visual,
                          scene: event.target.value,
                        },
                      }))
                    }
                    placeholder="Scene"
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  />
                  <input
                    value={selectedPrompt.visual.composition}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        visual: {
                          ...prev.visual,
                          composition: event.target.value,
                        },
                      }))
                    }
                    placeholder="Composition"
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  />
                  <input
                    value={selectedPrompt.visual.style}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        visual: {
                          ...prev.visual,
                          style: event.target.value,
                        },
                      }))
                    }
                    placeholder="Style"
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  />
                  <input
                    value={selectedPrompt.visual.lighting}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        visual: {
                          ...prev.visual,
                          lighting: event.target.value,
                        },
                      }))
                    }
                    placeholder="Lighting"
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  />
                  <input
                    value={selectedPrompt.visual.colorPaletteHint}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        visual: {
                          ...prev.visual,
                          colorPaletteHint: event.target.value,
                        },
                      }))
                    }
                    placeholder="Color palette"
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={selectedPrompt.visual.negative}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        visual: {
                          ...prev.visual,
                          negative: event.target.value,
                        },
                      }))
                    }
                    placeholder="Negative"
                    rows={3}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  />
                  <div className="space-y-1">
                    <p className="text-[11px] text-black/50">
                      네거티브 예시: 원치 않는 요소를 콤마로 적어주세요.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {NEGATIVE_PROMPT_EXAMPLES.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() =>
                            updatePromptLocal(selectedPrompt.id, (prev) => ({
                              ...prev,
                              visual: {
                                ...prev.visual,
                                negative: prev.visual.negative.includes(example)
                                  ? prev.visual.negative
                                  : prev.visual.negative.trim().length > 0
                                    ? `${prev.visual.negative}, ${example}`
                                    : example,
                              },
                            }))
                          }
                          className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/70 transition hover:-translate-y-0.5"
                        >
                          + {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-black/10 bg-black/[0.02] p-2.5 text-xs">
                <p className="font-semibold text-black/75">텍스트 슬롯 토글</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { key: "useSubcopy", label: "서브카피" },
                    { key: "useCTA", label: "CTA 버튼" },
                    { key: "useBadge", label: "뱃지" },
                  ].map((toggle) => {
                    const copyToggles = normalizeCopyToggles(selectedPrompt.generationHints.copyToggles);
                    const checked = copyToggles[toggle.key as keyof CopyToggles];
                    return (
                      <label
                        key={toggle.key}
                        className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[11px] font-medium text-black/70"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            updatePromptLocal(selectedPrompt.id, (prev) => ({
                              ...prev,
                              generationHints: {
                                ...prev.generationHints,
                                copyToggles: {
                                  ...normalizeCopyToggles(prev.generationHints.copyToggles),
                                  [toggle.key]: event.target.checked,
                                },
                              },
                            }))
                          }
                        />
                        {toggle.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs font-medium text-black/65">
                  비율
                  <select
                    value={selectedPrompt.generationHints.aspectRatioDefault}
                    onChange={(event) =>
                      updatePromptLocal(selectedPrompt.id, (prev) => ({
                        ...prev,
                        generationHints: {
                          ...prev.generationHints,
                          aspectRatioDefault: event.target.value as "1:1" | "4:5" | "9:16",
                        },
                      }))
                    }
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  >
                    <option value="1:1">1:1</option>
                    <option value="4:5">4:5</option>
                    <option value="9:16">9:16</option>
                  </select>
                </label>

                <div className="space-y-1 text-xs font-medium text-black/65">
                  <span>텍스트 생성</span>
                  <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/70">
                    {inferPromptTextMode(selectedPrompt) === "in_image"
                      ? "입력된 카피 포함"
                      : "카피 입력 없음 (텍스트 미생성)"}
                  </div>
                </div>
              </div>

              {selectedPromptWarnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  <p className="font-semibold">가독성 알림 ({ROLE_LABEL[selectedPrompt.role]})</p>
                  <ul className="mt-1 list-disc pl-4">
                    {selectedPromptWarnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => void onGenerateOne(selectedPrompt)}
                disabled={
                  Boolean(generatingPromptId) ||
                  generatingAll ||
                  !selectedModel ||
                  selectedModel.balance < selectedModel.price.creditsRequired
                }
                className="w-full rounded-full bg-[#0B0B0C] px-4 py-2.5 text-sm font-semibold text-[#D6FF4F] transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {generatingPromptId === selectedPrompt.id ? "생성 중..." : "이 프롬프트만 생성"}
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-black/20 p-6 text-sm text-black/50">
              분석을 실행하면 3개의 프롬프트가 표시됩니다.
            </div>
          )}
        </section>
      </div>

      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-4xl rounded-3xl border border-black/10 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#0B0B0C]">추천 레퍼런스 템플릿</h3>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/70"
              >
                닫기
              </button>
            </div>

            {templatesLoading ? (
              <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-6 text-sm text-black/55">
                템플릿을 불러오는 중입니다...
              </div>
            ) : templatesError ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                {templatesError}
              </div>
            ) : templates.length === 0 ? (
              <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-6 text-sm text-black/55">
                사용 가능한 템플릿이 없습니다.
              </div>
            ) : (
              <div className="mt-3 grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => applyTemplate(item)}
                    className="overflow-hidden rounded-2xl border border-black/10 text-left transition hover:-translate-y-0.5"
                  >
                    <img src={item.imageUrl} alt={item.title} className="h-32 w-full object-cover" />
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-[#0B0B0C]">{item.title}</p>
                      <p className="mt-1 text-xs text-black/55">{item.tags.join(" · ")}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {projectId && (
        <div className="text-xs text-black/50">
          프로젝트 ID: {projectId} · 생성 결과는
          <Link href="/projects" className="ml-1 font-semibold underline">
            /projects
          </Link>
          에 저장됩니다.
        </div>
      )}
    </div>
  );
}
