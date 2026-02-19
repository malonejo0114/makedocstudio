import { describe, expect, it } from "vitest";

import { computeKeywordNetInputs, extractPlaceIdFromUrl } from "@/lib/keywordNet";

describe("keywordNet helpers", () => {
  it("extractPlaceIdFromUrl parses typical place URLs", () => {
    expect(
      extractPlaceIdFromUrl("https://place.naver.com/restaurant/1234567890/home"),
    ).toBe("1234567890");
    expect(
      extractPlaceIdFromUrl("https://m.place.naver.com/restaurant/987654321/home"),
    ).toBe("987654321");
    expect(extractPlaceIdFromUrl("not a url")).toBe(null);
  });

  it("computeKeywordNetInputs is deterministic", () => {
    const a = computeKeywordNetInputs({
      storeName: "테스트매장",
      area: "성수동",
      bizType: "restaurant",
      placeUrl: "https://place.naver.com/restaurant/1234567890/home",
      device: "PC",
    });
    const b = computeKeywordNetInputs({
      storeName: "테스트매장",
      area: "성수동",
      bizType: "restaurant",
      placeUrl: "https://place.naver.com/restaurant/1234567890/home",
      device: "PC",
    });
    expect(a.cacheKey).toBe(b.cacheKey);

    const c = computeKeywordNetInputs({
      storeName: "테스트매장",
      area: "성수동",
      bizType: "restaurant",
      placeUrl: "https://place.naver.com/restaurant/1234567890/home",
      device: "MOBILE",
    });
    expect(c.cacheKey).not.toBe(a.cacheKey);
  });
});

