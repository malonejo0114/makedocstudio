"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TourStep = {
  id: string;
  selector: string;
  title: string;
  body: string;
  placement?: "auto" | "top" | "bottom";
};

type Box = { left: number; top: number; width: number; height: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function computeBoxForElement(el: Element): Box {
  const rect = el.getBoundingClientRect();
  const pad = 10;
  const left = clamp(rect.left - pad, 8, window.innerWidth - 8);
  const top = clamp(rect.top - pad, 8, window.innerHeight - 8);
  const width = clamp(rect.width + pad * 2, 24, window.innerWidth - left - 8);
  const height = clamp(rect.height + pad * 2, 24, window.innerHeight - top - 8);
  return { left, top, width, height };
}

function computeTooltipPlacement(
  box: Box,
  preferred: "auto" | "top" | "bottom",
): "top" | "bottom" {
  if (preferred === "top" || preferred === "bottom") return preferred;
  const spaceTop = box.top;
  const spaceBottom = window.innerHeight - (box.top + box.height);
  return spaceBottom >= 220 || spaceBottom >= spaceTop ? "bottom" : "top";
}

export default function GuidedTour({
  open,
  steps,
  onClose,
  onComplete,
  onStepChange,
}: {
  open: boolean;
  steps: TourStep[];
  onClose: () => void;
  onComplete?: () => void;
  onStepChange?: (step: TourStep, index: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];

  const [box, setBox] = useState<Box | null>(null);
  const [found, setFound] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number; placement: "top" | "bottom" }>({
    left: 12,
    top: 12,
    placement: "bottom",
  });

  const progressLabel = useMemo(() => `${index + 1} / ${Math.max(steps.length, 1)}`, [index, steps.length]);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!step) return;

    let isActive = true;

    const update = () => {
      if (!isActive) return;
      const el = document.querySelector(step.selector);
      if (!el) {
        setFound(false);
        setBox(null);
        return;
      }
      setFound(true);
      setBox(computeBoxForElement(el));
    };

    // Try to bring target into view for smoother onboarding.
    const el = document.querySelector(step.selector);
    if (el && "scrollIntoView" in el) {
      try {
        (el as any).scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {
        // ignore
      }
    }

    const t = window.setTimeout(update, 120);
    update();

    window.addEventListener("resize", update);
    // capture=true: recompute when inner scroll containers move.
    window.addEventListener("scroll", update, true);

    return () => {
      isActive = false;
      window.clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step?.selector]);

  useEffect(() => {
    if (!open) return;
    if (!step) return;
    onStepChange?.(step, index);
  }, [index, onStepChange, open, step]);

  useEffect(() => {
    if (!open) return;

    const tipEl = tooltipRef.current;
    if (!tipEl) return;

    const tipRect = tipEl.getBoundingClientRect();
    const w = tipRect.width || 360;
    const h = tipRect.height || 180;

    const placement = box && step
      ? computeTooltipPlacement(box, step.placement ?? "auto")
      : "bottom";

    const targetCenterX = box ? box.left + box.width / 2 : window.innerWidth / 2;
    const left = clamp(targetCenterX - w / 2, 12, window.innerWidth - w - 12);

    const top = box
      ? placement === "bottom"
        ? clamp(box.top + box.height + 14, 12, window.innerHeight - h - 12)
        : clamp(box.top - h - 14, 12, window.innerHeight - h - 12)
      : clamp(window.innerHeight / 2 - h / 2, 12, window.innerHeight - h - 12);

    setTooltipPos({ left, top, placement });
  }, [open, box, index, step?.placement, step]);

  if (!open || !step) return null;

  const onPrev = () => setIndex((i) => Math.max(0, i - 1));
  const onNext = () => {
    if (index >= steps.length - 1) {
      onComplete?.();
      onClose();
      return;
    }
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  };

  const hole = box
    ? {
        top: box.top,
        left: box.left,
        right: box.left + box.width,
        bottom: box.top + box.height,
      }
    : null;

  const shade = "rgba(2,6,23,0.62)";

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Shade regions around the hole. pointer-events:none keeps scrolling usable. */}
      {hole ? (
        <>
          <div className="fixed left-0 top-0 w-full" style={{ height: hole.top, background: shade, pointerEvents: "none" }} />
          <div className="fixed left-0" style={{ top: hole.top, width: hole.left, height: hole.bottom - hole.top, background: shade, pointerEvents: "none" }} />
          <div className="fixed" style={{ left: hole.right, top: hole.top, right: 0, height: hole.bottom - hole.top, background: shade, pointerEvents: "none" }} />
          <div className="fixed left-0 w-full" style={{ top: hole.bottom, bottom: 0, background: shade, pointerEvents: "none" }} />

          <div
            className="fixed rounded-3xl border-2 border-cyan-300 shadow-[0_0_0_2px_rgba(34,211,238,0.15)]"
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.right - hole.left,
              height: hole.bottom - hole.top,
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0" style={{ background: shade, pointerEvents: "none" }} />
      )}

      <div
        ref={tooltipRef}
        className="fixed w-[min(420px,calc(100vw-24px))] rounded-3xl border border-white/25 bg-white/95 p-4 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.7)] backdrop-blur"
        style={{ left: tooltipPos.left, top: tooltipPos.top }}
        role="dialog"
        aria-modal="true"
        aria-label="튜토리얼"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Tutorial • {progressLabel}
            </p>
            <h3 className="mt-1 text-base font-black text-slate-900">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-700">{step.body}</p>

        {!found ? (
          <p className="mt-2 text-[11px] font-semibold text-amber-700">
            이 단계의 버튼이 아직 화면에 없습니다. (화면 상태에 따라 다음으로 넘어가도 됩니다.)
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={index === 0}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            이전
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              건너뛰기
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-2 text-xs font-black text-white hover:brightness-110"
            >
              {index >= steps.length - 1 ? "완료" : "다음"}
            </button>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          팁: 화면은 그대로 조작해도 됩니다. 튜토리얼이 방해되면 “닫기”로 끌 수 있어요.
        </p>
      </div>
    </div>
  );
}
