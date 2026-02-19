export type Rgb = { r: number; g: number; b: number };

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

export function rgbToHex(rgb: Rgb): string {
  const r = clampByte(rgb.r).toString(16).padStart(2, "0");
  const g = clampByte(rgb.g).toString(16).padStart(2, "0");
  const b = clampByte(rgb.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function dist2(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function isNearWhite(p: Rgb): boolean {
  return p.r + p.g + p.b >= 740;
}

export function extractDominantColorsFromRgba(
  rgba: Uint8ClampedArray,
  opts?: { k?: number; maxSamples?: number },
): string[] {
  const k = Math.min(Math.max(opts?.k ?? 3, 1), 6);
  const maxSamples = Math.min(Math.max(opts?.maxSamples ?? 2400, 200), 20_000);

  const pixels: Rgb[] = [];
  const step = Math.max(Math.floor((rgba.length / 4) / maxSamples), 1);

  for (let i = 0, p = 0; i < rgba.length; i += 4 * step) {
    const a = rgba[i + 3];
    if (a < 200) continue;
    const rgb = { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] };
    if (isNearWhite(rgb)) continue; // ignore common logo white background
    pixels.push(rgb);
    p += 1;
    if (p >= maxSamples) break;
  }

  if (pixels.length === 0) return [];

  // Initialize centroids with the first K unique colors (stable).
  const centroids: Rgb[] = [];
  for (const px of pixels) {
    if (centroids.some((c) => dist2(c, px) < 10)) continue;
    centroids.push({ ...px });
    if (centroids.length >= k) break;
  }
  while (centroids.length < k) centroids.push({ ...pixels[centroids.length % pixels.length] });

  const assignments = new Array(pixels.length).fill(0);
  const counts = new Array(k).fill(0);

  for (let iter = 0; iter < 8; iter += 1) {
    counts.fill(0);
    const sumR = new Array(k).fill(0);
    const sumG = new Array(k).fill(0);
    const sumB = new Array(k).fill(0);

    // Assign step
    for (let i = 0; i < pixels.length; i += 1) {
      const px = pixels[i];
      let best = 0;
      let bestD = Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c += 1) {
        const d = dist2(px, centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assignments[i] = best;
      counts[best] += 1;
      sumR[best] += px.r;
      sumG[best] += px.g;
      sumB[best] += px.b;
    }

    // Update step
    for (let c = 0; c < k; c += 1) {
      const n = counts[c];
      if (n <= 0) continue;
      centroids[c] = {
        r: sumR[c] / n,
        g: sumG[c] / n,
        b: sumB[c] / n,
      };
    }
  }

  const ranked = centroids
    .map((c, idx) => ({ c, n: counts[idx] ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .map((x) => rgbToHex(x.c));

  // Deduplicate near-equal colors after quantization.
  const out: string[] = [];
  for (const hex of ranked) {
    if (out.includes(hex)) continue;
    out.push(hex);
    if (out.length >= k) break;
  }
  return out;
}

// Browser helper: extract from a data URL (png/jpg/svg). Runs only in client.
export async function extractDominantColorsFromDataUrl(
  dataUrl: string,
  opts?: { k?: number; sampleSizePx?: number },
): Promise<string[]> {
  if (typeof window === "undefined") return [];

  const sampleSize = Math.min(Math.max(opts?.sampleSizePx ?? 96, 24), 256);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Failed to load image for color extraction."));
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  // Contain draw
  const scale = Math.min(sampleSize / img.width, sampleSize / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (sampleSize - drawW) / 2;
  const dy = (sampleSize - drawH) / 2;
  ctx.clearRect(0, 0, sampleSize, sampleSize);
  ctx.drawImage(img, dx, dy, drawW, drawH);

  const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  return extractDominantColorsFromRgba(data, { k: opts?.k ?? 3 });
}

