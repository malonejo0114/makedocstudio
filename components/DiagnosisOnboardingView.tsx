"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import MkdocLogo from "@/components/MkdocLogo";
import { DIAGNOSIS_PAYMENT_KEY } from "@/components/DiagnosisCheckoutView";

type PaymentDraft = {
  mode: "dev";
  product: "PACK_299" | "CONSULT_45";
  paidAt: number;
};

function FileList({ files }: { files: File[] }) {
  if (!files.length) return <p className="text-xs text-slate-500">선택된 파일 없음</p>;
  return (
    <ul className="mt-2 space-y-1 text-xs text-slate-700">
      {files.map((f) => (
        <li key={`${f.name}-${f.size}`}>{f.name}</li>
      ))}
    </ul>
  );
}

export default function DiagnosisOnboardingView() {
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [placeUrl, setPlaceUrl] = useState("");
  const [exterior, setExterior] = useState<File[]>([]);
  const [interior, setInterior] = useState<File[]>([]);
  const [menus, setMenus] = useState<File[]>([]);
  const [menuBoard, setMenuBoard] = useState<File[]>([]);
  const [insight, setInsight] = useState<File[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DIAGNOSIS_PAYMENT_KEY);
      if (!raw) return;
      setPayment(JSON.parse(raw) as PaymentDraft);
    } catch {
      // ignore
    }
  }, []);

  const checklist = useMemo(() => {
    const isPack = payment?.product !== "CONSULT_45";
    return isPack
      ? [
          "플레이스 URL",
          "외부 사진 2장(간판/입구)",
          "내부 사진 3장(대표 좌석/전체/카운터)",
          "메인 메뉴 사진 5장(시그니처 포함)",
          "메뉴판/가격표(가능하면)",
          "(선택) 플레이스 인사이트 캡처",
        ]
      : [
          "플레이스 URL",
          "외부 1장 + 내부 1장 + 메뉴 2장",
          "(선택) 플레이스 인사이트 캡처",
        ];
  }, [payment?.product]);

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);

    const needPlace = placeUrl.trim().length > 0;
    if (!needPlace) {
      setError("플레이스 URL을 입력해 주세요.");
      return;
    }

    // Dev-only: store submission draft to sessionStorage.
    try {
      sessionStorage.setItem(
        "mkdoc:diagnosis_onboarding_dev",
        JSON.stringify({
          placeUrl: placeUrl.trim(),
          exterior: exterior.map((f) => f.name),
          interior: interior.map((f) => f.name),
          menus: menus.map((f) => f.name),
          menuBoard: menuBoard.map((f) => f.name),
          insight: insight.map((f) => f.name),
          submittedAt: Date.now(),
          product: payment?.product ?? null,
        }),
      );
      setSuccess("제출 완료(개발용). 다음 단계: 관리자 작업/상담으로 연결됩니다.");
      setTimeout(() => router.push("/diagnosis"), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "제출 실패";
      setError(msg);
    }
  };

  if (!payment) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="text-sm font-semibold">결제 정보가 없습니다</p>
          <p className="mt-1 text-sm">
            온보딩은 결제 이후 단계입니다. (현재는 개발용 결제로 대체)
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/diagnosis/checkout?product=PACK_299"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              결제(개발용)로 이동
            </Link>
            <Link
              href="/diagnosis/result"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              결과로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">결제 후 온보딩</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              자료 제출
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              제출된 자료는 내부 운영(작업/상담)으로 연결됩니다.
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
            href="/creative"
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            광고소재 스튜디오
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Checklist
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            제출 체크리스트
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {checklist.map((item) => (
              <li key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            현재는 개발용으로 로컬에만 저장됩니다. 다음 단계에서 Supabase Storage 업로드로 연결합니다.
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Upload
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">자료 제출</p>

          <div className="mt-4 grid gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-800">플레이스 URL</span>
              <input
                value={placeUrl}
                onChange={(e) => setPlaceUrl(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="https://place.naver.com/..."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-800">외부 사진</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setExterior(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm"
                />
                <FileList files={exterior} />
              </label>
              <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-800">내부 사진</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setInterior(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm"
                />
                <FileList files={interior} />
              </label>
              <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-800">메뉴 사진</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setMenus(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm"
                />
                <FileList files={menus} />
              </label>
              <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-800">메뉴판/가격표</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setMenuBoard(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm"
                />
                <FileList files={menuBoard} />
              </label>
              <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-800">
                  (선택) 플레이스 인사이트 캡처
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setInsight(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm"
                />
                <FileList files={insight} />
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              {success}
            </div>
          )}

          <button
            type="button"
            onClick={() => void onSubmit()}
            className="mt-5 w-full rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110"
          >
            제출(개발용)
          </button>
        </section>
      </div>
    </div>
  );
}
