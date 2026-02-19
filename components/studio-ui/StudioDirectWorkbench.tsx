"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import Link from "next/link";

import { getPricedModelCatalog } from "@/lib/studio/pricing";
import {
  authFetchJson,
  formatDateTime,
  formatKrw,
  getAccessToken,
} from "@/lib/studio/client";

type CreditModel = {
  id: string;
  provider: string;
  name: string;
  textSuccess: "상" | "중상" | "중";
  speed: "빠름" | "보통" | "느림";
  price: { costUsd: number; costKrw: number; sellKrw: number; creditsRequired: number };
  balance: number;
};

type CreditsResponse = {
  models: CreditModel[];
  globalBalance: number;
};

type UploadAssetType = "reference" | "product";
type CopyToggles = { useSubcopy: boolean; useCTA: boolean; useBadge: boolean };
type FontTone = "auto" | "gothic" | "myeongjo" | "rounded" | "calligraphy";
type EffectTone = "auto" | "clean" | "shadow" | "outline" | "emboss" | "bubble";
type TextStyleSlot = { fontTone: FontTone; effectTone: EffectTone };
type TextStyleControls = {
  headline: TextStyleSlot;
  subhead: TextStyleSlot;
  cta: TextStyleSlot;
  badge: TextStyleSlot;
};

type ExtraText = {
  id: string;
  label: string;
  value: string;
};

type TextSlotRole = "headline" | "subhead" | "cta" | "badge";
type TextSlot = {
  id: TextSlotRole;
  role: TextSlotRole;
  x: number;
  y: number;
  w: number;
  h: number;
  maxLines: number;
  align: "left" | "center";
  locked: boolean;
};

type DirectGenerateResponse = {
  projectId: string;
  promptId: string;
  generation: {
    id: string;
    imageUrl: string;
    imageModelId: string;
    textFidelityScore: number | null;
    sellKrw: number;
    createdAt: string;
  };
  creditsUsed: number;
  balanceAfter: number;
};

type SlotPointerState = {
  slotId: TextSlotRole;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origin: Pick<TextSlot, "x" | "y" | "w" | "h">;
  canvasWidth: number;
  canvasHeight: number;
};

const NEGATIVE_PROMPT_EXAMPLES = [
  "워터마크, 로고, 랜덤 문자, 오타",
  "흐림, 저해상도, 노이즈, 깨진 디테일",
  "왜곡된 손/얼굴, 비정상 비율, 잘린 피사체",
];
const DEFAULT_COPY_TOGGLES: CopyToggles = {
  useSubcopy: true,
  useCTA: true,
  useBadge: true,
};
const DEFAULT_TEXT_STYLE: TextStyleControls = {
  headline: { fontTone: "auto", effectTone: "auto" },
  subhead: { fontTone: "auto", effectTone: "auto" },
  cta: { fontTone: "auto", effectTone: "auto" },
  badge: { fontTone: "auto", effectTone: "auto" },
};
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

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createExtraText(): ExtraText {
  return {
    id: uid(),
    label: "",
    value: "",
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function slotLabel(role: TextSlotRole) {
  if (role === "headline") return "헤드카피";
  if (role === "subhead") return "서브카피";
  if (role === "cta") return "CTA";
  return "배지";
}

function createDefaultSlots(aspectRatio: "1:1" | "4:5" | "9:16"): TextSlot[] {
  if (aspectRatio === "9:16") {
    return [
      { id: "headline", role: "headline", x: 0.08, y: 0.08, w: 0.84, h: 0.16, maxLines: 2, align: "left", locked: true },
      { id: "subhead", role: "subhead", x: 0.08, y: 0.26, w: 0.84, h: 0.12, maxLines: 3, align: "left", locked: true },
      { id: "badge", role: "badge", x: 0.08, y: 0.64, w: 0.36, h: 0.075, maxLines: 1, align: "center", locked: true },
      { id: "cta", role: "cta", x: 0.08, y: 0.75, w: 0.38, h: 0.09, maxLines: 1, align: "center", locked: true },
    ];
  }
  if (aspectRatio === "4:5") {
    return [
      { id: "headline", role: "headline", x: 0.08, y: 0.08, w: 0.84, h: 0.17, maxLines: 2, align: "left", locked: true },
      { id: "subhead", role: "subhead", x: 0.08, y: 0.27, w: 0.84, h: 0.12, maxLines: 3, align: "left", locked: true },
      { id: "badge", role: "badge", x: 0.08, y: 0.66, w: 0.28, h: 0.075, maxLines: 1, align: "center", locked: true },
      { id: "cta", role: "cta", x: 0.08, y: 0.76, w: 0.33, h: 0.09, maxLines: 1, align: "center", locked: true },
    ];
  }
  return [
    { id: "headline", role: "headline", x: 0.08, y: 0.09, w: 0.84, h: 0.18, maxLines: 2, align: "left", locked: true },
    { id: "subhead", role: "subhead", x: 0.08, y: 0.29, w: 0.84, h: 0.13, maxLines: 3, align: "left", locked: true },
    { id: "badge", role: "badge", x: 0.08, y: 0.64, w: 0.26, h: 0.08, maxLines: 1, align: "center", locked: true },
    { id: "cta", role: "cta", x: 0.08, y: 0.76, w: 0.34, h: 0.1, maxLines: 1, align: "center", locked: true },
  ];
}

function splitTokens(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [] as string[];
  if (trimmed.includes(" ")) {
    return trimmed.split(/\s+/);
  }
  return Array.from(trimmed);
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let out = "";
  for (const ch of Array.from(text)) {
    const candidate = `${out}${ch}`;
    if (ctx.measureText(candidate).width > maxWidth) break;
    out = candidate;
  }
  return out || text.slice(0, 1);
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const tokens = splitTokens(text);
  if (tokens.length === 0) return [] as string[];
  const useSpace = text.trim().includes(" ");

  const lines: string[] = [];
  let current = "";

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const candidate = current ? `${current}${useSpace ? " " : ""}${token}` : token;

    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (!current) {
      lines.push(truncateToWidth(ctx, token, maxWidth));
    } else {
      lines.push(current);
      current = token;
      if (ctx.measureText(current).width > maxWidth) {
        current = truncateToWidth(ctx, current, maxWidth);
      }
    }

    if (lines.length >= maxLines) {
      return lines.slice(0, maxLines);
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function fitTextInBox(input: {
  ctx: CanvasRenderingContext2D;
  text: string;
  maxWidth: number;
  maxHeight: number;
  maxLines: number;
  fontWeight: number;
}) {
  let low = 10;
  let high = 108;
  let bestSize = 10;
  let bestLines = [input.text];

  for (let i = 0; i < 14; i += 1) {
    if (low > high) break;
    const mid = Math.floor((low + high) / 2);
    input.ctx.font = `${input.fontWeight} ${mid}px "Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif`;
    const lines = wrapTextLines(input.ctx, input.text, input.maxWidth, input.maxLines);
    const lineHeight = mid * 1.27;
    const fits = lines.length > 0 && lines.length * lineHeight <= input.maxHeight;

    if (fits) {
      bestSize = mid;
      bestLines = lines;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  input.ctx.font = `${input.fontWeight} ${bestSize}px "Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif`;
  const lines = wrapTextLines(input.ctx, input.text, input.maxWidth, input.maxLines);
  return {
    fontSize: bestSize,
    lineHeight: bestSize * 1.27,
    lines: lines.length > 0 ? lines : bestLines,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function slotText(role: TextSlotRole, values: {
  headline: string;
  subhead: string;
  cta: string;
  extraTexts: ExtraText[];
}, copyToggles: CopyToggles) {
  if (role === "headline") return values.headline.trim();
  if (role === "subhead" && !copyToggles.useSubcopy) return "";
  if (role === "cta" && !copyToggles.useCTA) return "";
  if (role === "badge" && !copyToggles.useBadge) return "";
  if (role === "subhead") return values.subhead.trim();
  if (role === "cta") return values.cta.trim();
  const firstExtra = values.extraTexts.find((item) => item.value.trim().length > 0);
  return firstExtra?.value.trim() ?? "";
}

function inferDirectTextMode(input: {
  headline: string;
  subhead: string;
  cta: string;
  extraTexts: ExtraText[];
  copyToggles: CopyToggles;
}): "in_image" | "no_text" {
  const hasHeadline = input.headline.trim().length > 0;
  const hasSubhead = input.copyToggles.useSubcopy && input.subhead.trim().length > 0;
  const hasCta = input.copyToggles.useCTA && input.cta.trim().length > 0;
  const hasExtra =
    input.copyToggles.useBadge &&
    input.extraTexts.some((item) => typeof item.value === "string" && item.value.trim().length > 0);

  return hasHeadline || hasSubhead || hasCta || hasExtra ? "in_image" : "no_text";
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = src;
  });
}

export default function StudioDirectWorkbench() {
  const fallbackModels = getPricedModelCatalog().map((model) => ({
    ...model,
    balance: 0,
  }));

  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [uploadingAsset, setUploadingAsset] = useState<UploadAssetType | null>(null);

  const [visual, setVisual] = useState("");
  const [headline, setHeadline] = useState("");
  const [subhead, setSubhead] = useState("");
  const [cta, setCta] = useState("");
  const [negative, setNegative] = useState("");
  const [extraTexts, setExtraTexts] = useState<ExtraText[]>([]);
  const [copyToggles, setCopyToggles] = useState<CopyToggles>(DEFAULT_COPY_TOGGLES);
  const [textStyle, setTextStyle] = useState<TextStyleControls>(DEFAULT_TEXT_STYLE);
  const [productName, setProductName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5" | "9:16">("1:1");
  const [layoutMode] = useState<"fixed_overlay" | "in_image">("in_image");
  const [slots, setSlots] = useState<TextSlot[]>(() => createDefaultSlots("1:1"));
  const [layoutLocked, setLayoutLocked] = useState(true);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [slotPointerState, setSlotPointerState] = useState<SlotPointerState | null>(null);

  const [models, setModels] = useState<CreditModel[]>(fallbackModels);
  const [selectedModelId, setSelectedModelId] = useState<string>(fallbackModels[0]?.id || "");

  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DirectGenerateResponse["generation"] | null>(null);
  const [resultProjectId, setResultProjectId] = useState<string | null>(null);
  const [composedPreviewUrl, setComposedPreviewUrl] = useState<string | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === selectedModelId) ?? null,
    [models, selectedModelId],
  );

  const effectiveTextMode = useMemo(
    () =>
      inferDirectTextMode({
        headline,
        subhead,
        cta,
        extraTexts,
        copyToggles,
      }),
    [headline, subhead, cta, extraTexts, copyToggles],
  );

  const textWarnings = useMemo(() => {
    if (effectiveTextMode !== "in_image") return [];
    const warnings: string[] = [];
    if (headline.trim().length > 18) {
      warnings.push("헤드카피가 18자를 초과해 가독성이 떨어질 수 있습니다.");
    }
    if (copyToggles.useCTA && cta.trim().length > 12) {
      warnings.push("CTA가 12자를 초과해 성공률이 떨어질 수 있습니다.");
    }
    return warnings;
  }, [headline, cta, effectiveTextMode, copyToggles.useCTA]);

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

  async function ensureAssetUrl(
    file: File | null,
    existingUrl: string,
    assetType: UploadAssetType,
  ): Promise<string> {
    if (existingUrl) return existingUrl;
    if (!file) return "";
    const uploadedUrl = await uploadStudioAsset(file, assetType);
    if (assetType === "reference") {
      setReferenceImageUrl(uploadedUrl);
    } else {
      setProductImageUrl(uploadedUrl);
    }
    return uploadedUrl;
  }

  function toggleGlobalLock(nextLocked: boolean) {
    setLayoutLocked(nextLocked);
    setSlots((prev) => prev.map((slot) => ({ ...slot, locked: nextLocked })));
  }

  function resetLayout() {
    const next = createDefaultSlots(aspectRatio).map((slot) => ({
      ...slot,
      locked: layoutLocked,
    }));
    setSlots(next);
  }

  function beginSlotEdit(
    event: ReactPointerEvent<HTMLDivElement>,
    slot: TextSlot,
    mode: "move" | "resize",
  ) {
    if (layoutMode !== "fixed_overlay" || layoutLocked || slot.locked) {
      return;
    }
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setSlotPointerState({
      slotId: slot.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: {
        x: slot.x,
        y: slot.y,
        w: slot.w,
        h: slot.h,
      },
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    });
  }

  useEffect(() => {
    if (!slotPointerState) return;
    const pointerState = slotPointerState;

    function clearPointerState() {
      setSlotPointerState(null);
    }

    function onPointerMove(event: PointerEvent) {
      const dx = (event.clientX - pointerState.startX) / pointerState.canvasWidth;
      const dy = (event.clientY - pointerState.startY) / pointerState.canvasHeight;

      setSlots((prev) =>
        prev.map((slot) => {
          if (slot.id !== pointerState.slotId) return slot;
          if (layoutLocked || slot.locked) return slot;

          if (pointerState.mode === "move") {
            const x = Math.min(Math.max(pointerState.origin.x + dx, 0), 1 - pointerState.origin.w);
            const y = Math.min(Math.max(pointerState.origin.y + dy, 0), 1 - pointerState.origin.h);
            return { ...slot, x, y };
          }

          const w = Math.min(
            1 - pointerState.origin.x,
            Math.max(0.08, pointerState.origin.w + dx),
          );
          const h = Math.min(
            1 - pointerState.origin.y,
            Math.max(0.08, pointerState.origin.h + dy),
          );
          return {
            ...slot,
            w: clamp01(w),
            h: clamp01(h),
          };
        }),
      );
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", clearPointerState);
    window.addEventListener("pointercancel", clearPointerState);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", clearPointerState);
      window.removeEventListener("pointercancel", clearPointerState);
    };
  }, [layoutLocked, slotPointerState]);

  async function onGenerate() {
    if (!selectedModel) {
      setError("모델을 선택해 주세요.");
      return;
    }
    if (!visual.trim() || !headline.trim() || (copyToggles.useCTA && !cta.trim())) {
      setError(
        copyToggles.useCTA
          ? "비주얼, 헤드카피, CTA는 필수입니다."
          : "비주얼과 헤드카피는 필수입니다.",
      );
      return;
    }
    if (selectedModel.balance < selectedModel.price.creditsRequired) {
      setError(
        `크레딧이 부족합니다. 현재 ${selectedModel.balance}크레딧, 필요 ${selectedModel.price.creditsRequired}크레딧입니다.`,
      );
      return;
    }

    setGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const uploadedReferenceImageUrl = await ensureAssetUrl(
        referenceFile,
        referenceImageUrl,
        "reference",
      );
      const uploadedProductImageUrl = await ensureAssetUrl(
        productFile,
        productImageUrl,
        "product",
      );

      const payload = await authFetchJson<DirectGenerateResponse>("/api/studio/direct/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referenceImageUrl: uploadedReferenceImageUrl || undefined,
          productImageUrl: uploadedProductImageUrl || undefined,
          productName: productName.trim() || undefined,
          imageModelId: selectedModel.id,
          aspectRatio,
          textMode: effectiveTextMode,
          visual: visual.trim(),
          headline: headline.trim(),
          subhead: copyToggles.useSubcopy ? subhead.trim() : "",
          cta: copyToggles.useCTA ? cta.trim() : "",
          negative: negative.trim(),
          extraTexts: extraTexts
            .map((item) => ({ label: item.label.trim(), value: item.value.trim() }))
            .filter((item) => item.value.length > 0),
          copyToggles,
          textStyle,
        }),
      });

      setResult(payload.generation);
      setResultProjectId(payload.projectId);
      setMessage(`직접 생성이 완료되었습니다. ${payload.creditsUsed}크레딧이 차감되었습니다.`);
      await reloadCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "직접 생성에 실패했습니다.");
      await reloadCredits().catch(() => undefined);
    } finally {
      setGenerating(false);
    }
  }

  async function downloadRawPng() {
    if (!result) return;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const response = await fetch(`/api/studio/generations/${result.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("다운로드 실패");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `makedoc-direct-${result.id}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(result.imageUrl, "_blank");
    }
  }

  async function composeOverlayImageBlob(imageUrl: string): Promise<Blob> {
    const image = await loadImageElement(imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1080;
    canvas.height = image.naturalHeight || 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("캔버스 컨텍스트를 만들지 못했습니다.");
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const texts = {
      headline,
      subhead,
      cta,
      extraTexts,
    };

    for (const slot of slots) {
      const value = slotText(slot.role, texts, copyToggles);
      if (!value) continue;

      const x = slot.x * canvas.width;
      const y = slot.y * canvas.height;
      const w = slot.w * canvas.width;
      const h = slot.h * canvas.height;
      const pad = Math.max(8, Math.min(w, h) * 0.08);

      if (slot.role === "cta") {
        drawRoundedRect(ctx, x, y, w, h, Math.min(w, h) * 0.45);
        ctx.fillStyle = "#D6FF4F";
        ctx.fill();

        const fit = fitTextInBox({
          ctx,
          text: value,
          maxWidth: w - pad * 2,
          maxHeight: h - pad * 2,
          maxLines: 1,
          fontWeight: 800,
        });

        ctx.font = `800 ${fit.fontSize}px "Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif`;
        ctx.fillStyle = "#0B0B0C";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(value, x + w / 2, y + h / 2);
        continue;
      }

      if (slot.role === "badge") {
        drawRoundedRect(ctx, x, y, w, h, Math.min(w, h) * 0.4);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
      }

      const fit = fitTextInBox({
        ctx,
        text: value,
        maxWidth: w - pad * 2,
        maxHeight: h - pad * 2,
        maxLines: slot.maxLines,
        fontWeight: slot.role === "headline" ? 800 : 650,
      });

      ctx.font = `${slot.role === "headline" ? 800 : 650} ${fit.fontSize}px "Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif`;
      ctx.textAlign = slot.align === "center" ? "center" : "left";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, fit.fontSize * 0.12);
      ctx.strokeStyle = slot.role === "badge" ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.45)";
      ctx.fillStyle = slot.role === "badge" ? "#0B0B0C" : "#F5F5F0";

      fit.lines.forEach((line, index) => {
        const ty = y + pad + index * fit.lineHeight;
        const tx = slot.align === "center" ? x + w / 2 : x + pad;
        if (slot.role !== "badge") {
          ctx.strokeText(line, tx, ty);
        }
        ctx.fillText(line, tx, ty);
      });
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((target) => {
        if (!target) {
          reject(new Error("이미지 합성 실패"));
          return;
        }
        resolve(target);
      }, "image/png");
    });
  }

  useEffect(() => {
    if (!result || layoutMode !== "fixed_overlay") {
      setComposedPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let disposed = false;
    const timer = window.setTimeout(() => {
      void composeOverlayImageBlob(result.imageUrl)
        .then((blob) => {
          if (disposed) return;
          const nextUrl = URL.createObjectURL(blob);
          setComposedPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return nextUrl;
          });
        })
        .catch(() => {
          if (disposed) return;
          setComposedPreviewUrl(null);
        });
    }, 120);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [layoutMode, result?.imageUrl, headline, subhead, cta, extraTexts, slots]);

  useEffect(() => {
    return () => {
      setComposedPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  async function downloadComposedPng() {
    if (!result) return;

    try {
      const blob = await composeOverlayImageBlob(result.imageUrl);

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `makedoc-direct-composed-${result.id}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "텍스트 합성 다운로드에 실패했습니다.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-10">
      <div className="rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_22px_50px_-35px_rgba(0,0,0,0.35)]">
        <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
          <div>
            <h1 className="text-2xl font-semibold text-[#0B0B0C]">직접 입력 생성</h1>
            <p className="mt-1 text-sm text-black/60">
              분석 없이 바로 생성합니다. 레퍼런스/제품 이미지는 선택입니다.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="block rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-3 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    setReferenceFile(event.target.files?.[0] ?? null);
                    setReferenceImageUrl("");
                  }}
                />
                <span className="text-xs font-medium text-black/65">
                  {referenceFile ? `${referenceFile.name} 선택됨` : "레퍼런스 이미지 (선택)"}
                </span>
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

            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="제품명 (선택)"
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
            <label className="space-y-1">
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
                    {model.name} | 잔액 {model.balance} | 판매가 ₩{formatKrw(model.price.sellKrw)} | 차감{" "}
                    {model.price.creditsRequired}cr
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-black/65">
                비율
                <select
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value as "1:1" | "4:5" | "9:16")}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="1:1">1:1</option>
                  <option value="4:5">4:5</option>
                  <option value="9:16">9:16</option>
                </select>
              </label>
              <div className="text-xs font-medium text-black/65">
                텍스트 생성
                <div className="mt-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70">
                  {effectiveTextMode === "in_image"
                    ? "입력된 카피 포함"
                    : "카피 입력 없음 (텍스트 미생성)"}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-tour="studio-direct-generate"
              onClick={() => void onGenerate()}
              disabled={generating || Boolean(uploadingAsset)}
              className="mt-3 w-full rounded-full bg-[#0B0B0C] px-4 py-2.5 text-sm font-semibold text-[#D6FF4F] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {uploadingAsset ? "이미지 업로드 중..." : generating ? "생성 중..." : "바로 생성하기"}
            </button>
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
      {textWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ul className="list-disc pl-4">
            {textWarnings.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
        <section data-tour="studio-direct-prompt" className="rounded-[28px] border border-black/10 bg-white p-4">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">프롬프트 직접 입력</h2>
          <div className="mt-3 space-y-2">
            <textarea
              value={visual}
              onChange={(event) => setVisual(event.target.value)}
              placeholder="비주얼 설명 (필수): 장면/구도/스타일/연출"
              rows={4}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="헤드카피 (필수)"
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              value={subhead}
              onChange={(event) => setSubhead(event.target.value)}
              disabled={!copyToggles.useSubcopy}
              placeholder={copyToggles.useSubcopy ? "서브카피" : "서브카피 비활성화됨"}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm disabled:bg-black/[0.04]"
            />
            <input
              value={cta}
              onChange={(event) => setCta(event.target.value)}
              disabled={!copyToggles.useCTA}
              placeholder={copyToggles.useCTA ? "CTA (필수)" : "CTA 비활성화됨"}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm disabled:bg-black/[0.04]"
            />
            <div className="rounded-xl border border-black/10 bg-black/[0.02] p-2.5 text-xs">
              <p className="font-semibold text-black/75">텍스트 슬롯 토글</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { key: "useSubcopy", label: "서브카피" },
                  { key: "useCTA", label: "CTA 버튼" },
                  { key: "useBadge", label: "뱃지" },
                ].map((toggle) => (
                  <label
                    key={toggle.key}
                    className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[11px] font-medium text-black/70"
                  >
                    <input
                      type="checkbox"
                      checked={copyToggles[toggle.key as keyof CopyToggles]}
                      onChange={(event) =>
                        setCopyToggles((prev) => ({
                          ...prev,
                          [toggle.key]: event.target.checked,
                        }))
                      }
                    />
                    {toggle.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-black/10 bg-black/[0.02] p-2.5 text-xs">
              <p className="font-semibold text-black/75">텍스트 역할별 스타일</p>
              <p className="mt-0.5 text-[11px] text-black/55">
                헤드카피/서브카피/CTA/뱃지를 구분해서 글꼴과 효과를 지정합니다.
              </p>
              <div className="mt-2 space-y-2">
                {([
                  { key: "headline", label: "헤드카피" },
                  { key: "subhead", label: "서브카피" },
                  { key: "cta", label: "CTA" },
                  { key: "badge", label: "뱃지" },
                ] as const).map((slot) => {
                  const disabled =
                    (slot.key === "subhead" && !copyToggles.useSubcopy) ||
                    (slot.key === "cta" && !copyToggles.useCTA) ||
                    (slot.key === "badge" && !copyToggles.useBadge);
                  return (
                    <div
                      key={slot.key}
                      className="grid grid-cols-[82px,1fr,1fr] gap-1.5 rounded-lg border border-black/10 bg-white p-1.5"
                    >
                      <p className="self-center text-[11px] font-semibold text-black/65">{slot.label}</p>
                      <select
                        value={textStyle[slot.key].fontTone}
                        disabled={disabled}
                        onChange={(event) =>
                          setTextStyle((prev) => ({
                            ...prev,
                            [slot.key]: {
                              ...prev[slot.key],
                              fontTone: event.target.value as FontTone,
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
                        value={textStyle[slot.key].effectTone}
                        disabled={disabled}
                        onChange={(event) =>
                          setTextStyle((prev) => ({
                            ...prev,
                            [slot.key]: {
                              ...prev[slot.key],
                              effectTone: event.target.value as EffectTone,
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
            <textarea
              value={negative}
              onChange={(event) => setNegative(event.target.value)}
              placeholder="네거티브 프롬프트 (선택)"
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
                      setNegative((prev) =>
                        prev.includes(example)
                          ? prev
                          : prev.trim().length > 0
                            ? `${prev}, ${example}`
                            : example,
                      )
                    }
                    className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/70 transition hover:-translate-y-0.5"
                  >
                    + {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0B0B0C]">추가 텍스트</p>
              <button
                type="button"
                disabled={!copyToggles.useBadge}
                onClick={() => setExtraTexts((prev) => [...prev, createExtraText()])}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black disabled:bg-black/[0.04] disabled:text-black/35"
              >
                + 텍스트 칸 추가
              </button>
            </div>
            {!copyToggles.useBadge ? (
              <p className="mt-2 text-xs text-black/50">뱃지 토글이 꺼져 있어 추가 텍스트가 비활성화됩니다.</p>
            ) : extraTexts.length === 0 ? (
              <p className="mt-2 text-xs text-black/50">필요한 문구가 있으면 추가하세요.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {extraTexts.map((item) => (
                  <div key={item.id} className="grid gap-2 sm:grid-cols-[0.35fr,1fr,auto]">
                    <input
                      value={item.label}
                      onChange={(event) =>
                        setExtraTexts((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="라벨"
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                    />
                    <input
                      value={item.value}
                      onChange={(event) =>
                        setExtraTexts((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id ? { ...entry, value: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="텍스트 내용"
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setExtraTexts((prev) => prev.filter((entry) => entry.id !== item.id))
                      }
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/70"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white p-4">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">생성 결과</h2>

          <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]">
            <div ref={previewRef} className="relative aspect-square w-full">
              {result ? (
                <img
                  src={result.imageUrl}
                  alt="직접 생성 결과"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-black/45">
                  생성 후 결과가 표시됩니다.
                </div>
              )}
            </div>
          </div>

          {result && (
            <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-xs text-black/65">
              <p>생성 시각: {formatDateTime(result.createdAt)}</p>
              <p className="mt-1">모델: {result.imageModelId}</p>
              <p className="mt-1">판매가 기준: ₩{formatKrw(result.sellKrw)}</p>
              {result.textFidelityScore !== null && (
                <p className="mt-1">텍스트 일치도: {result.textFidelityScore}점</p>
              )}
              <div className="mt-2 rounded-xl border border-black/10 bg-white p-2 text-[11px] text-black/70">
                <p className="font-semibold text-black/75">생성 텍스트 구조</p>
                <p className="mt-1">헤드카피: {headline.trim() || "-"}</p>
                <p className="mt-0.5">
                  서브카피: {copyToggles.useSubcopy ? subhead.trim() || "-" : "(비활성화)"}
                </p>
                <p className="mt-0.5">CTA: {copyToggles.useCTA ? cta.trim() || "-" : "(비활성화)"}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={result.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  새 탭 보기
                </a>
                <button
                  type="button"
                  onClick={() => void downloadRawPng()}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  원본 다운로드
                </button>
                {resultProjectId && (
                  <Link
                    href={`/project/${resultProjectId}`}
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                  >
                    프로젝트 보기
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
