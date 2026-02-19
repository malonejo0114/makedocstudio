"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Stage, Layer, Rect, Line, Text, Group, Transformer } from "react-konva";
import Konva from "konva";

import type {
  AspectRatio,
  BoxPx,
  LayoutCta,
  LayoutJson,
  LayoutMedia,
  LayoutText,
  TextAlign,
} from "@/lib/layoutSchema";
import { createDefaultLayout } from "@/lib/layoutSchema";
import { autofitTextToBox } from "@/lib/textAutofit";

type BoxId = "hero" | "logo" | "headline" | "subtext" | "cta" | "badge" | "legal";

type UiBox = BoxPx & { id: BoxId };

type Props = {
  open: boolean;
  aspectRatio: AspectRatio;
  layout: LayoutJson | null;
  headline: string;
  subText: string;
  ctaText: string;
  badgeText?: string;
  legalText?: string;
  onClose: () => void;
  onApply: (layout: LayoutJson) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function roundToGrid(value: number, grid: number) {
  if (grid <= 1) return value;
  return Math.round(value / grid) * grid;
}

function computeWorkspaceSize(aspectRatio: AspectRatio) {
  const ratio = aspectRatio === "1:1" ? 1 : aspectRatio === "4:5" ? 1.25 : 16 / 9;
  const maxW = 640;
  const maxH = 640;

  // Start from wide.
  let w = 600;
  let h = Math.round(w * ratio);
  if (h > maxH) {
    h = maxH;
    w = Math.round(h / ratio);
  }
  if (w > maxW) {
    w = maxW;
    h = Math.round(w * ratio);
  }

  return { width: w, height: h };
}

function denormToUi(box: [number, number, number, number], ui: { width: number; height: number }): BoxPx {
  return {
    x: box[0] * ui.width,
    y: box[1] * ui.height,
    w: box[2] * ui.width,
    h: box[3] * ui.height,
  };
}

function normFromUi(box: BoxPx, ui: { width: number; height: number }): [number, number, number, number] {
  return [box.x / ui.width, box.y / ui.height, box.w / ui.width, box.h / ui.height];
}

function getSafeZone(ui: { width: number; height: number }, safeMarginRatio: number): BoxPx {
  const mx = Math.round(ui.width * safeMarginRatio);
  const my = Math.round(ui.height * safeMarginRatio);
  return { x: mx, y: my, w: ui.width - mx * 2, h: ui.height - my * 2 };
}

function defaultBadgeBox(aspectRatio: AspectRatio): [number, number, number, number] {
  if (aspectRatio === "9:16") return [0.7, 0.06, 0.22, 0.06];
  if (aspectRatio === "4:5") return [0.7, 0.07, 0.22, 0.06];
  return [0.7, 0.06, 0.22, 0.07];
}

function defaultLegalBox(aspectRatio: AspectRatio): [number, number, number, number] {
  if (aspectRatio === "9:16") return [0.08, 0.93, 0.84, 0.045];
  if (aspectRatio === "4:5") return [0.08, 0.93, 0.84, 0.05];
  return [0.08, 0.94, 0.84, 0.045];
}

function defaultBadgeCfg(aspectRatio: AspectRatio): LayoutText {
  return {
    box: defaultBadgeBox(aspectRatio),
    align: "center",
    maxLines: 1,
    paddingPx: 14,
    minFontPx: 16,
  };
}

function defaultLegalCfg(aspectRatio: AspectRatio): LayoutText {
  return {
    box: defaultLegalBox(aspectRatio),
    align: "left",
    maxLines: 2,
    paddingPx: 10,
    minFontPx: 12,
  };
}

function buildGuides(params: {
  ui: { width: number; height: number };
  showSafeZone: boolean;
  safeZone: BoxPx;
  boxes: UiBox[];
  activeId: BoxId;
}) {
  const { ui, showSafeZone, safeZone, boxes, activeId } = params;
  const v: number[] = [0, ui.width / 2, ui.width];
  const h: number[] = [0, ui.height / 2, ui.height];

  if (showSafeZone) {
    v.push(safeZone.x, safeZone.x + safeZone.w);
    h.push(safeZone.y, safeZone.y + safeZone.h);
  }

  for (const b of boxes) {
    if (b.id === activeId) continue;
    v.push(b.x, b.x + b.w / 2, b.x + b.w);
    h.push(b.y, b.y + b.h / 2, b.y + b.h);
  }

  return { v, h };
}

function snapBox(params: {
  box: BoxPx;
  guides: { v: number[]; h: number[] };
  thresholdPx: number;
}) {
  let { box } = params;
  const lines: { v: number[]; h: number[] } = { v: [], h: [] };

  const left = box.x;
  const right = box.x + box.w;
  const centerX = box.x + box.w / 2;

  const top = box.y;
  const bottom = box.y + box.h;
  const centerY = box.y + box.h / 2;

  const pickSnap = (value: number, candidates: number[]) => {
    let best: { target: number; dist: number } | null = null;
    for (const target of candidates) {
      const dist = Math.abs(value - target);
      if (dist <= params.thresholdPx && (!best || dist < best.dist)) {
        best = { target, dist };
      }
    }
    return best;
  };

  const snapX =
    pickSnap(left, params.guides.v) ??
    pickSnap(centerX, params.guides.v) ??
    pickSnap(right, params.guides.v);
  if (snapX) {
    const use = snapX.target;
    const dLeft = Math.abs(left - use);
    const dCenter = Math.abs(centerX - use);
    const dRight = Math.abs(right - use);
    const min = Math.min(dLeft, dCenter, dRight);
    if (min === dLeft) box = { ...box, x: use };
    else if (min === dCenter) box = { ...box, x: use - box.w / 2 };
    else box = { ...box, x: use - box.w };
    lines.v.push(use);
  }

  const snapY =
    pickSnap(top, params.guides.h) ??
    pickSnap(centerY, params.guides.h) ??
    pickSnap(bottom, params.guides.h);
  if (snapY) {
    const use = snapY.target;
    const dTop = Math.abs(top - use);
    const dCenter = Math.abs(centerY - use);
    const dBottom = Math.abs(bottom - use);
    const min = Math.min(dTop, dCenter, dBottom);
    if (min === dTop) box = { ...box, y: use };
    else if (min === dCenter) box = { ...box, y: use - box.h / 2 };
    else box = { ...box, y: use - box.h };
    lines.h.push(use);
  }

  return { box, lines };
}

function clampToCanvas(box: BoxPx, ui: { width: number; height: number }, minW = 64, minH = 48): BoxPx {
  const w = clamp(box.w, minW, ui.width);
  const h = clamp(box.h, minH, ui.height);
  const x = clamp(box.x, 0, ui.width - w);
  const y = clamp(box.y, 0, ui.height - h);
  return { x, y, w, h };
}

function BentoCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-3xl border border-white/60 bg-white/80 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.6)] backdrop-blur",
        className,
      ].join(" ")}
    >
      <div className="border-b border-slate-200/70 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function LayoutEditorModal(props: Props) {
  const ui = useMemo(() => computeWorkspaceSize(props.aspectRatio), [props.aspectRatio]);

  const [showGrid, setShowGrid] = useState(true);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridPx, setGridPx] = useState(8);
  const [safeMarginRatio, setSafeMarginRatio] = useState(0.1);

  const initialLayout = useMemo(
    () => props.layout ?? createDefaultLayout(props.aspectRatio),
    [props.layout, props.aspectRatio],
  );

  const [heroCfg, setHeroCfg] = useState<LayoutMedia>(initialLayout.hero);
  const [logoCfg, setLogoCfg] = useState<LayoutMedia>(initialLayout.logo);
  const [headlineCfg, setHeadlineCfg] = useState<LayoutText>(initialLayout.headline);
  const [subCfg, setSubCfg] = useState<LayoutText>(initialLayout.subtext);
  const [ctaCfg, setCtaCfg] = useState<LayoutCta>(initialLayout.cta);

  const [badgeEnabled, setBadgeEnabled] = useState(Boolean(initialLayout.badge));
  const [legalEnabled, setLegalEnabled] = useState(Boolean(initialLayout.legal));
  const [badgeCfg, setBadgeCfg] = useState<LayoutText>(
    initialLayout.badge ?? defaultBadgeCfg(props.aspectRatio),
  );
  const [legalCfg, setLegalCfg] = useState<LayoutText>(
    initialLayout.legal ?? defaultLegalCfg(props.aspectRatio),
  );

  const [boxes, setBoxes] = useState<UiBox[]>(() => {
    const baseBoxes: UiBox[] = [
      { id: "hero", ...denormToUi(initialLayout.hero.box, ui) },
      { id: "logo", ...denormToUi(initialLayout.logo.box, ui) },
      { id: "headline", ...denormToUi(initialLayout.headline.box, ui) },
      { id: "subtext", ...denormToUi(initialLayout.subtext.box, ui) },
      { id: "cta", ...denormToUi(initialLayout.cta.box, ui) },
    ];
    if (initialLayout.badge) {
      baseBoxes.push({ id: "badge", ...denormToUi(initialLayout.badge.box, ui) });
    }
    if (initialLayout.legal) {
      baseBoxes.push({ id: "legal", ...denormToUi(initialLayout.legal.box, ui) });
    }
    return baseBoxes;
  });

  const [activeId, setActiveId] = useState<BoxId>("headline");
  const [snapLines, setSnapLines] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const shapeRefs = useRef<Record<BoxId, Konva.Rect | null>>({
    hero: null,
    logo: null,
    headline: null,
    subtext: null,
    cta: null,
    badge: null,
    legal: null,
  });

  const safeZone = useMemo(
    () => getSafeZone(ui, safeMarginRatio),
    [ui, safeMarginRatio],
  );

  useEffect(() => {
    // reset internal state when opening / aspect ratio changes
    if (!props.open) return;
    const layout = props.layout ?? createDefaultLayout(props.aspectRatio);
    setSafeMarginRatio(layout.canvas.safeMarginRatio);
    setGridPx(layout.canvas.gridPx);
    setHeroCfg(layout.hero);
    setLogoCfg(layout.logo);
    setHeadlineCfg(layout.headline);
    setSubCfg(layout.subtext);
    setCtaCfg(layout.cta);
    setBadgeEnabled(Boolean(layout.badge));
    setLegalEnabled(Boolean(layout.legal));
    setBadgeCfg(layout.badge ?? defaultBadgeCfg(props.aspectRatio));
    setLegalCfg(layout.legal ?? defaultLegalCfg(props.aspectRatio));
    const nextBoxes: UiBox[] = [
      { id: "hero", ...denormToUi(layout.hero.box, ui) },
      { id: "logo", ...denormToUi(layout.logo.box, ui) },
      { id: "headline", ...denormToUi(layout.headline.box, ui) },
      { id: "subtext", ...denormToUi(layout.subtext.box, ui) },
      { id: "cta", ...denormToUi(layout.cta.box, ui) },
    ];
    if (layout.badge) nextBoxes.push({ id: "badge", ...denormToUi(layout.badge.box, ui) });
    if (layout.legal) nextBoxes.push({ id: "legal", ...denormToUi(layout.legal.box, ui) });
    setBoxes(nextBoxes);
    setActiveId("headline");
    setSnapLines({ v: [], h: [] });
  }, [props.open, props.layout, props.aspectRatio, ui]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const node = shapeRefs.current[activeId];
    if (!transformer || !node) return;
    transformer.nodes([node]);
    transformer.getLayer()?.batchDraw();
  }, [activeId, boxes]);

  const fontFamily =
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
  const measureCtx = useMemo(() => {
    if (typeof window === "undefined") return null;
    const canvas = document.createElement("canvas");
    return canvas.getContext("2d");
  }, []);

  const getFit = (id: BoxId, text: string) => {
    if (id === "hero" || id === "logo") return null;
    const box = boxes.find((b) => b.id === id);
    if (!box || !measureCtx) return null;
    const cfg =
      id === "headline"
        ? headlineCfg
        : id === "subtext"
          ? subCfg
          : id === "badge"
            ? badgeCfg
            : id === "legal"
              ? legalCfg
              : ctaCfg;
    const fontWeight =
      id === "headline" ? 800 : id === "cta" ? 800 : id === "badge" ? 800 : id === "legal" ? 600 : 700;
    const lineHeight = id === "cta" || id === "badge" ? 1 : id === "legal" ? 1.1 : 1.15;
    return autofitTextToBox({
      text,
      boxWidthPx: box.w,
      boxHeightPx: box.h,
      paddingPx: cfg.paddingPx,
      maxLines: cfg.maxLines,
      minFontSizePx: cfg.minFontPx,
      lineHeight,
      measureForFont: (fontSizePx) => (candidate) => {
        measureCtx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
        return measureCtx.measureText(candidate).width;
      },
    });
  };

  const updateBox = (id: BoxId, next: BoxPx, opts?: { snap?: boolean; grid?: boolean }) => {
    setBoxes((prev) => {
      const others = prev.filter((b) => b.id !== id);
      const threshold = 10;

      const minSize = (() => {
        switch (id) {
          case "hero":
            return { w: 220, h: 180 };
          case "logo":
            return { w: 90, h: 60 };
          case "badge":
            return { w: 120, h: 44 };
          case "legal":
            return { w: 220, h: 40 };
          case "cta":
            return { w: 120, h: 64 };
          default:
            return { w: 140, h: 90 };
        }
      })();

      let candidate = clampToCanvas(next, ui, minSize.w, minSize.h);
      if (opts?.grid && showGrid) {
        candidate = {
          x: roundToGrid(candidate.x, gridPx),
          y: roundToGrid(candidate.y, gridPx),
          w: roundToGrid(candidate.w, gridPx),
          h: roundToGrid(candidate.h, gridPx),
        };
        candidate = clampToCanvas(candidate, ui, minSize.w, minSize.h);
      }

      if (opts?.snap && snapEnabled) {
        const guides = buildGuides({
          ui,
          showSafeZone,
          safeZone,
          boxes: prev,
          activeId: id,
        });
        const snapped = snapBox({ box: candidate, guides, thresholdPx: threshold });
        candidate = clampToCanvas(snapped.box, ui, minSize.w, minSize.h);
        setSnapLines(snapped.lines);
      } else {
        setSnapLines({ v: [], h: [] });
      }

      return [...others, { id, ...candidate }].sort((a, b) => a.id.localeCompare(b.id));
    });
  };

  useEffect(() => {
    if (!boxes.some((b) => b.id === activeId)) {
      setActiveId("headline");
    }
  }, [activeId, boxes]);

  const toggleOptionalBox = (id: "badge" | "legal", enabled: boolean) => {
    if (id === "badge") setBadgeEnabled(enabled);
    else setLegalEnabled(enabled);

    setBoxes((prev) => {
      const exists = prev.some((b) => b.id === id);
      if (enabled) {
        if (exists) return prev;
        const cfg = id === "badge" ? badgeCfg : legalCfg;
        return [...prev, { id, ...denormToUi(cfg.box, ui) }];
      }
      if (!exists) return prev;
      return prev.filter((b) => b.id !== id);
    });

    if (!enabled && activeId === id) {
      setActiveId("headline");
    }
  };

  const buildLayout = (): LayoutJson => {
    const heroBox = boxes.find((b) => b.id === "hero")!;
    const logoBox = boxes.find((b) => b.id === "logo")!;
    const headlineBox = boxes.find((b) => b.id === "headline")!;
    const subBox = boxes.find((b) => b.id === "subtext")!;
    const ctaBox = boxes.find((b) => b.id === "cta")!;
    const badgeBox = badgeEnabled ? boxes.find((b) => b.id === "badge") ?? null : null;
    const legalBox = legalEnabled ? boxes.find((b) => b.id === "legal") ?? null : null;

    return {
      version: 2,
      canvas: {
        width: initialLayout.canvas.width,
        height: initialLayout.canvas.height,
        aspectRatio: props.aspectRatio,
        safeMarginRatio,
        gridPx,
      },
      hero: { ...heroCfg, box: normFromUi(heroBox, ui) },
      logo: { ...logoCfg, box: normFromUi(logoBox, ui) },
      headline: { ...headlineCfg, box: normFromUi(headlineBox, ui) },
      subtext: { ...subCfg, box: normFromUi(subBox, ui) },
      cta: { ...ctaCfg, box: normFromUi(ctaBox, ui) },
      badge: badgeBox ? { ...badgeCfg, box: normFromUi(badgeBox, ui) } : undefined,
      legal: legalBox ? { ...legalCfg, box: normFromUi(legalBox, ui) } : undefined,
    };
  };

  const onDownloadLayoutJson = () => {
    const layout = buildLayout();

    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mkdoc-layout-${props.aspectRatio.replace(":", "x")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadOverlayPng = async () => {
    const layout = buildLayout();

    const response = await fetch("/api/overlay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout, showSafeZone }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json?.error || "오버레이 생성 실패");
    }

    const dataUrl = String(json?.dataUrl || "");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `mkdoc-guide-overlay-${props.aspectRatio.replace(":", "x")}.png`;
    a.click();
  };

  const onApply = () => {
    const layout = buildLayout();

    props.onApply(layout);
  };

  const activeCfg: LayoutText | LayoutCta | LayoutMedia =
    activeId === "hero"
      ? heroCfg
      : activeId === "logo"
        ? logoCfg
        : activeId === "headline"
          ? headlineCfg
          : activeId === "subtext"
            ? subCfg
            : activeId === "badge"
              ? badgeCfg
              : activeId === "legal"
                ? legalCfg
                : ctaCfg;

  const setActiveCfg = (next: LayoutText | LayoutCta | LayoutMedia) => {
    if (activeId === "hero") setHeroCfg(next as LayoutMedia);
    else if (activeId === "logo") setLogoCfg(next as LayoutMedia);
    else if (activeId === "headline") setHeadlineCfg(next as LayoutText);
    else if (activeId === "subtext") setSubCfg(next as LayoutText);
    else if (activeId === "badge") setBadgeCfg(next as LayoutText);
    else if (activeId === "legal") setLegalCfg(next as LayoutText);
    else setCtaCfg(next as LayoutCta);
  };

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_120px_-60px_rgba(0,0,0,0.8)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-700">
              Layout Editor
            </p>
            <p className="mt-1 truncate text-lg font-semibold text-slate-900">
              텍스트 박스 레이아웃 편집 ({props.aspectRatio})
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              드래그/리사이즈로 박스 위치를 잡고, JSON/오버레이를 Export할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={onApply}
              className="rounded-full bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow hover:opacity-95"
            >
              적용
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[1fr,360px]">
          <BentoCard
            title="캔버스"
            subtitle="선택된 박스를 드래그/리사이즈하면 스냅 가이드가 표시됩니다."
          >
            <div className="flex flex-wrap items-center gap-3 pb-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showSafeZone}
                  onChange={(e) => setShowSafeZone(e.target.checked)}
                />
                Safe Zone
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                Grid
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={snapEnabled}
                  onChange={(e) => setSnapEnabled(e.target.checked)}
                />
                Snap
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Grid(px)</span>
                <input
                  type="number"
                  value={gridPx}
                  min={1}
                  max={32}
                  onChange={(e) => setGridPx(Number(e.target.value) || 8)}
                  className="w-20 rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Safe(%)</span>
                <input
                  type="number"
                  value={Math.round(safeMarginRatio * 100)}
                  min={0}
                  max={20}
                  onChange={(e) =>
                    setSafeMarginRatio(clamp((Number(e.target.value) || 10) / 100, 0, 0.2))
                  }
                  className="w-20 rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDownloadLayoutJson}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Layout JSON 다운로드
                </button>
                <button
                  type="button"
                  onClick={() => void onDownloadOverlayPng()}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Guide Overlay PNG 다운로드
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <Stage
                width={ui.width}
                height={ui.height}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage()) {
                    // keep current selection
                  }
                }}
              >
                <Layer>
                  <Rect x={0} y={0} width={ui.width} height={ui.height} fill="#ffffff" />

                  {/* Grid */}
                  {showGrid ? (
                    <Group listening={false} opacity={0.6}>
                      {Array.from({ length: Math.floor(ui.width / gridPx) }).map((_, idx) => {
                        const x = idx * gridPx;
                        return (
                          <Line
                            key={`gv-${x}`}
                            points={[x, 0, x, ui.height]}
                            stroke="rgba(148,163,184,0.35)"
                            strokeWidth={1}
                          />
                        );
                      })}
                      {Array.from({ length: Math.floor(ui.height / gridPx) }).map((_, idx) => {
                        const y = idx * gridPx;
                        return (
                          <Line
                            key={`gh-${y}`}
                            points={[0, y, ui.width, y]}
                            stroke="rgba(148,163,184,0.35)"
                            strokeWidth={1}
                          />
                        );
                      })}
                    </Group>
                  ) : null}

                  {/* Safe zone */}
                  {showSafeZone ? (
                    <Rect
                      x={safeZone.x}
                      y={safeZone.y}
                      width={safeZone.w}
                      height={safeZone.h}
                      stroke="rgba(2,132,199,0.7)"
                      dash={[10, 8]}
                      strokeWidth={2}
                      listening={false}
                    />
                  ) : null}

                  {/* Snap lines */}
                  {snapLines.v.map((x) => (
                    <Line
                      key={`sv-${x}`}
                      points={[x, 0, x, ui.height]}
                      stroke="rgba(250,204,21,0.85)"
                      dash={[8, 6]}
                      strokeWidth={2}
                      listening={false}
                    />
                  ))}
                  {snapLines.h.map((y) => (
                    <Line
                      key={`sh-${y}`}
                      points={[0, y, ui.width, y]}
                      stroke="rgba(250,204,21,0.85)"
                      dash={[8, 6]}
                      strokeWidth={2}
                      listening={false}
                    />
                  ))}

                  {/* Boxes */}
                  {boxes.map((b) => {
                    const isActive = b.id === activeId;
                    const palette = (() => {
                      switch (b.id) {
                        case "hero":
                          return { stroke: "#fb923c", fill: "rgba(251,146,60,0.08)" };
                        case "logo":
                          return { stroke: "#a855f7", fill: "rgba(168,85,247,0.08)" };
                        case "headline":
                          return { stroke: "#ff2bd6", fill: "rgba(255,43,214,0.10)" };
                        case "subtext":
                          return { stroke: "#22d3ee", fill: "rgba(34,211,238,0.10)" };
                        case "cta":
                          return { stroke: "#84cc16", fill: "rgba(132,204,22,0.12)" };
                        case "badge":
                          return { stroke: "#facc15", fill: "rgba(250,204,21,0.10)" };
                        case "legal":
                          return { stroke: "#94a3b8", fill: "rgba(148,163,184,0.08)" };
                        default:
                          return { stroke: "#84cc16", fill: "rgba(132,204,22,0.12)" };
                      }
                    })();

                    const previewText = (() => {
                      switch (b.id) {
                        case "headline":
                          return props.headline;
                        case "subtext":
                          return props.subText;
                        case "cta":
                          return props.ctaText;
                        case "badge":
                          return props.badgeText ?? "BADGE";
                        case "legal":
                          return props.legalText ?? "Legal copy";
                        default:
                          return "";
                      }
                    })();

                    const fit = getFit(b.id, previewText);
                    const textCfg =
                      b.id === "headline"
                        ? headlineCfg
                        : b.id === "subtext"
                          ? subCfg
                          : b.id === "badge"
                            ? badgeCfg
                            : b.id === "legal"
                              ? legalCfg
                              : b.id === "cta"
                                ? ctaCfg
                                : null;

                    const innerX = textCfg ? b.x + textCfg.paddingPx : b.x;
                    const innerY = textCfg ? b.y + textCfg.paddingPx : b.y;
                    const innerW = textCfg ? Math.max(b.w - textCfg.paddingPx * 2, 1) : b.w;

                    const textAlign: TextAlign = (textCfg?.align ?? "left") as TextAlign;
                    const anchorX =
                      textAlign === "left"
                        ? innerX
                        : textAlign === "center"
                          ? innerX + innerW / 2
                          : innerX + innerW;

                    return (
                      <Group
                        key={b.id}
                        onMouseDown={() => setActiveId(b.id)}
                        onTap={() => setActiveId(b.id)}
                      >
                        <Rect
                          ref={(node) => {
                            shapeRefs.current[b.id] = node;
                          }}
                          x={b.x}
                          y={b.y}
                          width={b.w}
                          height={b.h}
                          fill={palette.fill}
                          stroke={isActive ? palette.stroke : "rgba(148,163,184,0.55)"}
                          strokeWidth={isActive ? 4 : 2}
                          cornerRadius={
                            b.id === "cta" || b.id === "badge"
                              ? Math.min(999, Math.round(b.h / 2))
                              : 18
                          }
                          draggable
                          onDragMove={(e) => {
                            const node = e.target;
                            updateBox(
                              b.id,
                              { x: node.x(), y: node.y(), w: b.w, h: b.h },
                              { snap: true, grid: true },
                            );
                          }}
                          onDragEnd={(e) => {
                            const node = e.target;
                            updateBox(
                              b.id,
                              { x: node.x(), y: node.y(), w: b.w, h: b.h },
                              { snap: true, grid: true },
                            );
                            setTimeout(() => setSnapLines({ v: [], h: [] }), 120);
                          }}
                          onTransformEnd={(e) => {
                            const node = e.target as Konva.Rect;
                            const scaleX = node.scaleX();
                            const scaleY = node.scaleY();
                            node.scaleX(1);
                            node.scaleY(1);
                            updateBox(
                              b.id,
                              {
                                x: node.x(),
                                y: node.y(),
                                w: Math.max(20, node.width() * scaleX),
                                h: Math.max(20, node.height() * scaleY),
                              },
                              { snap: true, grid: true },
                            );
                            setTimeout(() => setSnapLines({ v: [], h: [] }), 120);
                          }}
                        />

                        {/* Label */}
                        <Text
                          x={b.x + 10}
                          y={b.y + 10}
                          text={b.id.toUpperCase()}
                          fontSize={14}
                          fontStyle="bold"
                          fill={palette.stroke}
                          listening={false}
                        />

                        {/* Text preview */}
                        {previewText.trim() && fit && textCfg ? (
                          <>
                            {b.id === "cta" ? (
                              <Text
                                x={b.x}
                                y={b.y + b.h / 2 - fit.fontSizePx / 2}
                                width={b.w}
                                align="center"
                                text={previewText.trim()}
                                fontFamily={fontFamily}
                                fontStyle="bold"
                                fontSize={fit.fontSizePx}
                                fill="#ffffff"
                                listening={false}
                              />
                            ) : (
                              <Text
                                x={b.x + textCfg.paddingPx}
                                y={b.y + textCfg.paddingPx}
                                width={Math.max(b.w - textCfg.paddingPx * 2, 1)}
                                height={Math.max(b.h - textCfg.paddingPx * 2, 1)}
                                align={textAlign}
                                text={fit.lines.join("\n")}
                                fontFamily={fontFamily}
                                fontStyle="bold"
                                fontSize={fit.fontSizePx}
                                lineHeight={b.id === "legal" ? 1.1 : 1.15}
                                fill="#0b1220"
                                listening={false}
                              />
                            )}
                          </>
                        ) : null}
                      </Group>
                    );
                  })}

                  <Transformer
                    ref={(node) => {
                      transformerRef.current = node;
                    }}
                    rotateEnabled={false}
                    ignoreStroke
                    boundBoxFunc={(oldBox, newBox) => {
                      const minSize = (() => {
                        switch (activeId) {
                          case "hero":
                            return { w: 220, h: 180 };
                          case "logo":
                            return { w: 90, h: 60 };
                          case "badge":
                            return { w: 120, h: 44 };
                          case "legal":
                            return { w: 220, h: 40 };
                          case "cta":
                            return { w: 120, h: 64 };
                          default:
                            return { w: 140, h: 90 };
                        }
                      })();
                      const minW = minSize.w;
                      const minH = minSize.h;
                      if (newBox.width < minW || newBox.height < minH) {
                        return oldBox;
                      }
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>
            </div>
          </BentoCard>

          <div className="space-y-4">
            <BentoCard title="선택 박스 설정" subtitle="텍스트 오토핏 기준과 정렬을 조절합니다.">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={badgeEnabled}
                      onChange={(e) => toggleOptionalBox("badge", e.target.checked)}
                    />
                    Badge
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={legalEnabled}
                      onChange={(e) => toggleOptionalBox("legal", e.target.checked)}
                    />
                    Legal
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    (선택: 필요할 때만 켜세요)
                  </span>
                </div>

                <div className="col-span-2">
                  <p className="text-xs font-semibold text-slate-700">선택</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: "hero", label: "히어로" },
                        { id: "logo", label: "로고" },
                        { id: "headline", label: "헤드" },
                        { id: "subtext", label: "서브" },
                        { id: "cta", label: "CTA" },
                        ...(badgeEnabled ? [{ id: "badge", label: "뱃지" }] : []),
                        ...(legalEnabled ? [{ id: "legal", label: "법적" }] : []),
                      ] as Array<{ id: BoxId; label: string }>
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveId(item.id)}
                        className={[
                          "rounded-xl px-3 py-2 text-xs font-semibold transition",
                          activeId === item.id
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {"fit" in activeCfg ? (
                  <>
                    <label className="text-xs font-semibold text-slate-700">
                      Fit
                      <select
                        value={activeCfg.fit}
                        onChange={(e) =>
                          setActiveCfg({
                            ...activeCfg,
                            fit: e.target.value === "cover" ? "cover" : "contain",
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      >
                        <option value="contain">Contain</option>
                        <option value="cover">Cover</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Padding(px)
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={activeCfg.paddingPx}
                        onChange={(e) =>
                          setActiveCfg({
                            ...activeCfg,
                            paddingPx: Number(e.target.value) || 0,
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-slate-700">정렬</p>
                      <div className="mt-2 inline-flex w-full rounded-2xl bg-slate-100 p-1">
                        {(["left", "center", "right"] as TextAlign[]).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setActiveCfg({ ...(activeCfg as LayoutText), align })}
                            className={[
                              "w-1/3 rounded-xl px-3 py-2 text-xs font-semibold transition",
                              (activeCfg as LayoutText).align === align
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-600 hover:text-slate-900",
                            ].join(" ")}
                          >
                            {align === "left" ? "좌" : align === "center" ? "중" : "우"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="text-xs font-semibold text-slate-700">
                      Max Lines
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={(activeCfg as LayoutText).maxLines}
                        onChange={(e) =>
                          setActiveCfg({
                            ...(activeCfg as LayoutText),
                            maxLines: Number(e.target.value) || 1,
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      />
                    </label>

                    <label className="text-xs font-semibold text-slate-700">
                      Padding(px)
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={(activeCfg as LayoutText).paddingPx}
                        onChange={(e) =>
                          setActiveCfg({
                            ...(activeCfg as LayoutText),
                            paddingPx: Number(e.target.value) || 0,
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      />
                    </label>

                    <label className="text-xs font-semibold text-slate-700">
                      Min Font(px)
                      <input
                        type="number"
                        min={8}
                        max={120}
                        value={(activeCfg as LayoutText).minFontPx}
                        onChange={(e) =>
                          setActiveCfg({
                            ...(activeCfg as LayoutText),
                            minFontPx: Number(e.target.value) || 8,
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      />
                    </label>

                    {activeId === "cta" ? (
                      <label className="text-xs font-semibold text-slate-700">
                        CTA Radius(px)
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={ctaCfg.radiusPx}
                          onChange={(e) =>
                            setCtaCfg({
                              ...ctaCfg,
                              radiusPx: Number(e.target.value) || 0,
                            })
                          }
                          className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                        />
                      </label>
                    ) : null}
                  </>
                )}
              </div>
            </BentoCard>

            <BentoCard title="팁" subtitle="권장 흐름">
              <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-700">
                <li>박스를 Safe Zone 안에 배치하면 플랫폼별 크롭 리스크가 줄어듭니다.</li>
                <li>배경 전용 모드에서는 박스 영역을 단순하게 비워두도록 생성 프롬프트가 동작합니다.</li>
                <li>최종 텍스트는 기본 모드에서 결정론적으로 렌더링됩니다(오타/깨짐 감소).</li>
              </ol>
            </BentoCard>
          </div>
        </div>
      </div>
    </div>
  );
}
