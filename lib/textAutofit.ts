export type MeasureTextFn = (text: string) => number;

export type AutofitInput = {
  text: string;
  boxWidthPx: number;
  boxHeightPx: number;
  paddingPx: number;
  maxLines: number;
  minFontSizePx: number;
  maxFontSizePx?: number;
  lineHeight?: number; // multiplier
  measureForFont: (fontSizePx: number) => MeasureTextFn;
};

export type AutofitResult = {
  fontSizePx: number;
  lineHeightPx: number;
  lines: string[];
  belowMin: boolean;
};

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasSpaces(input: string): boolean {
  return /\s/.test(input);
}

function wrapTokensToLines(params: {
  tokens: string[];
  maxWidthPx: number;
  measure: MeasureTextFn;
  joiner: string;
}): string[] {
  const { tokens, maxWidthPx, measure, joiner } = params;
  const lines: string[] = [];
  let current = "";

  for (const token of tokens) {
    const next = current ? `${current}${joiner}${token}` : token;
    if (!current) {
      current = token;
      continue;
    }
    if (measure(next) <= maxWidthPx) {
      current = next;
      continue;
    }
    lines.push(current);
    current = token;
  }

  if (current) lines.push(current);
  return lines;
}

function wrapParagraph(params: {
  paragraph: string;
  maxWidthPx: number;
  measure: MeasureTextFn;
}): string[] {
  const { paragraph, maxWidthPx, measure } = params;
  const trimmed = paragraph.trim();
  if (!trimmed) return [""];

  // 1) Word-first wrapping (space-separated).
  if (hasSpaces(trimmed)) {
    const tokens = trimmed.split(/\s+/g).filter(Boolean);
    const wordLines = wrapTokensToLines({
      tokens,
      maxWidthPx,
      measure,
      joiner: " ",
    });

    // If any line still overflows (very long token), fall back to char wrapping for that line.
    const finalLines: string[] = [];
    for (const line of wordLines) {
      if (measure(line) <= maxWidthPx) {
        finalLines.push(line);
        continue;
      }
      const chars = [...line];
      finalLines.push(
        ...wrapTokensToLines({
          tokens: chars,
          maxWidthPx,
          measure,
          joiner: "",
        }),
      );
    }
    return finalLines.length ? finalLines : [trimmed];
  }

  // 2) No spaces: char wrapping (Korean-friendly).
  const chars = [...trimmed];
  return wrapTokensToLines({
    tokens: chars,
    maxWidthPx,
    measure,
    joiner: "",
  });
}

export function wrapText(params: {
  text: string;
  maxWidthPx: number;
  measure: MeasureTextFn;
}): string[] {
  const normalized = normalizeWhitespace(params.text);
  if (!normalized) return [""];
  const lines = wrapParagraph({
    paragraph: normalized,
    maxWidthPx: params.maxWidthPx,
    measure: params.measure,
  });
  return lines.length ? lines : [normalized];
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function autofitTextToBox(input: AutofitInput): AutofitResult {
  const text = normalizeWhitespace(input.text);
  const lineHeight = input.lineHeight ?? 1.15;

  const innerW = Math.max(input.boxWidthPx - input.paddingPx * 2, 1);
  const innerH = Math.max(input.boxHeightPx - input.paddingPx * 2, 1);

  const maxFontFromHeight = Math.floor(innerH / Math.max(1, input.maxLines) / lineHeight);
  const maxFont = clampNumber(
    input.maxFontSizePx ?? maxFontFromHeight,
    8,
    Math.max(8, maxFontFromHeight),
  );

  const minFontSoft = clampNumber(input.minFontSizePx, 8, 999);
  const minFontHard = 10; // last-resort for "never overflow" requirement.

  for (let fontSize = maxFont; fontSize >= minFontHard; fontSize -= 1) {
    const measure = input.measureForFont(fontSize);
    const lines = wrapText({ text, maxWidthPx: innerW, measure });
    const fitsLineCount = lines.length <= input.maxLines;
    const heightPx = lines.length * fontSize * lineHeight;
    const fits = fitsLineCount && heightPx <= innerH;

    if (fits) {
      return {
        fontSizePx: fontSize,
        lineHeightPx: fontSize * lineHeight,
        lines,
        belowMin: fontSize < minFontSoft,
      };
    }
  }

  // Fallback: keep shrinking below the soft/hard minimum to avoid overflow.
  for (let fontSize = minFontHard - 1; fontSize >= 1; fontSize -= 1) {
    const measure = input.measureForFont(fontSize);
    const lines = wrapText({ text, maxWidthPx: innerW, measure });
    const fitsLineCount = lines.length <= input.maxLines;
    const heightPx = lines.length * fontSize * lineHeight;
    if (fitsLineCount && heightPx <= innerH) {
      return {
        fontSizePx: fontSize,
        lineHeightPx: fontSize * lineHeight,
        lines,
        belowMin: true,
      };
    }
  }

  // Last resort: return smallest font size with full text (no truncation).
  const fontSize = 1;
  const measure = input.measureForFont(fontSize);
  return {
    fontSizePx: fontSize,
    lineHeightPx: fontSize * lineHeight,
    lines: wrapText({ text, maxWidthPx: innerW, measure }),
    belowMin: true,
  };
}
