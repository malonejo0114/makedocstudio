"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TextSeeds = {
  headline?: string;
  subText?: string;
  cta?: string;
};

type AdCanvasEditorProps = {
  imageUrl: string;
  width: number;
  height: number;
  initialTexts: TextSeeds;
  onApplyImage?: (dataUrl: string) => void;
};

type FabricNS = {
  Canvas: any;
  Textbox: any;
  Image?: any;
  FabricImage?: any;
};

function getFabricNamespace(module: any): FabricNS {
  return (module?.fabric ?? module) as FabricNS;
}

type TextKey = "headline" | "subText" | "cta";

function getTextDefaults(key: TextKey, width: number, height: number) {
  if (key === "headline") {
    return {
      top: Math.round(height * 0.08),
      fontSize: Math.round(width * 0.06),
      fill: "#111111",
      fontWeight: "700",
    };
  }

  if (key === "subText") {
    return {
      top: Math.round(height * 0.2),
      fontSize: Math.round(width * 0.035),
      fill: "#222222",
      fontWeight: "500",
    };
  }

  return {
    top: Math.round(height * 0.82),
    fontSize: Math.round(width * 0.037),
    fill: "#ffffff",
    fontWeight: "700",
  };
}

function upsertTextObject(params: {
  canvas: any;
  fabricNs: FabricNS;
  key: TextKey;
  value: string;
  width: number;
  height: number;
}) {
  const { canvas, fabricNs, key, value, width, height } = params;
  const trimmed = value.trim();
  const existing = canvas.getObjects().find((obj: any) => obj?.dataKey === key);

  if (!trimmed) {
    if (existing) {
      canvas.remove(existing);
    }
    return;
  }

  const defaults = getTextDefaults(key, width, height);

  if (existing) {
    existing.set("text", trimmed);
    canvas.renderAll();
    return;
  }

  const textbox = new fabricNs.Textbox(trimmed, {
    left: Math.round(width * 0.08),
    top: defaults.top,
    width: Math.round(width * 0.84),
    fontSize: defaults.fontSize,
    fill: defaults.fill,
    fontWeight: defaults.fontWeight,
    lineHeight: 1.18,
    editable: true,
    backgroundColor: "rgba(255,255,255,0.0)",
  });
  (textbox as any).dataKey = key;

  if (key === "cta") {
    textbox.set({
      backgroundColor: "#0f766e",
      padding: 10,
    });
  }

  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();
}

async function loadImageObject(fabricNs: FabricNS, imageUrl: string): Promise<any> {
  const ImageClass = fabricNs.FabricImage ?? fabricNs.Image;
  if (!ImageClass) {
    throw new Error("Fabric Image class is not available.");
  }

  if (typeof ImageClass.fromURL === "function") {
    try {
      const maybePromise = ImageClass.fromURL(imageUrl, {
        crossOrigin: "anonymous",
      });
      if (maybePromise?.then) {
        return await maybePromise;
      }
    } catch {
      // Fallback to callback signature below.
    }

    return await new Promise((resolve, reject) => {
      try {
        ImageClass.fromURL(
          imageUrl,
          (img: any) => {
            if (!img) {
              reject(new Error("Failed to create image object."));
              return;
            }
            resolve(img);
          },
          { crossOrigin: "anonymous" },
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  throw new Error("Fabric fromURL is not available.");
}

export default function AdCanvasEditor({
  imageUrl,
  width,
  height,
  initialTexts,
  onApplyImage,
}: AdCanvasEditorProps) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricNsRef = useRef<FabricNS | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<{
    fontSize: number;
    fill: string;
    bold: boolean;
  }>({
    fontSize: 56,
    fill: "#111111",
    bold: true,
  });

  const [headline, setHeadline] = useState(initialTexts.headline ?? "");
  const [subText, setSubText] = useState(initialTexts.subText ?? "");
  const [cta, setCta] = useState(initialTexts.cta ?? "");

  useEffect(() => {
    setHeadline(initialTexts.headline ?? "");
    setSubText(initialTexts.subText ?? "");
    setCta(initialTexts.cta ?? "");
  }, [initialTexts.headline, initialTexts.subText, initialTexts.cta]);

  useEffect(() => {
    let cancelled = false;
    let localCanvas: any = null;
    setReady(false);
    setError(null);

    async function setup() {
      if (!canvasElementRef.current) {
        return;
      }

      const module = await import("fabric");
      if (cancelled || !canvasElementRef.current) {
        return;
      }

      const fabricNs = getFabricNamespace(module);
      fabricNsRef.current = fabricNs;
      const elementWithFabric = canvasElementRef.current as HTMLCanvasElement & {
        __fabric?: { dispose?: () => void };
      };
      if (elementWithFabric.__fabric?.dispose) {
        elementWithFabric.__fabric.dispose();
      }

      localCanvas = new fabricNs.Canvas(canvasElementRef.current, {
        width,
        height,
        preserveObjectStacking: true,
        backgroundColor: "#ffffff",
      });
      fabricCanvasRef.current = localCanvas;

      if (cancelled) {
        localCanvas.dispose();
        return;
      }

      const imageObj = await loadImageObject(fabricNs, imageUrl);
      if (cancelled) {
        localCanvas.dispose();
        return;
      }

      imageObj.set({
        selectable: false,
        evented: false,
      });

      const baseWidth =
        Number(imageObj.width) ||
        Number(imageObj?._originalElement?.naturalWidth) ||
        width;
      const baseHeight =
        Number(imageObj.height) ||
        Number(imageObj?._originalElement?.naturalHeight) ||
        height;
      const scale = Math.max(width / baseWidth, height / baseHeight);

      imageObj.set({
        scaleX: scale,
        scaleY: scale,
      });
      imageObj.left = (width - imageObj.getScaledWidth()) / 2;
      imageObj.top = (height - imageObj.getScaledHeight()) / 2;
      localCanvas.add(imageObj);
      localCanvas.sendObjectToBack(imageObj);
      upsertTextObject({
        canvas: localCanvas,
        fabricNs,
        key: "headline",
        value: headline,
        width,
        height,
      });
      upsertTextObject({
        canvas: localCanvas,
        fabricNs,
        key: "subText",
        value: subText,
        width,
        height,
      });
      upsertTextObject({
        canvas: localCanvas,
        fabricNs,
        key: "cta",
        value: cta,
        width,
        height,
      });

      const updateSelection = (obj: any) => {
        if (!obj) {
          return;
        }
        setSelectedInfo({
          fontSize: Number(obj.fontSize || 40),
          fill: String(obj.fill || "#111111"),
          bold: String(obj.fontWeight || "400") === "700",
        });
      };

      localCanvas.on("selection:created", (event: any) =>
        updateSelection(event?.selected?.[0]),
      );
      localCanvas.on("selection:updated", (event: any) =>
        updateSelection(event?.selected?.[0]),
      );
      localCanvas.on("object:modified", (event: any) =>
        updateSelection(event?.target),
      );

      localCanvas.renderAll();
      if (!cancelled) {
        setReady(true);
      }
    }

    void setup().catch((err) => {
      if (!cancelled) {
        const message = err instanceof Error ? err.message : "캔버스 초기화 실패";
        setError(message);
      }
    });

    return () => {
      cancelled = true;
      if (localCanvas) {
        localCanvas.dispose();
      }
      if (fabricCanvasRef.current === localCanvas) {
        fabricCanvasRef.current = null;
      }
      fabricNsRef.current = null;
    };
  }, [imageUrl, width, height]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabricNs = fabricNsRef.current;
    if (!canvas || !fabricNs) {
      return;
    }
    upsertTextObject({
      canvas,
      fabricNs,
      key: "headline",
      value: headline,
      width,
      height,
    });
    upsertTextObject({
      canvas,
      fabricNs,
      key: "subText",
      value: subText,
      width,
      height,
    });
    upsertTextObject({
      canvas,
      fabricNs,
      key: "cta",
      value: cta,
      width,
      height,
    });
    canvas.renderAll();
  }, [headline, subText, cta, width, height, ready]);

  const hasCanvas = useMemo(() => Boolean(fabricCanvasRef.current), [ready]);

  const onApplyTextToSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;

    active.set({
      fontSize: selectedInfo.fontSize,
      fill: selectedInfo.fill,
      fontWeight: selectedInfo.bold ? "700" : "400",
    });
    canvas.renderAll();
  };

  const onExport = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `ad-edited-${Date.now()}.png`;
    a.click();
  };

  const onApplyToResult = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });
    onApplyImage?.(dataUrl);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">후편집 캔버스</h3>
          <p className="text-xs text-slate-600">
            텍스트 객체를 드래그/리사이즈 후 스타일 수정 및 PNG 저장
          </p>
        </div>
        <div className="text-xs font-medium text-slate-500">
          Canvas: {width} x {height}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">
            헤드카피 씨드
          </span>
          <input
            type="text"
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">
            서브카피 씨드
          </span>
          <input
            type="text"
            value={subText}
            onChange={(event) => setSubText(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">CTA 씨드</span>
          <input
            type="text"
            value={cta}
            onChange={(event) => setCta(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">폰트 크기</span>
          <input
            type="number"
            min={10}
            max={240}
            value={selectedInfo.fontSize}
            onChange={(event) =>
              setSelectedInfo((prev) => ({
                ...prev,
                fontSize: Number(event.target.value) || prev.fontSize,
              }))
            }
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">폰트 색상</span>
          <input
            type="color"
            value={selectedInfo.fill}
            onChange={(event) =>
              setSelectedInfo((prev) => ({ ...prev, fill: event.target.value }))
            }
            className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-2 py-1"
          />
        </label>
        <label className="flex items-end gap-2">
          <input
            type="checkbox"
            checked={selectedInfo.bold}
            onChange={(event) =>
              setSelectedInfo((prev) => ({ ...prev, bold: event.target.checked }))
            }
          />
          <span className="text-xs font-medium text-slate-700">볼드 적용</span>
        </label>
        <button
          type="button"
          onClick={onApplyTextToSelected}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          선택 텍스트 스타일 적용
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-2">
        <canvas ref={canvasElementRef} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasCanvas}
          onClick={onExport}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          PNG 다운로드
        </button>
        <button
          type="button"
          disabled={!hasCanvas}
          onClick={onApplyToResult}
          className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
        >
          편집본을 결과 이미지로 반영
        </button>
        {!ready && (
          <span className="self-center text-xs text-slate-500">캔버스 준비 중...</span>
        )}
      </div>
    </section>
  );
}
