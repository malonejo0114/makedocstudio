"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useLocaleText } from "@/components/studio-ui/LanguageProvider";
import { getPricedModelCatalog } from "@/lib/studio/pricing";

type FidelityStat = {
  imageModelId: string;
  avgScore: number;
  count: number;
};

export default function PricingPageClient() {
  const t = useLocaleText({
    ko: {
      title: "모델/크레딧 가격표",
      desc: "내부 원가(USD→KRW) 기준으로 판매가는 3배 후 100원 단위 반올림됩니다. 1크레딧은 100원입니다.",
      failedStats: "최근 실측 조회 실패:",
      textSuccess: "한글 텍스트",
      speed: "속도",
      cost: "내부 원가",
      sell: "판매가(3x)",
      creditUse: "차감 크레딧(1장)",
      highRes: "4K 기준 원가/판매가/차감",
      recentLabel: "최근 7일 한글 텍스트 실측",
      average: "평균",
      cases: "건",
      noSamples: "아직 충분한 샘플이 없습니다.",
      accountTitle: "통합 크레딧 잔액은 /account에서 관리됩니다.",
      accountCta: "계정 페이지로 이동",
    },
    en: {
      title: "Model / Credit Pricing",
      desc: "Sell price is 3x internal cost (USD→KRW), rounded to KRW 100 units. 1 credit = KRW 100.",
      failedStats: "Failed to load recent metrics:",
      textSuccess: "Korean text",
      speed: "Speed",
      cost: "Internal cost",
      sell: "Sell price (3x)",
      creditUse: "Credits per image",
      highRes: "4K cost/sell/credits",
      recentLabel: "Recent 7-day Korean text fidelity",
      average: "Avg",
      cases: "cases",
      noSamples: "Not enough samples yet.",
      accountTitle: "Manage unified credits in /account.",
      accountCta: "Go to Account",
    },
  });
  const [stats, setStats] = useState<FidelityStat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/studio/pricing/stats")
      .then((response) => response.json())
      .then((payload) => {
        if (!mounted) return;
        if (Array.isArray(payload?.stats)) {
          setStats(payload.stats);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load stats.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const statsMap = useMemo(() => {
    const map = new Map<string, FidelityStat>();
    for (const stat of stats) map.set(stat.imageModelId, stat);
    return map;
  }, [stats]);

  const models = getPricedModelCatalog();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-8">
      <section className="rounded-[32px] border border-black/10 bg-white p-8 shadow-[0_25px_50px_-40px_rgba(0,0,0,0.5)]">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Model Pricing</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">{t.title}</h1>
        <p className="mt-2 text-sm text-black/65">
          {t.desc}
        </p>
        {error && <p className="mt-2 text-sm text-rose-600">{t.failedStats} {error}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => {
          const stat = statsMap.get(model.id);
          return (
            <article
              key={model.id}
              className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_45px_-35px_rgba(0,0,0,0.45)]"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-black/45">{model.provider}</p>
              <h2 className="mt-2 text-xl font-semibold text-[#0B0B0C]">{model.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-black/5 px-2 py-1">{t.textSuccess}: {model.textSuccess}</span>
                <span className="rounded-full bg-black/5 px-2 py-1">{t.speed}: {model.speed}</span>
              </div>

              <div className="mt-4 space-y-1 text-sm text-black/75">
                <p>{t.cost}: ₩{model.price.costKrw.toLocaleString()}</p>
                <p>{t.sell}: ₩{model.price.sellKrw.toLocaleString()}</p>
                <p>{t.creditUse}: {model.price.creditsRequired} credits</p>
                {model.highRes && (
                  <p className="text-xs text-black/55">
                    {t.highRes}: ₩{model.highRes.costKrw.toLocaleString()} / ₩
                    {model.highRes.sellKrw.toLocaleString()} / {model.highRes.creditsRequired} credits
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.02] p-3 text-xs text-black/65">
                <p className="font-semibold text-black/75">{t.recentLabel}</p>
                {stat ? (
                  <p className="mt-1">
                    {t.average} {stat.avgScore} ({stat.count} {t.cases})
                  </p>
                ) : (
                  <p className="mt-1">{t.noSamples}</p>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <div className="rounded-[28px] border border-black/10 bg-[#0B0B0C] p-8 text-[#F5F5F0]">
        <h3 className="text-2xl font-semibold">{t.accountTitle}</h3>
        <Link
          href="/account"
          className="mt-4 inline-flex rounded-full bg-[#D6FF4F] px-5 py-2.5 text-sm font-semibold text-[#0B0B0C]"
        >
          {t.accountCta}
        </Link>
      </div>
    </main>
  );
}
