"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";

import MkdocLogo from "@/components/MkdocLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type RequestResponse =
  | { ok: true; request: { id: string; status: string; place_raw_input?: string | null; created_at?: string } }
  | { error: string };

export default function CheckoutPageClient() {
  const router = useRouter();
  const search = useSearchParams();
  const requestId = (search.get("request") || "").trim();

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<{ id: string; status: string } | null>(null);

  const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
  const hasToss = tossClientKey.length > 10;

  const [tossScriptLoaded, setTossScriptLoaded] = useState(false);
  const [tossReady, setTossReady] = useState(false);
  const tossWidgetRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthToken(data.session?.access_token ?? null);
      setSessionUserId(data.session?.user?.id ?? null);
      setSessionEmail(data.session?.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const load = async () => {
    if (!requestId) return;
    if (!authToken) return;
    setError(null);
    try {
      const res = await fetch(`/api/mkdoc/diagnosis/request/${requestId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const payload = (await res.json().catch(() => ({}))) as RequestResponse;
      if (!res.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "요청 조회 실패");
      }
      setRequest({ id: payload.request.id, status: payload.request.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "요청 조회 실패";
      setError(msg);
      setRequest(null);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, requestId]);

  const onDevPay = async () => {
    if (!authToken) {
      setError("로그인이 필요합니다.");
      return;
    }
    if (!requestId) {
      setError("request id가 없습니다.");
      return;
    }
    setError(null);
    try {
      setLoading(true);
      const res = await fetch(`/api/mkdoc/diagnosis/request/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ status: "paid" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error || "결제 처리 실패");
      }
      router.push(`/report/${requestId}?paid=1`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "결제 처리 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const price = useMemo(() => 39900, []);

  const initTossWidget = async () => {
    if (!hasToss) return;
    if (!tossScriptLoaded) return;
    if (!sessionUserId) return;
    if (!requestId) return;
    if (request?.status === "paid" || request?.status === "report_ready") return;
    if (tossWidgetRef.current) return;

    const PaymentWidget = (window as any).PaymentWidget as
      | ((clientKey: string, customerKey: string) => any)
      | undefined;
    if (typeof PaymentWidget !== "function") {
      setError("Toss 위젯 로딩에 실패했습니다. (스크립트 확인)");
      return;
    }

    try {
      const widget = PaymentWidget(tossClientKey, sessionUserId);
      widget.renderPaymentMethods(
        "#mkdoc-toss-payment-method",
        { value: price },
        { variantKey: "DEFAULT" },
      );
      widget.renderAgreement("#mkdoc-toss-agreement", { variantKey: "AGREEMENT" });
      tossWidgetRef.current = widget;
      setTossReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Toss 위젯 초기화 실패";
      setError(msg);
      setTossReady(false);
      tossWidgetRef.current = null;
    }
  };

  useEffect(() => {
    void initTossWidget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToss, tossScriptLoaded, sessionUserId, requestId, request?.status]);

  const onTossPay = async () => {
    if (!tossWidgetRef.current) {
      setError("Toss 위젯이 아직 준비되지 않았습니다.");
      return;
    }
    if (!requestId) {
      setError("request id가 없습니다.");
      return;
    }

    setError(null);
    try {
      setLoading(true);
      const orderId = `mkdoc_${requestId.replace(/-/g, "")}_${Date.now()}`;
      const successUrl = `${window.location.origin}/checkout/success?request=${encodeURIComponent(requestId)}`;
      const failUrl = `${window.location.origin}/checkout/fail?request=${encodeURIComponent(requestId)}`;

      await tossWidgetRef.current.requestPayment({
        orderId,
        orderName: "마케닥 마케팅 진단 풀 리포트(처방전)",
        customerEmail: sessionEmail ?? undefined,
        successUrl,
        failUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "결제 요청 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!requestId) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="text-sm font-semibold">오류</p>
          <p className="mt-1 text-sm">결제 대상 request가 없습니다. (URL 파라미터: request)</p>
          <div className="mt-4">
            <Link
              href="/diagnosis"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              진단으로 이동
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!authToken) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur">
          <MkdocLogo compact />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">로그인이 필요합니다</h1>
          <p className="mt-2 text-sm text-slate-600">결제/리포트는 계정에 저장됩니다.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/login?service=diagnosis&next=/checkout?request=${encodeURIComponent(requestId)}`}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              로그인
            </Link>
            <Link
              href={`/report/${requestId}`}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              미리보기로
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MkdocLogo compact />
            <div>
              <p className="text-xs font-semibold text-slate-700">결제</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">풀 리포트(처방전) 언락</h1>
              <p className="mt-1 text-sm text-slate-600">
                결제 완료 시, 키워드 그물망/처방전 전체가 열립니다.
              </p>
              {sessionEmail ? (
                <p className="mt-1 text-xs text-slate-500">로그인: {sessionEmail}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/report/${requestId}`}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              미리보기로
            </Link>
            <Link
              href="/"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              홈
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Product</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">정밀 진단 리포트</p>
            <p className="mt-1 text-xs text-slate-600">
              결제 후 /report에서 추가 질문을 완료하고 “풀 리포트 생성”을 누르면 문서(10p)와 PDF 다운로드가 활성화됩니다.
            </p>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold text-slate-600">가격</p>
              <p className="mt-2 text-4xl font-black text-slate-900">{price.toLocaleString("ko-KR")}원</p>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-800">
              <p className="font-semibold text-slate-900">포함</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>키워드 그물망(검색량/CTR/경쟁/입찰가)</li>
                <li>손익(BEP/최대 CPA) 계산</li>
                <li>플레이스/썸네일/리뷰 처방</li>
                <li>추천 실행 상품(1~2개만 강하게)</li>
              </ul>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Payment</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">결제</p>

            {!hasToss ? (
              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                <p className="font-semibold">Toss 위젯 키가 없습니다.</p>
                <p className="mt-1 text-sm text-amber-800">
                  개발/테스트는 아래 “개발자 결제(DEV)” 버튼으로 진행할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => void onDevPay()}
                  disabled={loading}
                  className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? "처리중..." : "개발자 결제(DEV)"}
                </button>
              </div>
            ) : (
              <>
                <Script
                  src="https://js.tosspayments.com/v1/payment-widget"
                  strategy="afterInteractive"
                  onLoad={() => setTossScriptLoaded(true)}
                />

                <div className="mt-4 space-y-4">
                  <div id="mkdoc-toss-payment-method" className="rounded-3xl border border-slate-200 bg-white p-4" />
                  <div id="mkdoc-toss-agreement" className="rounded-3xl border border-slate-200 bg-white p-4" />
                </div>

                <button
                  type="button"
                  onClick={() => void onTossPay()}
                  disabled={!tossReady || loading}
                  className="mt-4 w-full rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-black text-white hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? "요청중..." : "결제하기"}
                </button>
              </>
            )}

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">주의</p>
              <p className="mt-1">
                결제 성공 후에는 <span className="font-mono">/report/&lt;id&gt;</span>에서 추가 질문을 완료하고 “풀 리포트 생성”을 눌러야 문서가 생성됩니다.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

