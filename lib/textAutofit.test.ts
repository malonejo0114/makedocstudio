import { describe, expect, it } from "vitest";

import { autofitTextToBox } from "@/lib/textAutofit";

describe("textAutofit", () => {
  it("fits Korean text into a box without overflow", () => {
    const boxWidthPx = 520;
    const boxHeightPx = 180;
    const paddingPx = 24;
    const maxLines = 2;
    const minFontSizePx = 28;
    const lineHeight = 1.15;

    const innerW = boxWidthPx - paddingPx * 2;
    const innerH = boxHeightPx - paddingPx * 2;

    const fit = autofitTextToBox({
      text: "차분함 속에 숨겨진 압도적 블랙의 향",
      boxWidthPx,
      boxHeightPx,
      paddingPx,
      maxLines,
      minFontSizePx,
      lineHeight,
      measureForFont: (fontSizePx) => (candidate) =>
        candidate.length * fontSizePx * 0.62,
    });

    expect(fit.lines.length).toBeLessThanOrEqual(maxLines);
    expect(fit.lines.length * fit.fontSizePx * lineHeight).toBeLessThanOrEqual(innerH + 0.001);

    for (const line of fit.lines) {
      const width = line.length * fit.fontSizePx * 0.62;
      expect(width).toBeLessThanOrEqual(innerW + 0.001);
    }
  });
});

