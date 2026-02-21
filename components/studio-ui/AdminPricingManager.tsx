"use client";

import { useEffect, useState } from "react";

type AdminPricedModel = {
  id: string;
  provider: string;
  name: string;
  textSuccess: string;
  speed: string;
  price: {
    costKrw: number;
    sellKrw: number;
    creditsRequired: number;
  };
  highRes: {
    costKrw: number;
    sellKrw: number;
    creditsRequired: number;
  } | null;
};

function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export default function AdminPricingManager() {
  const [models, setModels] = useState<AdminPricedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/pricing", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { models?: AdminPricedModel[]; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error || "관리자 가격표 조회 실패");
        }
        if (!mounted) return;
        setModels(payload?.models ?? []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "관리자 가격표 조회 실패");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-3 rounded-[28px] border border-black/10 bg-white p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Admin Pricing</p>
        <h2 className="mt-1 text-xl font-semibold text-[#0B0B0C]">내부 단가/판매가 (관리자 전용)</h2>
        <p className="mt-1 text-sm text-black/60">
          일반 사용자 화면에서는 원가/판매가를 숨기고, 여기서만 확인합니다.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/60">
          불러오는 중...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => (
            <article key={model.id} className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-sm">
              <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">{model.provider}</p>
              <p className="mt-1 text-base font-semibold text-[#0B0B0C]">{model.name}</p>
              <div className="mt-2 space-y-1 text-black/70">
                <p>내부 원가: ₩{formatKrw(model.price.costKrw)}</p>
                <p>판매가: ₩{formatKrw(model.price.sellKrw)}</p>
                <p>차감 크레딧: {model.price.creditsRequired}cr</p>
                {model.highRes ? (
                  <p className="text-xs text-black/55">
                    4K: ₩{formatKrw(model.highRes.costKrw)} / ₩{formatKrw(model.highRes.sellKrw)} /{" "}
                    {model.highRes.creditsRequired}cr
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

