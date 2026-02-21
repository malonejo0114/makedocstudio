"use client";

const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_EDGE = 2048;

type OptimizeOptions = {
  maxBytes?: number;
  maxEdge?: number;
};

function replaceFileExtension(name: string, ext: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}${ext}`;
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("이미지 압축에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지 파일을 읽지 못했습니다."));
    };
    image.src = objectUrl;
  });
}

export async function optimizeImageForUpload(file: File, options: OptimizeOptions = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;

  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxBytes) return file;
  if (typeof window === "undefined" || typeof document === "undefined") return file;

  const source = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const firstWidth = Math.max(1, Math.floor(source.width * scale));
  const firstHeight = Math.max(1, Math.floor(source.height * scale));

  let canvas = createCanvas(firstWidth, firstHeight);
  let ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  let bestBlob: Blob | null = null;

  for (let pass = 0; pass < 5; pass += 1) {
    for (let quality = 0.92; quality >= 0.56; quality -= 0.08) {
      // Prefer webp for better compression on serverless payload limits.
      // Fallback to jpeg if webp fails for any reason.
      let blob: Blob | null = null;
      try {
        blob = await canvasToBlob(canvas, "image/webp", quality);
      } catch {
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
      }

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }
      if (blob.size <= maxBytes) {
        const optimizedName = replaceFileExtension(file.name, blob.type === "image/jpeg" ? ".jpg" : ".webp");
        return new File([blob], optimizedName, {
          type: blob.type,
          lastModified: Date.now(),
        });
      }
    }

    const nextWidth = Math.max(320, Math.floor(canvas.width * 0.82));
    const nextHeight = Math.max(320, Math.floor(canvas.height * 0.82));
    if (nextWidth === canvas.width && nextHeight === canvas.height) break;

    const resized = createCanvas(nextWidth, nextHeight);
    const resizedCtx = resized.getContext("2d");
    if (!resizedCtx) break;
    resizedCtx.drawImage(canvas, 0, 0, nextWidth, nextHeight);
    canvas = resized;
    ctx = resizedCtx;
  }

  if (bestBlob && bestBlob.size < file.size) {
    const optimizedName = replaceFileExtension(file.name, bestBlob.type === "image/jpeg" ? ".jpg" : ".webp");
    const optimized = new File([bestBlob], optimizedName, {
      type: bestBlob.type,
      lastModified: Date.now(),
    });
    if (optimized.size <= maxBytes) return optimized;
    throw new Error(
      `${file.name} 파일 용량이 너무 큽니다. 3MB 이하 이미지로 업로드해 주세요.`,
    );
  }

  throw new Error(
    `${file.name} 파일 용량이 너무 큽니다. 3MB 이하 이미지로 업로드해 주세요.`,
  );
}
