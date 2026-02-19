"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import MkdocLogo from "@/components/MkdocLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function CheckoutSuccessClient() {
  const router = useRouter();
  const search = useSearchParams();

  const requestId = (search.get("request") || "").trim();
  const paymentKey = (search.get("paymentKey") || "").trim();
  const orderId = (search.get("orderId") || "").trim();
  const amountRaw = (search.get("amount") || "").trim();
  const amount = Number(amountRaw);

  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (!requestId || !paymentKey || !orderId || !Number.isFinite(amount)) {
          throw new Error("결제 성공 파라미터가 부족합니다.");
        }

        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          throw new Error("로그인이 필요합니다.");
        }

        const res = await fetch("/api/mkdoc/payments/toss/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ requestId, paymentKey, orderId, amount }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error || "결제 승인 실패");
        }

        setStatus("ok");
        router.push(`/report/${requestId}?paid=1`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "결제 승인 실패";
        setStatus("error");
        setError(msg);
      }
    };

    void run();
  }, [amount, orderId, paymentKey, requestId, router]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur">
          <MkdocLogo compact />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">결제 처리 중</h1>
          <p className="mt-2 text-sm text-slate-600">
            Toss 결제 승인을 확인하고 리포트로 이동합니다.
          </p>

          {status === "loading" ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              승인 확인 중...
            </div>
          ) : status === "ok" ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              승인 완료. 리포트로 이동합니다.
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error ?? "결제 승인 실패"}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={requestId ? `/report/${requestId}` : "/diagnosis"}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              리포트로
            </Link>
            <Link
              href="/"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              홈
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

