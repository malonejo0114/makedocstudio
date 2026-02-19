import { describe, expect, it } from "vitest";

import { extractDominantColorsFromRgba } from "@/lib/colorExtract";

describe("colorExtract", () => {
  it("extracts dominant colors from RGBA pixels", () => {
    const pixels = new Uint8ClampedArray(4 * 1000);
    for (let i = 0; i < 700; i += 1) {
      pixels[i * 4 + 0] = 255;
      pixels[i * 4 + 1] = 0;
      pixels[i * 4 + 2] = 0;
      pixels[i * 4 + 3] = 255;
    }
    for (let i = 700; i < 1000; i += 1) {
      pixels[i * 4 + 0] = 0;
      pixels[i * 4 + 1] = 0;
      pixels[i * 4 + 2] = 255;
      pixels[i * 4 + 3] = 255;
    }

    const out = extractDominantColorsFromRgba(pixels, { k: 2, maxSamples: 1000 });
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0]).toBe("#ff0000");
    expect(out).toContain("#0000ff");
  });
});

