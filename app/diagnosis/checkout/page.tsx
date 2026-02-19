import { Suspense } from "react";

import MarketingGrowthBackdrop from "@/components/MarketingGrowthBackdrop";
import DiagnosisCheckoutView from "@/components/DiagnosisCheckoutView";

export default function DiagnosisCheckoutPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <MarketingGrowthBackdrop />
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-300/15 blur-3xl" />

      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-5xl rounded-3xl border border-white/70 bg-white/70 p-6 text-sm text-slate-600 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
            결제 화면 로딩 중...
          </div>
        }
      >
        <DiagnosisCheckoutView />
      </Suspense>
    </main>
  );
}
