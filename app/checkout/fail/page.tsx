import { Suspense } from "react";

import CheckoutFailClient from "./CheckoutFailClient";

function Fallback() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
        <p className="text-sm font-semibold text-slate-900">결제 상태 확인 중...</p>
        <p className="mt-1 text-sm text-slate-600">잠시만 기다려 주세요.</p>
      </div>
    </main>
  );
}

export default function CheckoutFailPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <CheckoutFailClient />
    </Suspense>
  );
}

