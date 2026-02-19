import { describe, expect, it } from "vitest";

import { runBriefDoctor } from "@/lib/briefDoctor";

describe("briefDoctor", () => {
  it("flags missing required fields", () => {
    const out = runBriefDoctor({
      objective: "",
      audience: "",
      usp: "",
      cta: "",
    });
    expect(out.score).toBeLessThan(60);
    expect(out.warnings.join(" ")).toMatch(/목표/);
    expect(out.warnings.join(" ")).toMatch(/타겟/);
    expect(out.warnings.join(" ")).toMatch(/USP/);
    expect(out.warnings.join(" ")).toMatch(/CTA/);
  });

  it("detects objective/CTA mismatch", () => {
    const out = runBriefDoctor({
      objective: "무료 상담 신청 늘리기",
      audience: "30대 직장인",
      usp: "10분 내 상담 확정",
      cta: "지금 구매",
    });
    expect(out.warnings.join(" ")).toMatch(/CTA/);
  });
});

