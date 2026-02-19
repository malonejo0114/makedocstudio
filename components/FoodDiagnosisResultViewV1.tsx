"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import MkdocLogo from "@/components/MkdocLogo";
import KeywordNetPanel from "@/components/KeywordNetPanel";
import { DIAGNOSIS_PRODUCTS } from "@/config/diagnosis";
import { FOOD_DIAGNOSIS_V1_DIMENSIONS } from "@/config/foodservice_diagnosis_v1";
import { evaluateFoodDiagnosisV1, type FoodDiagnosisV1Result } from "@/lib/foodDiagnosisV1";
import {
  FOOD_DIAGNOSIS_V1_QUESTIONS,
} from "@/config/foodservice_diagnosis_v1";
import { FOOD_DIAGNOSIS_V1_DRAFT_KEY } from "@/components/FoodDiagnosisSurveyWizardV1";

type DraftPayload = {
  values: Record<string, unknown>;
  result?: FoodDiagnosisV1Result;
  savedAt: number;
};

function AxisBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <span className="text-slate-500">{Math.round(value)}/100</span>
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

export default function FoodDiagnosisResultViewV1() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FOOD_DIAGNOSIS_V1_DRAFT_KEY);
      if (!raw) {
        setLoadError("진단 데이터가 없습니다. 다시 진단을 시작해 주세요.");
        return;
      }
      const parsed = JSON.parse(raw) as DraftPayload;
      if (!parsed?.values) {
        setLoadError("진단 데이터 형식이 올바르지 않습니다.");
        return;
      }

      const result = parsed.result
        ? parsed.result
        : evaluateFoodDiagnosisV1({
            questions: FOOD_DIAGNOSIS_V1_QUESTIONS,
            values: parsed.values,
          });
      setDraft({ ...parsed, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "진단 데이터 로드 실패";
      setLoadError(msg);
    }
  }, []);

  const onStartOver = () => {
    sessionStorage.removeItem(FOOD_DIAGNOSIS_V1_DRAFT_KEY);
    router.push("/diagnosis/start");
  };

  const goCheckout = (productCode: "PACK_299" | "CONSULT_45") => {
    router.push(`/diagnosis/checkout?product=${productCode}`);
  };

  const dimensionLabel = useMemo(() => {
    return Object.fromEntries(FOOD_DIAGNOSIS_V1_DIMENSIONS.map((d) => [d.id, d.label]));
  }, []);

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

  if (!draft?.result) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="animate-pulse rounded-3xl border border-white/70 bg-white/70 p-6">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-2/3 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  const result = draft.result;
  const pack = DIAGNOSIS_PRODUCTS.PACK_299;
  const consult = DIAGNOSIS_PRODUCTS.CONSULT_45;

  const dimensionBars = Object.entries(result.dimensions).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">진단 결과</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {result.report.heroTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {result.report.heroSubtitle}
            </p>
            {result.report.why.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {result.report.why.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {result.secondaryIssues.map((issue) => (
                <span
                  key={issue.id}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  #{issue.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onStartOver}
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
            Evidence
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            근거(수치) 스냅샷
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">{result.partials.bepBlock.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {result.partials.bepBlock.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Dimensions
            </p>
            <div className="mt-3 space-y-3">
              {dimensionBars.map(([id, score]) => (
                <AxisBar
                  key={id}
                  label={dimensionLabel[id] ?? id}
                  value={Number(score)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            RX 72h
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            지금 당장 72시간 처방
          </p>
          <ul className="mt-4 space-y-2">
            {result.report.rx_72h.map((line) => (
              <li
                key={line}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"
              >
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">
              {result.partials.placeFramework.title}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.partials.placeFramework.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Locked
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            상세 처방전(잠금)
          </p>

          <div className="relative mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] p-5 text-white">
            <div className="space-y-4 opacity-60 blur-[1.6px]">
              <div>
                <p className="text-sm font-semibold">14일 플랜</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {result.report.rx_14d.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">30일 플랜</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {result.report.rx_30d.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">추천 실행 상품</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {result.report.recommendedProducts.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-4">
              <p className="text-sm font-semibold">{result.partials.paywall.title}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {result.partials.paywall.bullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => goCheckout("PACK_299")}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 hover:bg-slate-100"
              >
                처방전 받기 ({pack.price?.toLocaleString("ko-KR")}원)
              </button>
              <button
                type="button"
                onClick={() => goCheckout("CONSULT_45")}
                className="rounded-2xl border border-white/35 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                30분 상담 ({consult.price?.toLocaleString("ko-KR")}원)
              </button>
            </div>

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_55%)]" />
          </div>
        </section>
      </div>

      <KeywordNetPanel values={result.values} />
    </div>
  );
}
