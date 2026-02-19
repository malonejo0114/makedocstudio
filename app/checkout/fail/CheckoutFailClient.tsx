"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import MkdocLogo from "@/components/MkdocLogo";

export default function CheckoutFailClient() {
  const search = useSearchParams();
  const requestId = (search.get("request") || "").trim();
  const code = search.get("code");
  const message = search.get("message");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <MkdocLogo compact />
          <h1 className="mt-3 text-2xl font-bold text-rose-900">결제 실패</h1>
          <p className="mt-2 text-sm text-rose-800">결제가 완료되지 않았습니다.</p>

          <div className="mt-4 rounded-2xl border border-rose-200 bg-white/60 p-4 text-sm text-rose-900">
            <p className="font-semibold">에러 정보</p>
            <p className="mt-1 text-xs">
              code: {code ?? "-"} / message: {message ?? "-"}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={requestId ? `/checkout?request=${encodeURIComponent(requestId)}` : "/diagnosis"}
              className="rounded-2xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
            >
              결제 다시 시도
            </Link>
            <Link
              href={requestId ? `/report/${requestId}` : "/diagnosis"}
              className="rounded-2xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100"
            >
              미리보기로
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

