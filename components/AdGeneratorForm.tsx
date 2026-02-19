"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import GuidedTour, { type TourStep } from "@/components/GuidedTour";
import LayoutEditorModal from "@/components/LayoutEditorModal";
import MkdocLogo from "@/components/MkdocLogo";
import { runBriefDoctor } from "@/lib/briefDoctor";
import { generateCopyVariants, type CopyVariants } from "@/lib/copyGenerator";
import { extractDominantColorsFromDataUrl } from "@/lib/colorExtract";
import { composeDeterministicCreative } from "@/lib/imageCompose";
import type { AspectRatio, LayoutJson } from "@/lib/layoutSchema";
import { createDefaultLayout, getCanvasPreset } from "@/lib/layoutSchema";
import {
  buildNoReferenceStyleGuide,
  pickStylePreset,
  STYLE_PRESETS,
  type StylePresetId,
} from "@/lib/stylePresets";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type OutputMode = "image_with_text" | "image_only";
type WorkflowMode = "benchmark" | "direct";
type RenderMode = "background_only" | "full_creative";
type ImageSize = "1K" | "2K" | "4K";
type ChannelProfile = "social_standard" | "story_reels" | "google_rda";
type HeroMode = "none" | "product" | "app_phone";
type NanoModel =
  | "gemini-2.5-flash-image"
  | "gemini-3-pro-image-preview"
  | "gemini-2.0-flash-exp-image-generation";

type StrategyCell = {
  benchmark_feature: string;
  why: string;
  action_plan: string;
};

type BenchmarkAnalysis = {
  smart_fact_finding: {
    headline: string;
    sub_text: string;
    cta: string;
    numbers_or_claims: string[];
  };
  decoding: {
    psychological_triggers: string[];
    layout_intent: string;
  };
  strategy_table: {
    visual_guide: StrategyCell;
    main_headline: StrategyCell;
    sub_text: StrategyCell;
    cta_button: StrategyCell;
  };
  nano_input: {
    image_specs: {
      ratio: string;
      pixels: string;
    };
    visual_guide_en: string;
    main_headline: string;
    sub_text: string;
    cta_button: string;
  };
};

type RefItem = {
  id: string;
  file: File;
  previewUrl: string;
  selectedForGenerate: boolean;
  analyzed: boolean;
  analyzing: boolean;
  error: string | null;
  analysis: BenchmarkAnalysis | null;
};

type RenderItem = {
  id: string;
  refId: string;
  refName: string;
  createdAt: number;
  dataUrl: string;
  model: string | null;
};

function makeId(file: File, index: number): string {
  return `${Date.now()}-${index}-${file.name}-${file.size}`;
}

function clampMax<T>(items: T[], max: number) {
  return items.slice(0, max);
}

function normalizeTag(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/["'`]/g, "")
    .replace(/[(){}[\]]/g, "")
    .replace(/[\\/:;]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return null;
  return normalized.length > 22 ? normalized.slice(0, 22) : normalized;
}

function analysisToTags(analysis: BenchmarkAnalysis | null): string[] {
  if (!analysis) return [];

  const candidates: string[] = [
    ...(analysis.decoding.psychological_triggers ?? []),
    ...(analysis.smart_fact_finding.numbers_or_claims ?? []),
    analysis.decoding.layout_intent ?? "",
    analysis.strategy_table.visual_guide.benchmark_feature ?? "",
  ]
    .flatMap((raw) =>
      String(raw)
        .split(/[,|/·\n]+/g)
        .map((item) => item.trim()),
    )
    .filter(Boolean);

  const unique: string[] = [];
  for (const raw of candidates) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    const formatted = `#${tag}`;
    if (!unique.includes(formatted)) {
      unique.push(formatted);
    }
    if (unique.length >= 12) break;
  }
  return unique;
}

function buildVisualGuideFromAnalysis(params: {
  analysis: BenchmarkAnalysis | null;
  styleGuideBase?: string;
  hasProduct: boolean;
  reserveHero: boolean;
  reserveLogo: boolean;
  outputMode: OutputMode;
  headline: string;
  subText: string;
  cta: string;
  extra: string;
}): string {
  const base =
    params.styleGuideBase?.trim() ||
    params.analysis?.nano_input?.visual_guide_en ||
    "Clean modern performance ad layout, premium lighting, clear hierarchy, strong whitespace.";

  const heroLine = params.reserveHero
    ? "IMPORTANT: Leave the HERO_BOX area clean and empty for later deterministic overlay. Do NOT render products, devices, app UI, or any text in HERO_BOX."
    : params.hasProduct
      ? "Use the uploaded product image as the main hero subject. Keep it sharp and central to conversion."
      : "No product image provided. Create a conceptual hero visual aligned with the style.";

  const logoLine = params.reserveLogo
    ? "IMPORTANT: Leave the LOGO_BOX area clean and empty for later deterministic logo overlay. Do NOT render logos, brand marks, or any text in LOGO_BOX."
    : "";

  const textPolicy =
    params.outputMode === "image_only"
      ? "IMPORTANT: Do NOT render any text, words, letters, UI, labels, or typography in the image."
      : [
          "Text overlay is required. Keep Korean text crisp and typo-free.",
          "Headline in the top-left safe area, bold sans-serif, max 2 lines.",
          "Sub text below headline, smaller, high readability.",
          "CTA button in lower-left quadrant, high contrast and clickable-looking.",
          `Use exactly these texts: HEADLINE="${params.headline}", SUB="${params.subText}", CTA="${params.cta}".`,
        ].join("\n");

  return [base, heroLine, logoLine, textPolicy, params.extra ? `Extra request: ${params.extra}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

function BentoCard({
  title,
  subtitle,
  children,
  className = "",
  actions,
  dataTour,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  dataTour?: string;
}) {
  return (
    <section
      data-tour={dataTour}
      className={[
        "rounded-3xl border border-white/60 bg-white/80 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.6)] backdrop-blur",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SkeletonLine({ w = "w-full" }: { w?: string }) {
  return <div className={`h-3 ${w} rounded-full bg-slate-200/80`} />;
}

function SkeletonCard() {
  return (
    <div className="space-y-3 animate-pulse">
      <SkeletonLine w="w-2/3" />
      <SkeletonLine w="w-full" />
      <SkeletonLine w="w-5/6" />
      <SkeletonLine w="w-3/4" />
      <div className="grid grid-cols-3 gap-2 pt-2">
        <div className="h-7 rounded-xl bg-slate-200/70" />
        <div className="h-7 rounded-xl bg-slate-200/70" />
        <div className="h-7 rounded-xl bg-slate-200/70" />
      </div>
    </div>
  );
}

function IconDownload({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function IconClose({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function ImageModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: RenderItem | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_120px_-60px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {item.refName}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {item.model || "gemini"} · {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={item.dataUrl}
              download={`mkdoc-${item.createdAt}.png`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <IconDownload />
              다운로드
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              aria-label="닫기"
            >
              <IconClose />
            </button>
          </div>
        </div>
        <div className="bg-slate-50 p-4">
          <img
            src={item.dataUrl}
            alt="Preview"
            className="mx-auto w-full rounded-2xl border border-slate-200 bg-white object-contain"
          />
        </div>
      </div>
    </div>
  );
}

export default function AdGeneratorForm() {
  const MAX_REFS = 5;
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const preset = useMemo(() => getCanvasPreset(aspectRatio), [aspectRatio]);
  const width = preset.width;
  const height = preset.height;

  const [channelProfile, setChannelProfile] = useState<ChannelProfile>("social_standard");
  const [stylePreset, setStylePreset] = useState<StylePresetId | "auto">("auto");
  const [styleKeywords, setStyleKeywords] = useState("");
  const [logoPalette, setLogoPalette] = useState<string[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [renderMode, setRenderMode] = useState<RenderMode>("background_only");
  const [nanoModel, setNanoModel] = useState<NanoModel>("gemini-3-pro-image-preview");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");

  const [layoutByRatio, setLayoutByRatio] = useState<Record<AspectRatio, LayoutJson>>(() => ({
    "1:1": createDefaultLayout("1:1"),
    "4:5": createDefaultLayout("4:5"),
    "9:16": createDefaultLayout("9:16"),
  }));
  const [layoutReadyByRatio, setLayoutReadyByRatio] = useState<Record<AspectRatio, boolean>>(() => ({
    "1:1": false,
    "4:5": false,
    "9:16": false,
  }));
  const currentLayout = layoutByRatio[aspectRatio];
  const isLayoutReady = layoutReadyByRatio[aspectRatio];
  const [layoutModalOpen, setLayoutModalOpen] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState<null | { kind: "single" | "batch" }>(
    null,
  );

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("benchmark");
  const [refItems, setRefItems] = useState<RefItem[]>([]);
  const [activeRefId, setActiveRefId] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);

  const [productImage, setProductImage] = useState<File | null>(null);
  const [heroMode, setHeroMode] = useState<HeroMode>("product");
  const [appScreenshots, setAppScreenshots] = useState<File[]>([]);
  const [brandLogo, setBrandLogo] = useState<File | null>(null);
  const [logoHorizontal, setLogoHorizontal] = useState<File | null>(null);
  const [logoStacked, setLogoStacked] = useState<File | null>(null);
  const [headline, setHeadline] = useState("여름 한정 특가");
  const [subText, setSubText] = useState("지금 구매 시 50% 할인");
  const [cta, setCta] = useState("구매하기");
  const [badgeText, setBadgeText] = useState("");
  const [legalText, setLegalText] = useState("");
  const [extraRequest, setExtraRequest] = useState("");

  const [briefObjective, setBriefObjective] = useState("");
  const [briefAudience, setBriefAudience] = useState("");
  const [briefUsp, setBriefUsp] = useState("");
  const [briefOffer, setBriefOffer] = useState("");
  const [briefProof, setBriefProof] = useState("");
  const [brandVoiceInput, setBrandVoiceInput] = useState("");
  const [copyLocked, setCopyLocked] = useState(false);
  const [copySuggestions, setCopySuggestions] = useState<CopyVariants | null>(null);

  const [outputMode, setOutputMode] = useState<OutputMode>("image_with_text");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: 0 });
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [promptMode, setPromptMode] = useState<"auto" | "manual">("auto");
  const [promptOverride, setPromptOverride] = useState("");

  const [renders, setRenders] = useState<RenderItem[]>([]);
  const [renderCount, setRenderCount] = useState(2);
  const [qualityLoop, setQualityLoop] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [modalItem, setModalItem] = useState<RenderItem | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [tourEligible, setTourEligible] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourBanner, setTourBanner] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSessionUserId(data.session?.user?.id ?? null);
        setAuthReady(true);
      })
      .catch(() => {
        if (!active) return;
        setSessionUserId(null);
        setAuthReady(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const activeRef = useMemo(
    () => refItems.find((item) => item.id === activeRefId) ?? null,
    [activeRefId, refItems],
  );

  const activeTags = useMemo(() => analysisToTags(activeRef?.analysis ?? null), [activeRef]);

  // Auto-start tutorial once per user/browser (seen flag). Completion is tracked separately.
  useEffect(() => {
    if (!authReady) return;
    const userKey = sessionUserId ?? "anon";
    const doneKey = `mkdoc:tutorial:creative:done:${userKey}`;
    const seenKey = `mkdoc:tutorial:creative:seen:${userKey}`;
    try {
      if (window.localStorage.getItem(doneKey) === "1") {
        setTourEligible(true);
        setTourBanner(false);
        return;
      }
      setTourEligible(true);
      setTourBanner(true);
      if (window.localStorage.getItem(seenKey) !== "1") {
        window.localStorage.setItem(seenKey, "1");
        setTourOpen(true);
      }
    } catch {
      setTourEligible(true);
      setTourBanner(false);
    }
  }, [authReady, sessionUserId]);

  const tutorialSteps: TourStep[] = useMemo(
    () => [
      {
        id: "workflow",
        selector: '[data-tour="creative-workflow"]',
        title: "1) 작업 방식 선택",
        body: "‘분석 후 생성’은 레퍼런스(최대 5장)를 분석해서 구조/소구점을 뽑고, 그 스타일로 생성합니다. ‘바로 이미지 생성’은 레퍼런스 없이도 바로 생성합니다.",
      },
      {
        id: "refs",
        selector: '[data-tour="creative-ref-upload"]',
        title: "2) 레퍼런스 업로드",
        body: "성공 광고 레퍼런스를 드래그&드롭으로 올리세요. 여러 장을 올린 뒤, 생성에 사용할 레퍼런스만 선택해서 일괄 생성도 가능합니다.",
      },
      {
        id: "copy",
        selector: '[data-tour="creative-copy-inputs"]',
        title: "3) 헤드/서브/CTA 카피 입력",
        body: "카피는 나중에 바꿔도 되지만, 처음엔 간단히라도 채우는 게 좋아요. (Google RDA 채널은 이미지-only로 자동 전환됩니다.)",
      },
      {
        id: "layout",
        selector: '[data-tour="creative-layout"]',
        title: "4) 레이아웃(필수) 편집",
        body: "‘레이아웃 편집(팝업)’에서 텍스트/버튼 박스를 드래그로 조절합니다. 미설정 상태에서 생성하면 자동으로 팝업이 먼저 뜹니다.",
      },
      {
        id: "action",
        selector: '[data-tour="creative-primary-action"]',
        title: "5) 분석/생성 시작",
        body: "분석 후 생성 모드라면 먼저 ‘AI 레퍼런스 분석’을 누르세요. 바로 생성 모드라면 ‘바로 이미지 생성’을 누르면 됩니다.",
      },
      {
        id: "prompt",
        selector: '[data-tour="creative-prompt"]',
        title: "6) 프롬프트를 원하는 방향으로 수정",
        body: "AI가 만든 최종 프롬프트를 여기서 직접 수정할 수 있어요. ‘원하는 분위기 추가’에는 딱 한 문장만 써도 반영됩니다.",
      },
      {
        id: "gallery",
        selector: '[data-tour="creative-gallery"]',
        title: "7) 결과 확인/확대/다운로드",
        body: "생성된 썸네일을 클릭하면 크게 보기로 열리고, 상단 다운로드 버튼으로 저장할 수 있습니다.",
      },
    ],
    [],
  );

  const canAnalyze = workflowMode === "benchmark" && refItems.length > 0 && !analyzing;
  const canGenerate =
    !generating &&
    (workflowMode === "direct" || Boolean(activeRef?.file)) &&
    (workflowMode === "direct" || Boolean(activeRef?.analysis));
  const selectedRefCount = useMemo(
    () => refItems.filter((item) => item.selectedForGenerate).length,
    [refItems],
  );

  const isGoogleRda = channelProfile === "google_rda";
  const effectiveOutputMode: OutputMode = isGoogleRda
    ? "image_only"
    : headline.trim() || subText.trim() || cta.trim()
      ? outputMode
      : "image_only";

  const brandVoiceKeywords = useMemo(
    () =>
      brandVoiceInput
        .split(/[,|/\\n]+/g)
        .map((x) => x.trim())
        .filter(Boolean),
    [brandVoiceInput],
  );

  const activeStylePreset = useMemo(
    () =>
      pickStylePreset({
        preferred: stylePreset,
        keywords: styleKeywords,
      }),
    [stylePreset, styleKeywords],
  );

  const noRefStyleGuide = useMemo(
    () => buildNoReferenceStyleGuide({ preset: activeStylePreset, palette: logoPalette }),
    [activeStylePreset, logoPalette],
  );

  const briefDoctor = useMemo(
    () =>
      runBriefDoctor({
        objective: briefObjective,
        audience: briefAudience,
        usp: briefUsp,
        offer: briefOffer,
        proof: briefProof,
        cta,
        brandVoiceKeywords,
      }),
    [briefObjective, briefAudience, briefUsp, briefOffer, briefProof, cta, brandVoiceKeywords],
  );

  const runCopyGenerator = () => {
    const variants = generateCopyVariants({
      aspectRatio,
      objective: briefObjective,
      audience: briefAudience,
      usp: briefUsp,
      offer: briefOffer,
      proof: briefProof,
      preferredCta: cta,
      brandVoiceKeywords,
    });
    setCopySuggestions(variants);
  };

  const applySuggestedCopy = (next: { headline?: string; subText?: string; cta?: string }) => {
    if (copyLocked) return;
    if (typeof next.headline === "string") setHeadline(next.headline);
    if (typeof next.subText === "string") setSubText(next.subText);
    if (typeof next.cta === "string") setCta(next.cta);
  };

  const getVisualGuideForRef = (ref: RefItem | null): string => {
    const effectiveMode: RenderMode =
      effectiveOutputMode === "image_only" ? "background_only" : renderMode;
    const outputModeForModel: OutputMode =
      effectiveMode === "background_only" ? "image_only" : effectiveOutputMode;
    const hasRefFile = Boolean(ref?.file);
    const reserveHero =
      effectiveMode === "background_only" &&
      ((heroMode === "product" && Boolean(productImage)) ||
        (heroMode === "app_phone" && appScreenshots.length > 0));
    const reserveLogo =
      effectiveMode === "background_only" &&
      Boolean(brandLogo || logoHorizontal || logoStacked);
    return buildVisualGuideFromAnalysis({
      analysis: workflowMode === "benchmark" ? ref?.analysis ?? null : null,
      styleGuideBase: hasRefFile ? undefined : noRefStyleGuide,
      hasProduct: Boolean(productImage),
      reserveHero,
      reserveLogo,
      outputMode: outputModeForModel,
      headline: headline.trim(),
      subText: subText.trim(),
      cta: cta.trim(),
      extra: extraRequest.trim(),
    });
  };

  const computedVisualGuide = useMemo(
    () => getVisualGuideForRef(activeRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeRef,
      workflowMode,
      productImage,
      heroMode,
      appScreenshots.length,
      brandLogo,
      logoHorizontal,
      logoStacked,
      channelProfile,
      effectiveOutputMode,
      renderMode,
      headline,
      subText,
      cta,
      extraRequest,
    ],
  );

  useEffect(() => {
    if (promptMode !== "auto") return;
    if (workflowMode === "benchmark" && activeRef?.file && !activeRef?.analysis) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: effectiveOutputMode === "image_only" ? "background_only" : renderMode,
              aspectRatio,
              visualGuide: computedVisualGuide,
              headline: headline.trim(),
              subText: subText.trim(),
              ctaText: cta.trim(),
              badgeText: badgeText.trim(),
              legalText: legalText.trim(),
              layoutJson: currentLayout,
            }),
          });
          const json = await response.json().catch(() => ({}));
          if (cancelled) return;
          if (!response.ok) {
            return;
          }
          if (typeof json?.prompt === "string") {
            setPromptOverride(json.prompt);
          }
        } catch {
          // ignore
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    promptMode,
    workflowMode,
    activeRef?.analysis,
    activeRef?.file,
    renderMode,
    aspectRatio,
    computedVisualGuide,
    headline,
    subText,
    cta,
    badgeText,
    legalText,
    currentLayout,
  ]);

  useEffect(() => {
    return () => {
      for (const item of refItems) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;

    setRefItems((prev) => {
      const remaining = Math.max(MAX_REFS - prev.length, 0);
      const next = clampMax(images, remaining).map((file, index) => ({
        id: makeId(file, index),
        file,
        previewUrl: URL.createObjectURL(file),
        selectedForGenerate: true,
        analyzed: false,
        analyzing: false,
        error: null,
        analysis: null,
      }));
      const merged = [...next, ...prev];
      const nextActive = merged[0]?.id ?? "";
      setActiveRefId((current) => current || nextActive);
      if (merged.length > MAX_REFS) {
        return merged.slice(0, MAX_REFS);
      }
      return merged;
    });
  };

  const removeRef = (id: string) => {
    setRefItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((item) => item.id !== id);
      if (activeRefId === id) {
        setActiveRefId(next[0]?.id ?? "");
      }
      return next;
    });
  };

  const analyzeAll = async () => {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress({ done: 0, total: refItems.length });

    try {
      for (let i = 0; i < refItems.length; i += 1) {
        const item = refItems[i];
        setRefItems((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, analyzing: true, error: null } : x,
          ),
        );

        const formData = new FormData();
        formData.append("referenceImage", item.file);
        formData.append("imageRatio", aspectRatio);
        formData.append("width", String(width));
        formData.append("height", String(height));

        // eslint-disable-next-line no-await-in-loop
        const response = await fetch("/api/analyze", { method: "POST", body: formData });
        // eslint-disable-next-line no-await-in-loop
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "분석 실패");
        }

        const analysis = payload?.analysis as BenchmarkAnalysis;
        setRefItems((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? { ...x, analyzing: false, analyzed: true, analysis }
              : x,
          ),
        );
        setAnalysisProgress({ done: i + 1, total: refItems.length });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "분석 실패";
      setAnalysisError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const overlayCacheRef = useRef<Map<string, string>>(new Map());

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    const file = brandLogo ?? logoHorizontal ?? logoStacked;
    if (!file) {
      setLogoPalette([]);
      return;
    }

    let cancelled = false;
    setPaletteLoading(true);
    void (async () => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const colors = await extractDominantColorsFromDataUrl(dataUrl, { k: 3, sampleSizePx: 96 });
        if (!cancelled) setLogoPalette(colors);
      } catch {
        if (!cancelled) setLogoPalette([]);
      } finally {
        if (!cancelled) setPaletteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLogo, logoHorizontal, logoStacked]);

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRdaAssets = () => {
    downloadJson(
      {
        channelProfile: "google_rda",
        aspectRatio,
        copy: {
          headline: headline.trim(),
          subText: subText.trim(),
          cta: cta.trim(),
          badgeText: badgeText.trim(),
          legalText: legalText.trim(),
        },
        note:
          "Google RDA upload tip: use the image as-is (no overlaid text/logo/button). Provide text assets separately in the ad builder.",
      },
      `mkdoc-rda-assets-${Date.now()}.json`,
    );
  };

  const ensureGuideOverlayDataUrl = async (layout: LayoutJson): Promise<string> => {
    const key = JSON.stringify(layout);
    const cached = overlayCacheRef.current.get(key);
    if (cached) return cached;

    const response = await fetch("/api/overlay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout, showSafeZone: true }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json?.error || "오버레이 생성 실패");
    }
    const dataUrl = String(json?.dataUrl || "");
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("오버레이 이미지 데이터가 비어있습니다.");
    }
    overlayCacheRef.current.set(key, dataUrl);
    return dataUrl;
  };

  const pickLogoFile = (layout: LayoutJson): File | null => {
    const hasAny = Boolean(brandLogo || logoHorizontal || logoStacked);
    if (!hasAny) return null;

    const box = layout.logo.box;
    const boxAspect =
      (box[2] * layout.canvas.width) / Math.max(1, box[3] * layout.canvas.height);

    // Heuristic: wide box prefers horizontal, tall box prefers stacked.
    if (boxAspect >= 1.2) {
      return logoHorizontal ?? brandLogo ?? logoStacked ?? null;
    }
    return logoStacked ?? brandLogo ?? logoHorizontal ?? null;
  };

  const generateForRef = async (
    ref: RefItem | null,
    mode: "single" | "batch",
  ): Promise<RenderItem[]> => {
    const count = Math.min(Math.max(renderCount, 1), 4);
    const results: RenderItem[] = [];

    const overlayDataUrl = await ensureGuideOverlayDataUrl(currentLayout);
    const referenceDataUrl = ref?.file ? await fileToDataUrl(ref.file) : undefined;
    const productDataUrl = productImage ? await fileToDataUrl(productImage) : undefined;
    const screenshotDataUrl =
      appScreenshots[0] ? await fileToDataUrl(appScreenshots[0]) : undefined;
    const logoFile = pickLogoFile(currentLayout);
    const logoDataUrl = logoFile ? await fileToDataUrl(logoFile) : undefined;

    const visualGuide = getVisualGuideForRef(ref);
    const effectiveMode: RenderMode =
      effectiveOutputMode === "image_only" ? "background_only" : renderMode;

    const overlayHeroProduct =
      effectiveMode === "background_only" && heroMode === "product" && Boolean(productDataUrl);
    const overlayHeroApp =
      effectiveMode === "background_only" && heroMode === "app_phone" && Boolean(screenshotDataUrl);
    const overlayLogo = effectiveMode === "background_only" && Boolean(logoDataUrl) && !isGoogleRda;

    const sendProductToModel =
      effectiveMode === "full_creative"
        ? Boolean(productDataUrl)
        : heroMode === "none" && Boolean(productDataUrl);

    const requestBase = {
      model: nanoModel,
      imageSize: nanoModel === "gemini-3-pro-image-preview" ? imageSize : undefined,
      aspectRatio,
      mode: effectiveMode,
      qualityLoop: qualityLoop && effectiveMode === "background_only" ? true : undefined,
      prompt:
        mode === "single" && promptMode === "manual" && promptOverride.trim()
          ? promptOverride.trim()
          : undefined,
      visualGuide,
      headline: headline.trim(),
      subText: subText.trim(),
      ctaText: cta.trim(),
      badgeText: badgeText.trim(),
      legalText: legalText.trim(),
      layoutJson: currentLayout,
      referenceImageBase64: referenceDataUrl,
      productImageBase64: sendProductToModel ? productDataUrl : undefined,
      guideOverlayBase64: overlayDataUrl,
    };

    for (let i = 0; i < count; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBase),
      });
      // eslint-disable-next-line no-await-in-loop
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "생성 실패");
      }

      const dataUrl = String(payload?.dataUrl || "");
      if (!dataUrl.startsWith("data:image/")) {
        throw new Error("이미지 데이터가 비어있습니다.");
      }

      let finalUrl = dataUrl;
      const shouldCompose =
        effectiveMode === "background_only" &&
        (effectiveOutputMode === "image_with_text" ||
          overlayHeroProduct ||
          overlayHeroApp ||
          overlayLogo ||
          (badgeText.trim() && Boolean(currentLayout.badge)) ||
          (legalText.trim() && Boolean(currentLayout.legal)));

      if (shouldCompose) {
        // eslint-disable-next-line no-await-in-loop
        finalUrl = await composeDeterministicCreative({
          backgroundDataUrl: dataUrl,
          layout: currentLayout,
          headline: effectiveOutputMode === "image_only" ? "" : headline.trim(),
          subText: effectiveOutputMode === "image_only" ? "" : subText.trim(),
          ctaText: effectiveOutputMode === "image_only" ? "" : cta.trim(),
          badgeText: effectiveOutputMode === "image_only" ? "" : badgeText.trim(),
          legalText: effectiveOutputMode === "image_only" ? "" : legalText.trim(),
          heroImageDataUrl: overlayHeroProduct ? productDataUrl : undefined,
          appScreenshotDataUrl: overlayHeroApp ? screenshotDataUrl : undefined,
          deviceMockup: overlayHeroApp ? "phone" : "none",
          logoImageDataUrl: overlayLogo ? logoDataUrl : undefined,
          options: { autoReadabilityPanel: true },
        });
      }

      results.push({
        id: `${Date.now()}-${ref?.id || "no-ref"}-${i}`,
        refId: ref?.id || "no-ref",
        refName: ref?.file?.name || "NO_REFERENCE",
        createdAt: Date.now(),
        dataUrl: finalUrl,
        model: typeof payload?.model === "string" ? payload.model : null,
      });
    }

    return results;
  };

  const generateImages = async () => {
    if (generating) return;
    if (workflowMode === "benchmark" && (!activeRef?.file || !activeRef.analysis)) {
      setGenerateError("분석 후 생성 모드에서는 먼저 레퍼런스 분석을 완료해 주세요.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setRenders([]);
    setBatchProgress({ done: 0, total: 0 });

    try {
      const results = await generateForRef(activeRef, "single");
      setRenders(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : "생성 실패";
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  };

  const generateBatch = async () => {
    if (generating) return;
    const targets = refItems.filter((item) => item.selectedForGenerate);
    if (targets.length === 0) {
      setGenerateError("일괄 생성할 레퍼런스를 선택해 주세요.");
      return;
    }
    if (workflowMode === "benchmark" && targets.some((t) => !t.analysis)) {
      setGenerateError("분석 후 생성 모드에서는 분석 완료된 레퍼런스만 생성할 수 있습니다.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setRenders([]);
    const total = targets.length * Math.min(Math.max(renderCount, 1), 4);
    setBatchProgress({ done: 0, total });

    try {
      const all: RenderItem[] = [];
      let done = 0;
      for (const ref of targets) {
        // eslint-disable-next-line no-await-in-loop
        const refResults = await generateForRef(ref, "batch");
        all.push(...refResults);
        done += refResults.length;
        setBatchProgress({ done, total });
        setRenders([...all]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "일괄 생성 실패";
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  };

  const requestGenerate = (kind: "single" | "batch") => {
    if (!isLayoutReady) {
      setLayoutModalOpen(true);
      setPendingGenerate({ kind });
      return;
    }
    if (kind === "single") {
      void generateImages();
    } else {
      void generateBatch();
    }
  };

  useEffect(() => {
    if (!pendingGenerate) return;
    if (!isLayoutReady) return;

    const kind = pendingGenerate.kind;
    setPendingGenerate(null);

    if (kind === "single") {
      void generateImages();
    } else {
      void generateBatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGenerate, isLayoutReady]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <GuidedTour
        open={tourOpen}
        steps={tutorialSteps}
        onClose={() => setTourOpen(false)}
        onComplete={() => {
          const userKey = sessionUserId ?? "anon";
          try {
            window.localStorage.setItem(`mkdoc:tutorial:creative:done:${userKey}`, "1");
          } catch {
            // ignore
          }
          setTourBanner(false);
        }}
      />
      <ImageModal
        open={Boolean(modalItem)}
        item={modalItem}
        onClose={() => setModalItem(null)}
      />
      <LayoutEditorModal
        open={layoutModalOpen}
        aspectRatio={aspectRatio}
        layout={currentLayout}
        headline={headline}
        subText={subText}
        ctaText={cta}
        badgeText={badgeText}
        legalText={legalText}
        onClose={() => {
          setLayoutModalOpen(false);
          setPendingGenerate(null);
        }}
        onApply={(layout) => {
          setLayoutByRatio((prev) => ({ ...prev, [aspectRatio]: layout }));
          setLayoutReadyByRatio((prev) => ({ ...prev, [aspectRatio]: true }));
          setLayoutModalOpen(false);
        }}
      />
      <div className="grid gap-5 lg:grid-cols-[420px,1fr]">
        {/* Left: Input panel */}
        <aside className="rounded-3xl border border-white/60 bg-white/80 shadow-[0_24px_90px_-55px_rgba(2,6,23,0.62)] backdrop-blur">
          <div className="flex flex-col lg:h-[calc(100vh-3rem)]">
            <div className="border-b border-slate-200/70 p-5">
              <MkdocLogo />
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
                New Creative
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                새 광고 소재 만들기
              </h1>
              <div
                className="mt-3 inline-flex w-full rounded-2xl bg-slate-100 p-1"
                data-tour="creative-workflow"
              >
                <button
                  type="button"
                  onClick={() => setWorkflowMode("benchmark")}
                  className={[
                    "w-1/2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                    workflowMode === "benchmark"
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  분석 후 생성
                </button>
                <button
                  type="button"
                  onClick={() => setWorkflowMode("direct")}
                  className={[
                    "w-1/2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                    workflowMode === "direct"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  바로 이미지 생성
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => setTourOpen(true)}
                  disabled={!tourEligible}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  튜토리얼
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/history"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    히스토리
                  </Link>
                  <Link
                    href="/keyword-search"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    키워드 서치
                  </Link>
                  <Link
                    href="/diagnosis"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    진단
                  </Link>
                  <Link
                    href="/admin"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    관리자
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {tourBanner ? (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                  <p className="font-semibold">처음이신가요?</p>
                  <p className="mt-1 text-xs text-cyan-800">
                    1분 튜토리얼로 레퍼런스 분석 → 생성 → 다운로드까지 한 번에 안내해 드릴게요.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTourOpen(true)}
                    className="mt-3 inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    튜토리얼 시작
                  </button>
                </div>
              ) : null}

              {/* Section 1: Reference upload */}
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">레퍼런스 업로드</p>
                  <p className="mt-1 text-xs text-slate-600">
                    벤치마킹할 성공 광고 레퍼런스를 업로드하세요 (최대 {MAX_REFS}장)
                  </p>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  data-tour="creative-ref-upload"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                    addFiles(Array.from(event.dataTransfer.files ?? []));
                  }}
                  className={[
                    "rounded-2xl border border-dashed bg-white px-4 py-5 text-left transition",
                    dragActive
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-slate-300 hover:border-slate-400",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold text-slate-800">
                    Drag & Drop 또는 클릭해서 업로드
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    JPG/PNG/WEBP 지원 · 여러 장 선택 가능
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
                  />
                </div>

                {refItems.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    {refItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveRefId(item.id)}
                        className={[
                          "group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white",
                          item.id === activeRefId
                            ? "border-emerald-400 ring-2 ring-emerald-200"
                            : "border-slate-200",
                        ].join(" ")}
                        title={item.file.name}
                      >
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {item.analysis ? "OK" : item.analyzing ? "..." : "NEW"}
                        </span>
                        <span
                          className="absolute right-1 top-1 hidden rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 group-hover:block"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRef(item.id);
                          }}
                        >
                          삭제
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Section 2: Product + copy */}
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">내 제품 정보</p>
                  <p className="mt-1 text-xs text-slate-600">
                    제품 이미지(선택)와 카피를 입력하세요. 비우면 이미지 전용 생성으로 처리합니다.
                  </p>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Product Image (optional)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    onChange={(event) => setProductImage(event.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Hero Box (결정론 오버레이)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setHeroMode("none")}
                      className={[
                        "rounded-xl px-3 py-2 text-xs font-semibold transition",
                        heroMode === "none"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      없음
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroMode("product")}
                      disabled={!productImage}
                      className={[
                        "rounded-xl px-3 py-2 text-xs font-semibold transition",
                        heroMode === "product"
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        !productImage ? "cursor-not-allowed opacity-50" : "",
                      ].join(" ")}
                    >
                      제품
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroMode("app_phone")}
                      disabled={appScreenshots.length === 0}
                      className={[
                        "rounded-xl px-3 py-2 text-xs font-semibold transition",
                        heroMode === "app_phone"
                          ? "bg-cyan-700 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        appScreenshots.length === 0 ? "cursor-not-allowed opacity-50" : "",
                      ].join(" ")}
                    >
                      앱(폰)
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mode B(배경 생성)에서 HERO_BOX는 비워두고, 선택한 자산을 캔버스에서
                    결정론적으로 합성합니다.
                  </p>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    App Screenshots (optional, max 5)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    onChange={(event) =>
                      setAppScreenshots(Array.from(event.target.files ?? []).slice(0, 5))
                    }
                  />
                  {appScreenshots.length > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      업로드됨: {appScreenshots.length}장 (Hero는 첫 번째 스샷 사용)
                    </p>
                  ) : null}
                </label>

                <details className="rounded-2xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Brand Logo (optional)
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Primary
                      </span>
                      <input
                        type="file"
                        accept="image/*,.svg"
                        className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        onChange={(event) => setBrandLogo(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Horizontal
                        </span>
                        <input
                          type="file"
                          accept="image/*,.svg"
                          className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                          onChange={(event) => setLogoHorizontal(event.target.files?.[0] ?? null)}
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Stacked
                        </span>
                        <input
                          type="file"
                          accept="image/*,.svg"
                          className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                          onChange={(event) => setLogoStacked(event.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Mode B에서는 LOGO_BOX에 로고를 결정론적으로 합성합니다.
                    </p>
                  </div>
                </details>

                <div className="grid gap-3" data-tour="creative-copy-inputs">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Head Copy
                    </span>
                    <input
                      value={headline}
                      onChange={(event) => setHeadline(event.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder='예: "여름 한정 특가"'
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Sub Copy
                    </span>
                    <input
                      value={subText}
                      onChange={(event) => setSubText(event.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder='예: "지금 구매 시 50% 할인"'
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      CTA Button
                    </span>
                    <input
                      value={cta}
                      onChange={(event) => setCta(event.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder='예: "구매하기"'
                    />
                  </label>
                  <details className="rounded-2xl border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Brief Doctor (카피 점검/추천)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">완성도 점수</span>
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            briefDoctor.score >= 85
                              ? "bg-emerald-50 text-emerald-700"
                              : briefDoctor.score >= 70
                                ? "bg-amber-50 text-amber-800"
                                : "bg-rose-50 text-rose-700",
                          ].join(" ")}
                        >
                          {briefDoctor.score}/100
                        </span>
                      </div>

                      <div className="grid gap-3">
                        <label className="block space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            Objective (필수)
                          </span>
                          <input
                            value={briefObjective}
                            onChange={(e) => setBriefObjective(e.target.value)}
                            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                            placeholder='예: "첫 구매 전환", "무료 상담 신청", "앱 설치"'
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            Audience (필수)
                          </span>
                          <input
                            value={briefAudience}
                            onChange={(e) => setBriefAudience(e.target.value)}
                            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                            placeholder='예: "퇴근 후 한끼 해결하려는 직장인"'
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            USP (필수)
                          </span>
                          <input
                            value={briefUsp}
                            onChange={(e) => setBriefUsp(e.target.value)}
                            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                            placeholder='예: "단 7일, 피부 결이 달라짐"'
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              Offer (선택)
                            </span>
                            <input
                              value={briefOffer}
                              onChange={(e) => setBriefOffer(e.target.value)}
                              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                              placeholder='예: "첫 구매 10% 할인"'
                            />
                          </label>
                          <label className="block space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              Proof (선택)
                            </span>
                            <input
                              value={briefProof}
                              onChange={(e) => setBriefProof(e.target.value)}
                              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                              placeholder='예: "평점 4.9 (2,312명)"'
                            />
                          </label>
                        </div>
                        <label className="block space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            Brand Voice Keywords (선택)
                          </span>
                          <input
                            value={brandVoiceInput}
                            onChange={(e) => setBrandVoiceInput(e.target.value)}
                            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                            placeholder='예: "프리미엄, 미니멀, 직설"'
                          />
                        </label>
                      </div>

                      {briefDoctor.warnings.length > 0 ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                          <p className="font-semibold">주의</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {briefDoctor.warnings.slice(0, 5).map((w) => (
                              <li key={w}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                          Brief가 충분히 구체적입니다. 카피 생성에 최적화된 상태예요.
                        </div>
                      )}

                      {briefDoctor.questionsToAsk.length > 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                          <p className="font-semibold text-slate-900">추가 질문(선택)</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {briefDoctor.questionsToAsk.slice(0, 4).map((q) => (
                              <li key={q}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={runCopyGenerator}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          카피 추천 생성
                        </button>
                        <label className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={copyLocked}
                            onChange={(e) => setCopyLocked(e.target.checked)}
                          />
                          카피 잠금
                        </label>
                      </div>

                      {copySuggestions ? (
                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              Headlines
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {copySuggestions.headlines.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => applySuggestedCopy({ headline: t })}
                                  disabled={copyLocked}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              Sub Text
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {copySuggestions.subs.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => applySuggestedCopy({ subText: t })}
                                  disabled={copyLocked}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              CTA
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {copySuggestions.ctas.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => applySuggestedCopy({ cta: t })}
                                  disabled={copyLocked}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                  <details className="rounded-2xl border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Optional Copy (Badge / Legal)
                    </summary>
                    <div className="mt-3 grid gap-3">
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Badge Text
                        </span>
                        <input
                          value={badgeText}
                          onChange={(event) => setBadgeText(event.target.value)}
                          className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                          placeholder='예: "NEW", "50% OFF", "무료배송"'
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Legal Text
                        </span>
                        <input
                          value={legalText}
                          onChange={(event) => setLegalText(event.target.value)}
                          className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                          placeholder='예: "일부 옵션은 추가 비용이 발생할 수 있습니다"'
                        />
                      </label>
                      <p className="text-[11px] text-slate-500">
                        레이아웃 편집(팝업)에서 Badge/Legal 박스를 켜면 오버레이에 반영됩니다.
                      </p>
                    </div>
                  </details>
                </div>
              </section>

              {/* Section 3: Generation setup */}
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">생성 설정</p>
                  <p className="mt-1 text-xs text-slate-600">
                    기본은 <strong>배경만 생성 + 텍스트는 결정론 오버레이</strong> 입니다.
                  </p>
                </div>

                <div className="grid gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      채널 프로필
                    </span>
                    <select
                      value={channelProfile}
                      onChange={(event) => setChannelProfile(event.target.value as ChannelProfile)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                    >
                      <option value="social_standard">Social Standard (오버레이)</option>
                      <option value="story_reels">Story/Reels (세이프존 크게)</option>
                      <option value="google_rda">Google RDA (이미지-only)</option>
                    </select>
                    {isGoogleRda ? (
                      <p className="text-[11px] text-slate-500">
                        RDA 모드에서는 이미지에 텍스트/로고/버튼을 오버레이하지 않습니다. 대신 카피는
                        별도 에셋(JSON)로 내보낼 수 있습니다.
                      </p>
                    ) : null}
                  </label>

                  <details className="rounded-2xl border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-700">
                      No-Reference Style Engine
                    </summary>
                    <div className="mt-3 grid gap-3">
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Style Preset
                        </span>
                        <select
                          value={stylePreset}
                          onChange={(e) =>
                            setStylePreset((e.target.value as StylePresetId | "auto") ?? "auto")
                          }
                          className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                        >
                          <option value="auto">Auto</option>
                          {STYLE_PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Preference Keywords (optional)
                        </span>
                        <input
                          value={styleKeywords}
                          onChange={(e) => setStyleKeywords(e.target.value)}
                          className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                          placeholder='예: "미니멀, 고급, 톤다운"'
                        />
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            Logo Palette (auto)
                          </p>
                          {paletteLoading ? (
                            <span className="text-[11px] font-semibold text-slate-500">
                              추출 중...
                            </span>
                          ) : null}
                        </div>
                        {logoPalette.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {logoPalette.map((hex) => (
                              <span
                                key={hex}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                              >
                                <span
                                  className="h-3 w-3 rounded-full border border-slate-200"
                                  style={{ background: hex }}
                                />
                                {hex}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] text-slate-500">
                            로고를 업로드하면 대표 색상을 자동 추출해 스타일에 반영합니다.
                          </p>
                        )}
                      </div>
                    </div>
                  </details>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      사이즈 프리셋
                    </span>
                    <select
                      value={aspectRatio}
                      onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                    >
                      <option value="1:1">1:1 (1080x1080)</option>
                      <option value="4:5">4:5 (1080x1350)</option>
                      <option value="9:16">9:16 (1080x1920)</option>
                    </select>
                  </label>

                  <div className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      렌더 모드
                    </p>
                    <div className="inline-flex w-full rounded-2xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setRenderMode("background_only")}
                        className={[
                          "w-1/2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                          renderMode === "background_only"
                            ? "bg-slate-900 text-white"
                            : "text-slate-600 hover:text-slate-900",
                        ].join(" ")}
                      >
                        Mode B (배경+오버레이)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenderMode("full_creative")}
                        className={[
                          "w-1/2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                          renderMode === "full_creative"
                            ? "bg-emerald-600 text-white"
                            : "text-slate-600 hover:text-slate-900",
                        ].join(" ")}
                      >
                        Mode A (텍스트 포함)
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Mode A는 빠른 시안용입니다(모델 특성상 텍스트가 튈 수 있음).
                    </p>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      모델 선택
                    </span>
                    <select
                      value={nanoModel}
                      onChange={(event) => setNanoModel(event.target.value as NanoModel)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                    >
                      <option value="gemini-2.5-flash-image">빠름: gemini-2.5-flash-image</option>
                      <option value="gemini-3-pro-image-preview">
                        고퀄: gemini-3-pro-image-preview
                      </option>
                      <option value="gemini-2.0-flash-exp-image-generation">
                        호환: gemini-2.0-flash-exp-image-generation
                      </option>
                    </select>
                  </label>

                  {nanoModel === "gemini-3-pro-image-preview" ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Pro 이미지 크기
                      </span>
                      <select
                        value={imageSize}
                        onChange={(event) => setImageSize(event.target.value as ImageSize)}
                        className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                    </label>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={qualityLoop}
                        onChange={(e) => setQualityLoop(e.target.checked)}
                      />
                      Quality Loop (3 candidates)
                    </label>
                    <p className="mt-1 text-[11px] text-slate-500">
                      빠른 모델로 3장 생성 후 “가이드 영역이 가장 깨끗한” 배경을 골라 최종 1장을
                      선택합니다. (시간/비용 증가)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <span className="text-xs font-semibold text-slate-700">
                      레이아웃:
                    </span>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        isLayoutReady
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-800",
                      ].join(" ")}
                    >
                      {isLayoutReady ? "설정됨" : "미설정"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLayoutModalOpen(true)}
                      data-tour="creative-layout"
                      className="ml-auto rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      레이아웃 편집(팝업)
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Sticky action */}
            <div
              className="sticky bottom-0 border-t border-slate-200/70 bg-white/85 p-4 backdrop-blur"
              data-tour="creative-primary-action"
            >
              {analysisError && (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {analysisError}
                </div>
              )}
              {workflowMode === "benchmark" ? (
                <button
                  type="button"
                  onClick={() => void analyzeAll()}
                  disabled={!canAnalyze}
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#0ea5e9_0%,#22c55e_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_-25px_rgba(14,165,233,0.55)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {analyzing
                    ? `분석 중... (${analysisProgress.done}/${analysisProgress.total})`
                    : "✨ AI 레퍼런스 분석 및 구조 해킹하기"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => requestGenerate("single")}
                  disabled={generating}
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#111827_0%,#0ea5e9_55%,#22c55e_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_55px_-35px_rgba(34,197,94,0.55)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? "생성 중..." : "🚀 바로 이미지 생성"}
                </button>
              )}
              <p className="mt-2 text-center text-[11px] text-slate-500">
                좌측 입력은 최소화, 우측에서 결과를 수정하고 생성합니다.
              </p>
            </div>
          </div>
        </aside>

        {/* Right: Bento workspace */}
        <section className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <BentoCard
              title="레퍼런스 분석 요약"
              subtitle="AI가 잡아낸 구도/심리 트리거를 태그로 시각화합니다."
              dataTour="creative-summary"
              actions={
                workflowMode === "direct" ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    분석 생략
                  </span>
                ) : activeRef?.analysis ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    분석 완료
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    대기
                  </span>
                )
              }
            >
              {workflowMode === "direct" ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    “바로 이미지 생성” 모드에서는 레퍼런스 분석을 생략합니다. 필요하면
                    “분석 후 생성”으로 전환하세요.
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">팁</p>
                    <p className="mt-1">
                      레퍼런스 이미지는 그대로 스타일 가이드로 사용되며, 프롬프트 에디터에서
                      원하는 단어를 추가할 수 있습니다.
                    </p>
                  </div>
                </div>
              ) : !activeRef?.analysis ? (
                <SkeletonCard />
              ) : (
                <div className="space-y-3">
                  {activeTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      태그를 만들 데이터가 부족합니다. 다른 레퍼런스를 선택하거나 다시 분석해 보세요.
                    </p>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">핵심 의도</p>
                    <p className="mt-1">
                      {activeRef.analysis.decoding.layout_intent || "-"}
                    </p>
                  </div>
                </div>
              )}
            </BentoCard>

            <BentoCard
              title="🪄 매직 프롬프트 에디터"
              subtitle="최종 이미지 생성용 프롬프트를 수정 가능한 형태로 제공합니다."
              dataTour="creative-prompt"
              actions={
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPromptMode("auto")}
                    className={[
                      "rounded-lg px-2.5 py-1 transition",
                      promptMode === "auto"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900",
                    ].join(" ")}
                  >
                    자동
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptMode("manual")}
                    className={[
                      "rounded-lg px-2.5 py-1 transition",
                      promptMode === "manual"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900",
                    ].join(" ")}
                  >
                    수동
                  </button>
                </div>
              }
            >
              {workflowMode === "benchmark" && !activeRef?.file ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                  좌측에서 레퍼런스 이미지를 업로드하면 프롬프트 에디터가 활성화됩니다.
                </div>
              ) : workflowMode === "benchmark" && !activeRef?.analysis ? (
                <SkeletonCard />
              ) : (
                <div className="space-y-3">
                  {promptMode === "manual" && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                      수동 프롬프트는 현재 선택된 레퍼런스에만 적용됩니다. (일괄 생성은 자동 프롬프트 사용)
                    </div>
                  )}
                  <textarea
                    value={promptOverride}
                    onChange={(event) => {
                      setPromptMode("manual");
                      setPromptOverride(event.target.value);
                    }}
                    rows={10}
                    className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  />
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      원하는 분위기 추가 (선택)
                    </span>
                    <input
                      value={extraRequest}
                      onChange={(event) => setExtraRequest(event.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="예: 더 고급스럽게, 더 미니멀하게, 조명 더 극적으로"
                    />
                  </label>
                </div>
              )}
            </BentoCard>
          </div>

          <BentoCard
            title="갤러리 및 최종 렌더링"
            subtitle="1~4장 생성 후 썸네일에서 바로 다운로드할 수 있습니다."
            className="min-h-[420px]"
            dataTour="creative-gallery"
            actions={
              <div className="flex items-center gap-2">
                {isGoogleRda ? (
                  <>
                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                      RDA: 이미지-only
                    </span>
                    <button
                      type="button"
                      onClick={downloadRdaAssets}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      텍스트 에셋 JSON
                    </button>
                  </>
                ) : (
                  <select
                    value={effectiveOutputMode}
                    onChange={(event) =>
                      setOutputMode(
                        event.target.value === "image_only"
                          ? "image_only"
                          : "image_with_text",
                      )
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="image_with_text">텍스트 포함</option>
                    <option value="image_only">이미지 전용</option>
                  </select>
                )}
                <select
                  value={renderCount}
                  onChange={(event) => setRenderCount(Number(event.target.value) || 2)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value={1}>1장</option>
                  <option value={2}>2장</option>
                  <option value={3}>3장</option>
                  <option value={4}>4장</option>
                </select>
              </div>
            }
          >
            {workflowMode === "benchmark" && !activeRef?.analysis ? (
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="lg:col-span-4">
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                    좌측에서 레퍼런스를 업로드한 뒤{" "}
                    <strong>“AI 레퍼런스 분석”</strong>을 눌러주세요. 분석 전에는 이 영역이
                    비어있습니다.
                  </div>
                </div>
              </div>
            ) : workflowMode === "benchmark" && !activeRef?.file ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                좌측에서 레퍼런스 이미지를 업로드하세요.
              </div>
            ) : (
              <div className="space-y-4">
                {generateError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                    {generateError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => requestGenerate("single")}
                    disabled={!canGenerate}
                    className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#111827_0%,#0ea5e9_55%,#22c55e_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_70px_-45px_rgba(34,197,94,0.45)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generating
                      ? "생성 중..."
                      : activeRef?.file
                        ? "🚀 현재 레퍼런스로 생성"
                        : "🚀 레퍼런스 없이 생성"}
                  </button>

                  <button
                    type="button"
                    onClick={() => requestGenerate("batch")}
                    disabled={generating || selectedRefCount === 0}
                    className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    선택 레퍼런스 일괄 생성 ({selectedRefCount})
                  </button>

                  {generating && batchProgress.total > 0 && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      진행 {batchProgress.done}/{batchProgress.total}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">생성 대상:</span>
                  {refItems.map((item) => (
                    <button
                      key={`sel-${item.id}`}
                      type="button"
                      onClick={() =>
                        setRefItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id
                              ? { ...x, selectedForGenerate: !x.selectedForGenerate }
                              : x,
                          ),
                        )
                      }
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1",
                        item.selectedForGenerate
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      ].join(" ")}
                      title={item.file.name}
                    >
                      <span
                        className={[
                          "h-2 w-2 rounded-full",
                          item.selectedForGenerate ? "bg-emerald-500" : "bg-slate-300",
                        ].join(" ")}
                      />
                      {item.file.name.length > 18
                        ? `${item.file.name.slice(0, 18)}…`
                        : item.file.name}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {generating && renders.length === 0
                    ? Array.from({ length: Math.min(renderCount, 4) }).map((_, idx) => (
                        <div
                          key={`sk-${idx}`}
                          className="aspect-square animate-pulse rounded-3xl border border-slate-200 bg-slate-100"
                        />
                      ))
                    : renders.map((item) => (
                        <div
                          key={item.id}
                          className="group relative aspect-square overflow-hidden rounded-3xl border border-slate-200 bg-white"
                        >
                          <button
                            type="button"
                            className="h-full w-full"
                            onClick={() => setModalItem(item)}
                            aria-label="이미지 확대 보기"
                          >
                            <img
                              src={item.dataUrl}
                              alt="Generated"
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(2,6,23,0.65),transparent_55%)] opacity-0 transition group-hover:opacity-100" />
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 opacity-0 transition group-hover:opacity-100">
                            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-800">
                              {item.model || "gemini"}
                            </span>
                            <a
                              href={item.dataUrl}
                              download={`mkdoc-${item.createdAt}.png`}
                              className="inline-flex items-center justify-center rounded-full bg-white p-2 text-slate-900 shadow-sm"
                              aria-label="고화질 다운로드"
                            >
                              <IconDownload />
                            </a>
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            )}
          </BentoCard>
        </section>
      </div>
    </div>
  );
}
