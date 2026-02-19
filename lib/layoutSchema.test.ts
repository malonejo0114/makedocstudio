import { describe, expect, it } from "vitest";

import { denormalizeBox, normalizeBox } from "@/lib/layoutSchema";

describe("layoutSchema normalize/denormalize", () => {
  it("round-trips a valid px box", () => {
    const canvas = { width: 1080, height: 1350 };
    const px = { x: 120, y: 210, w: 420, h: 300 };
    const norm = normalizeBox(px, canvas);
    expect(norm[0]).toBeCloseTo(px.x / canvas.width, 6);
    expect(norm[1]).toBeCloseTo(px.y / canvas.height, 6);
    expect(norm[2]).toBeCloseTo(px.w / canvas.width, 6);
    expect(norm[3]).toBeCloseTo(px.h / canvas.height, 6);

    const px2 = denormalizeBox(norm, canvas);
    expect(px2.x).toBeCloseTo(px.x, 6);
    expect(px2.y).toBeCloseTo(px.y, 6);
    expect(px2.w).toBeCloseTo(px.w, 6);
    expect(px2.h).toBeCloseTo(px.h, 6);
  });
});

