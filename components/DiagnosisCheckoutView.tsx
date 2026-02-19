"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { DIAGNOSIS_PRODUCTS } from "@/config/diagnosis";
import MkdocLogo from "@/components/MkdocLogo";
import { formatCurrencyKRW } from "@/lib/diagnosis";
import { DIAGNOSIS_DRAFT_KEY } from "@/components/DiagnosisSurveyWizard";

type ProductCode = "PACK_299" | "CONSULT_45";

export const DIAGNOSIS_PAYMENT_KEY = "mkdoc:diagnosis_payment_dev";

export default function DiagnosisCheckoutView() {
  const router = useRouter();
  const params = useSearchParams();
  const product = (params.get("product") ?? "PACK_299") as ProductCode;
  const [hasDraft, setHasDraft] = useState<boolean>(true);

  useEffect(() => {
    try {
      setHasDraft(Boolean(sessionStorage.getItem(DIAGNOSIS_DRAFT_KEY)));
    } catch {
      setHasDraft(false);
    }
  }, []);

  const productMeta = useMemo(() => {
    return DIAGNOSIS_PRODUCTS[product] ?? DIAGNOSIS_PRODUCTS.PACK_299;
  }, [product]);

  const devCompletePayment = () => {
    try {
      sessionStorage.setItem(
        DIAGNOSIS_PAYMENT_KEY,
        JSON.stringify({
          mode: "dev",
          product,
          paidAt: Date.now(),
        }),
      );
    } catch {
      // ignore
    }
    router.push("/diagnosis/onboarding");
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">결제</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {productMeta.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Toss Payments 연동 전, UI/플로우를 먼저 완성합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/diagnosis/result"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            결과로
          </Link>
          <Link
            href="/diagnosis/start"
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            진단 다시하기
          </Link>
        </div>
      </div>

      {!hasDraft && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <p className="text-sm font-semibold">진단 결과가 없습니다</p>
          <p className="mt-1 text-sm">
            결제 전에 먼저 진단을 진행해 주세요.
          </p>
          <div className="mt-4">
            <Link
              href="/diagnosis/start"
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              진단 시작
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Summary
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            결제 금액
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {formatCurrencyKRW(productMeta.price ?? 0)}
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">포함 내용</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {Array.isArray(productMeta.meta?.includes)
                ? (productMeta.meta?.includes as string[]).map((item) => (
                    <li key={item}>{item}</li>
                  ))
                : product === "CONSULT_45"
                  ? ["진단 결과 해석", "1순위 액션 3개", "우선순위 정리"].map((item) => (
                      <li key={item}>{item}</li>
                    ))
                  : ["맞춤 처방전"].map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Next
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            결제 후 온보딩(자료 제출)
          </p>
          <p className="mt-2 text-sm text-slate-600">
            플레이스 URL/사진/인사이트를 제출하면 내부 운영(작업/상담)으로 이어집니다.
          </p>

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={devCompletePayment}
              className="rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110"
            >
              개발용: 결제 완료 처리하고 온보딩으로
            </button>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Toss Payments 연동 시 이 버튼은 제거되고, 실제 결제 성공 콜백에서 주문/결제 테이블을
              기록합니다.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

