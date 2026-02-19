import { describe, expect, it } from "vitest";

import { constraintsForAspectRatio, generateCopyVariants } from "@/lib/copyGenerator";

describe("copyGenerator", () => {
  it("enforces length constraints (1:1)", () => {
    const c = constraintsForAspectRatio("1:1");
    const out = generateCopyVariants({
      aspectRatio: "1:1",
      objective: "구매 전환",
      audience: "민감성 피부",
      usp: "단 7일, 피부 결이 달라짐",
      offer: "첫 구매 10% 할인",
      proof: "평점 4.9 (2,312명)",
      preferredCta: "지금 구매하기",
    });

    expect(out.headlines.length).toBeGreaterThan(0);
    expect(out.subs.length).toBeGreaterThan(0);
    expect(out.ctas.length).toBeGreaterThan(0);

    for (const h of out.headlines) expect(h.length).toBeLessThanOrEqual(c.headlineMaxChars);
    for (const s of out.subs) expect(s.length).toBeLessThanOrEqual(c.subMaxChars);
    for (const cta of out.ctas) expect(cta.length).toBeLessThanOrEqual(c.ctaMaxChars);
  });
});

