import { describe, expect, it } from "vitest";

import sharp from "sharp";

import { createDefaultLayout } from "@/lib/layoutSchema";
import { renderGuideOverlayPngBase64 } from "@/lib/overlayExport";

describe("overlayExport", () => {
  it("renders a transparent PNG with correct dimensions", async () => {
    const layout = createDefaultLayout("1:1");
    const out = await renderGuideOverlayPngBase64(layout, { showSafeZone: true });
    const buffer = Buffer.from(out.base64, "base64");

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buffer.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(layout.canvas.width);
    expect(meta.height).toBe(layout.canvas.height);
    expect(meta.hasAlpha).toBe(true);
  });
});

