"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DIAGNOSIS_PRODUCTS, DIAGNOSIS_TYPES } from "@/config/diagnosis";
import MkdocLogo from "@/components/MkdocLogo";
import {
  formatCurrencyKRW,
  type DiagnosisAnswersV12,
  type DiagnosisResultV12,
} from "@/lib/diagnosis";
import { DIAGNOSIS_DRAFT_KEY } from "@/components/DiagnosisSurveyWizard";

type DraftPayload = {
  answers: DiagnosisAnswersV12;
  result: DiagnosisResultV12;
  savedAt: number;
};

function AxisBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 25) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <span className="text-slate-500">{value}/25</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#06b6d4_0%,#10b981_100%)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: "High" | "Mid" | "Low" }) {
  const tone =
    risk === "High"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : risk === "Low"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  const label = risk === "High" ? "위험" : risk === "Low" ? "안정" : "주의";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone,
      ].join(" ")}
    >
      손익 위험도: {label}
    </span>
  );
}

export default function DiagnosisResultView() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DIAGNOSIS_DRAFT_KEY);
      if (!raw) {
        setLoadError("진단 데이터가 없습니다. 다시 진단을 시작해 주세요.");
        return;
      }
      const parsed = JSON.parse(raw) as DraftPayload;
      if (!parsed?.result?.type?.code) {
        setLoadError("진단 데이터 형식이 올바르지 않습니다.");
        return;
      }
      setDraft(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "진단 데이터 로드 실패";
      setLoadError(msg);
    }
  }, []);

  const typeMeta = useMemo(() => {
    if (!draft) return null;
    const type = DIAGNOSIS_TYPES[draft.result.type.code];
    return type ?? null;
  }, [draft]);

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="text-sm font-semibold">오류</p>
          <p className="mt-1 text-sm">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/diagnosis/start"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              진단 다시하기
            </Link>
            <Link
              href="/creative"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              광고소재 스튜디오
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!draft || !typeMeta) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="animate-pulse rounded-3xl border border-white/70 bg-white/70 p-6">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-2/3 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="animate-pulse rounded-3xl border border-white/70 bg-white/70 p-6">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-full rounded bg-slate-200" />
            <div className="mt-2 h-3 w-5/6 rounded bg-slate-200" />
          </div>
          <div className="animate-pulse rounded-3xl border border-white/70 bg-white/70 p-6">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-full rounded bg-slate-200" />
            <div className="mt-2 h-3 w-5/6 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  const { answers, result } = draft;
  const storeLabel = answers.storeName ? `${answers.storeName} ` : "";

  const pack = DIAGNOSIS_PRODUCTS.PACK_299;
  const consult = DIAGNOSIS_PRODUCTS.CONSULT_45;

  const startOver = () => {
    sessionStorage.removeItem(DIAGNOSIS_DRAFT_KEY);
    router.push("/diagnosis/start");
  };

  const goCheckout = (productCode: "PACK_299" | "CONSULT_45") => {
    router.push(`/diagnosis/checkout?product=${productCode}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">
              {storeLabel}진단 결과
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              지금 병목은 <span className="text-emerald-700">“{typeMeta.name}”</span> 입니다.
            </h1>
            <p className="mt-1 text-sm text-slate-600">{typeMeta.oneLiner}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startOver}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            다시 진단
          </button>
          <Link
            href="/creative"
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            광고소재 스튜디오
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,1fr,1.05fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Score
          </p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                플레이스 총점
              </p>
              <p className="mt-1 text-xs text-slate-500">
                정확도·신뢰도·최신성·인기도(각 25점)
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-slate-900">
                {result.scores.total}
              </p>
              <p className="text-xs font-semibold text-slate-500">/ 100</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <AxisBar label="정확도(Accuracy)" value={result.scores.accuracy} />
            <AxisBar label="신뢰도(Trust)" value={result.scores.trust} />
            <AxisBar label="최신성(Freshness)" value={result.scores.freshness} />
            <AxisBar label="인기도(Popularity)" value={result.scores.popularity} />
          </div>

          {result.notes.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">참고</p>
              <ul className="mt-1 list-disc pl-4">
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            BEP
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">손익분기(BEP) 위험도</p>
              <p className="mt-1 text-xs text-slate-500">
                고정비 ÷ (객단가 × (1-변동비율))
              </p>
            </div>
            <RiskBadge risk={result.bep.risk} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">추정 BEP(월)</p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {result.bep.bepMonthlyTeams ? Math.ceil(result.bep.bepMonthlyTeams) : "-"}팀
              </p>
              <p className="mt-1 text-xs text-slate-500">월 방문 팀수 기준</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">추정 BEP(일)</p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {result.bep.bepDailyTeams ? Math.ceil(result.bep.bepDailyTeams) : "-"}팀
              </p>
              <p className="mt-1 text-xs text-slate-500">30일 기준</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-700">현재(입력 기준)</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              월 방문 팀수:{" "}
              <span className="font-black">
                {result.bep.currentMonthlyTeams ? Math.round(result.bep.currentMonthlyTeams) : "-"}
              </span>
              {"  "}
              <span className="text-xs font-medium text-slate-500">
                (매출 입력 시 객단가로 환산)
              </span>
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Today
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            오늘 바로 할 3가지(무료)
          </p>
          <ul className="mt-4 space-y-2">
            {result.freeActions.map((action) => (
              <li
                key={action}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"
              >
                {action}
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] p-5 text-white">
            <p className="text-sm font-semibold">상세 처방전(잠금)</p>
            <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="space-y-2 opacity-60 blur-[1.5px]">
                {result.lockedPreview.map((line) => (
                  <p key={line} className="text-sm">
                    {line}
                  </p>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_55%)]" />
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => goCheckout("PACK_299")}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 hover:bg-slate-100"
              >
                처방전 받기 ({formatCurrencyKRW(pack.price ?? 299000)})
              </button>
              <button
                type="button"
                onClick={() => goCheckout("CONSULT_45")}
                className="rounded-2xl border border-white/35 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                30분 상담 ({formatCurrencyKRW(consult.price ?? 45000)})
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)] backdrop-blur">
        <p className="text-sm font-semibold text-slate-900">추천 실행 상품</p>
        <p className="mt-1 text-xs text-slate-600">
          타입 기준 추천입니다. 실제 적용은 매장 데이터/캡처 기반으로 더 정교화됩니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.recommendedProducts.map((code) => (
            <span
              key={code}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              {DIAGNOSIS_PRODUCTS[code as keyof typeof DIAGNOSIS_PRODUCTS]?.name ?? code}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
