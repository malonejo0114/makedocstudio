"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import MkdocLogo from "@/components/MkdocLogo";
import MkdocReportDocument, {
  type MkdocKeywordMetricRow,
} from "@/components/MkdocReportDocument";
import MkdocSurveyQuestionRenderer from "@/components/MkdocSurveyQuestionRenderer";
import {
  getSurveyQuestionsByStage,
  isSurveyComplete,
} from "@/lib/mkdoc/survey";
import { buildReport, computeMetrics } from "@/lib/mkdoc/reportEngine";
import { getProductMeta } from "@/lib/mkdoc/rules";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type DiagnosisRequestRow = {
  id: string;
  status: "preview" | "paid" | "report_ready";
  place_raw_input: string | null;
  place_resolved_json: any;
  answers_json: Record<string, unknown>;
  uploads_json: any;
  created_at: string;
  updated_at: string;
};

type ReportRow = {
  id: string;
  request_id: string;
  total_score: number;
  axis_scores_json: Record<string, number>;
  main_type: string | null;
  sub_tags_json: any;
  report_json: any;
  created_at: string;
};

type KeywordMetricRow = {
  keyword: string;
  pc_volume: number;
  m_volume: number;
  pc_ctr: number | null;
  m_ctr: number | null;
  comp_idx: string | null;
  est_bid_p3: number | null;
  cluster: string | null;
  intent: string | null;
  priority: number | null;
};

function currencyLike(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function formatProductMeta(code: string): { title: string; subtitle: string } {
  const meta = getProductMeta(code);
  if (!meta) {
    return { title: code, subtitle: "상세 정보 없음" };
  }

  if (typeof meta.price === "number" && Number.isFinite(meta.price)) {
    return { title: meta.name, subtitle: `${meta.price.toLocaleString("ko-KR")}원` };
  }
  if (typeof meta.management_fee === "number" && Number.isFinite(meta.management_fee)) {
    const base = `월 관리비 ${meta.management_fee.toLocaleString("ko-KR")}원`;
    const note = meta.cpc_note ? ` (${meta.cpc_note})` : "";
    return { title: meta.name, subtitle: `${base}${note}` };
  }
  return { title: meta.name, subtitle: "가격: 문의" };
}

function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("ko-KR");
}

function ScoreBar({ label, value }: { label: string; value: number }) {
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

export default function ReportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const requestId = String(params.id || "").trim();

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [requestRow, setRequestRow] = useState<DiagnosisRequestRow | null>(null);
  const [reportRow, setReportRow] = useState<ReportRow | null>(null);
  const [keywordRows, setKeywordRows] = useState<KeywordMetricRow[]>([]);

  const [postValues, setPostValues] = useState<Record<string, unknown>>({});

  const postQuestions = useMemo(
    () => getSurveyQuestionsByStage("post", postValues),
    [postValues],
  );

  const [viewMode, setViewMode] = useState<"summary" | "doc">("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthToken(data.session?.access_token ?? null);
      setSessionEmail(data.session?.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (requestRow?.status === "report_ready") {
      setViewMode("doc");
    }
  }, [requestRow?.status]);

  const load = async () => {
    if (!authToken || !requestId) return;
    setError(null);
    try {
      const reqRes = await fetch(`/api/mkdoc/diagnosis/request/${requestId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const reqPayload = await reqRes.json().catch(() => ({}));
      if (!reqRes.ok || reqPayload?.error) {
        throw new Error(reqPayload?.error || "요청 로드 실패");
      }
      const row = reqPayload.request as DiagnosisRequestRow;
      setRequestRow(row);
      setPostValues((prev) => ({ ...row.answers_json, ...prev }));

      // Report (exists only after generation)
      const reportRes = await fetch(`/api/mkdoc/diagnosis/report/${requestId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (reportRes.ok) {
        const reportPayload = await reportRes.json().catch(() => ({}));
        if (reportPayload?.report?.id) setReportRow(reportPayload.report as ReportRow);
      } else {
        setReportRow(null);
      }

      // Keyword metrics (paid-only, but safe to attempt)
      const kmRes = await fetch(`/api/mkdoc/diagnosis/keyword-metrics/${requestId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (kmRes.ok) {
        const kmPayload = await kmRes.json().catch(() => ({}));
        setKeywordRows(Array.isArray(kmPayload.rows) ? kmPayload.rows : []);
      } else {
        setKeywordRows([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로드 실패";
      setError(msg);
      setRequestRow(null);
      setReportRow(null);
      setKeywordRows([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, requestId]);

  const markPaidAndGoCheckout = () => {
    router.push(`/checkout?request=${encodeURIComponent(requestId)}`);
  };

  const canGenerateFullReport =
    requestRow?.status === "paid" &&
    isSurveyComplete("post", postValues);

  const patchAnswers = async (nextAnswers: Record<string, unknown>) => {
    if (!authToken || !requestId) return;
    const res = await fetch(`/api/mkdoc/diagnosis/request/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ answers: nextAnswers }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.error) {
      throw new Error(payload?.error || "저장 실패");
    }
  };

  const savePostAnswers = async () => {
    if (!authToken || !requestId) return;
    setError(null);
    try {
      setLoading(true);
      await patchAnswers(postValues);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const generateFullReport = async () => {
    if (!authToken || !requestId) return;
    setError(null);
    if (!canGenerateFullReport) {
      setError(`추가 질문(${postQuestions.length}문항)을 먼저 완료해 주세요.`);
      return;
    }
    try {
      setLoading(true);
      await patchAnswers(postValues);
      const res = await fetch("/api/mkdoc/diagnosis/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ requestId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error || "리포트 생성 실패");
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "리포트 생성 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Hooks must be called unconditionally (avoid "Rendered more hooks than during the previous render").
  const groupedClusters = useMemo(() => {
    const map = new Map<string, KeywordMetricRow[]>();
    for (const row of keywordRows) {
      const key = String(row.cluster ?? "기타");
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([cluster, rows]) => ({
      cluster,
      rows: rows.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 12),
    }));
  }, [keywordRows]);

  const previewReport = useMemo(() => {
    if (!requestRow) return null;
    try {
      return buildReport({
        requestId,
        placeResolved: requestRow.place_resolved_json ?? {},
        answers: requestRow.answers_json ?? {},
        keyword: null,
      });
    } catch {
      return null;
    }
  }, [requestId, requestRow]);

  if (!requestId) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="text-sm font-semibold">오류</p>
          <p className="mt-1 text-sm">리포트 id가 없습니다.</p>
          <Link href="/diagnosis" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            진단으로 이동
          </Link>
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
          <p className="mt-2 text-sm text-slate-600">리포트는 계정에 저장됩니다.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/login?service=diagnosis&next=/report/${encodeURIComponent(requestId)}`}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              로그인
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              홈
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const report = reportRow?.report_json as any | null;
  const totalScore = report?.totalScore ?? reportRow?.total_score ?? null;
  const axes = report?.axes ?? reportRow?.axis_scores_json ?? null;
  const mainType = report?.mainType ?? null;
  const subTags = (report?.subTags ?? reportRow?.sub_tags_json ?? []) as any[];
  const metrics = report?.metrics ?? null;

  const uploads = requestRow?.uploads_json ?? {};
  const uploadThumbs: string[] = [
    ...(Array.isArray(uploads.exterior) ? uploads.exterior : []),
    ...(Array.isArray(uploads.interior) ? uploads.interior : []),
    ...(Array.isArray(uploads.menu) ? uploads.menu : []),
  ].slice(0, 8);

  const handleDownloadPdf = () => {
    if (typeof window === "undefined") return;
    setViewMode("doc");
    // Give React one tick to paint the document view for user feedback.
    window.setTimeout(() => window.print(), 50);
  };

  return (
    <main className="mkdoc-print-root min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="mkdoc-no-print flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MkdocLogo compact />
            <div>
              <p className="text-xs font-semibold text-slate-700">리포트</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                {requestRow?.place_resolved_json?.title ?? "마케닥 진단 리포트"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                상태:{" "}
                <span className="font-semibold">
                  {requestRow?.status ?? "loading"}
                </span>
              </p>
              {sessionEmail ? (
                <p className="mt-1 text-xs text-slate-500">로그인: {sessionEmail}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {reportRow ? (
              <>
                <button
                  type="button"
                  onClick={() => setViewMode("summary")}
                  className={[
                    "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    viewMode === "summary"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  요약
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("doc")}
                  className={[
                    "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    viewMode === "doc"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  문서(10p)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  PDF 다운로드
                </button>
              </>
            ) : null}
            <Link
              href="/diagnosis"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              새 진단
            </Link>
            <Link
              href="/"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              홈
            </Link>
          </div>
        </header>

        {error && (
          <div className="mkdoc-no-print rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            <p>{error}</p>
            <p className="mt-2 text-[11px] text-rose-700/90">
              환경/DB/버킷 문제면{" "}
              <Link href="/setup" className="font-semibold underline">
                /setup
              </Link>
              에서 원인 체크가 가능합니다.
            </p>
          </div>
        )}

        {!requestRow ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-44 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            <div className="h-44 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          </div>
        ) : requestRow.status === "preview" ? (
          <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Preview</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">미리보기(결제 전)</p>
              <p className="mt-1 text-xs text-slate-600">점수 + 병목 1개까지만 공개합니다.</p>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold text-slate-600">예상 총점(임시)</p>
                <p className="mt-2 text-5xl font-black text-slate-900">{previewReport?.totalScore ?? "-"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">/ 100</p>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">병목 1개</p>
                <p className="mt-1 text-sm text-slate-700">
                  {previewReport?.mainType
                    ? `“${previewReport.mainType.name}” – ${previewReport.mainType.oneLiner}`
                    : "진단 결과를 계산 중입니다."}
                </p>
              </div>

              <button
                type="button"
                onClick={markPaidAndGoCheckout}
                className="mt-5 w-full rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-5 py-4 text-base font-black text-white shadow-[0_25px_80px_-60px_rgba(16,185,129,0.55)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                39,900원 결제하고 풀 리포트 받기
              </button>

              <p className="mt-2 text-center text-[11px] text-slate-500">
                결제 후: 키워드 그물망/처방전/추천상품 전체 공개
              </p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Assets</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">업로드 이미지</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {uploadThumbs.length ? (
                  uploadThumbs.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="upload"
                      className="aspect-square w-full rounded-2xl border border-slate-200 object-cover"
                    />
                  ))
                ) : (
                  <div className="col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    업로드 이미지가 없습니다.
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                <p className="font-semibold">잠금 안내</p>
                <p className="mt-1 text-sm text-amber-800">
                  결제 후에는 “썸네일/사진 처방 템플릿”이 리포트에 추가됩니다.
                </p>
              </div>
            </section>
          </div>
        ) : requestRow.status === "paid" && !reportRow ? (
          <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Step 2</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                결제 완료: 추가 질문({postQuestions.length}문항)
              </p>
              <p className="mt-1 text-xs text-slate-600">
                아래를 채우면 풀 리포트가 생성됩니다.
              </p>

              <div className="mt-4 grid gap-4">
                {postQuestions.map((q) => (
                  <div key={q.id} className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {q.id}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{q.title}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {q.required === false ? "선택" : "필수"}
                      </span>
                    </div>
                    <MkdocSurveyQuestionRenderer
                      question={q}
                      value={postValues[q.key]}
                      onChange={(next) => setPostValues((prev) => ({ ...prev, [q.key]: next }))}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void savePostAnswers()}
                  disabled={loading}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loading ? "저장중..." : "답변 저장"}
                </button>
                <button
                  type="button"
                  onClick={() => void generateFullReport()}
                  disabled={loading || !canGenerateFullReport}
                  className="rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-black text-white hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? "생성중..." : "풀 리포트 생성"}
                </button>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                키워드/입찰가 조회는 API 비용이 있으므로 24시간 캐시가 적용됩니다.
              </p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Assets</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">업로드 이미지</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {uploadThumbs.length ? (
                  uploadThumbs.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="upload"
                      className="aspect-square w-full rounded-2xl border border-slate-200 object-cover"
                    />
                  ))
                ) : (
                  <div className="col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    업로드 이미지가 없습니다.
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : !reportRow ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-700">
            <p className="text-sm font-semibold">리포트가 아직 생성되지 않았습니다.</p>
            <p className="mt-1 text-sm">상태: {requestRow.status}</p>
          </div>
        ) : (
          <>
            <p className="mkdoc-no-print -mt-1 text-[11px] text-slate-500">
              PDF 다운로드: 브라우저 인쇄창에서 “PDF로 저장”을 선택하세요.
            </p>
            <div
              className={[
                "mkdoc-no-print space-y-4",
                viewMode === "summary" ? "" : "hidden",
              ].join(" ")}
            >
              <div className="grid gap-4 lg:grid-cols-[1fr,1fr,1fr]">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Summary</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">1분 요약</p>
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold text-slate-600">총점</p>
                    <p className="mt-2 text-5xl font-black text-slate-900">{totalScore ?? "-"}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">/ 100</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-slate-900">
                      병목 타입:{" "}
                      <span className="text-emerald-700">{mainType?.name ?? reportRow.main_type ?? "-"}</span>
                    </p>
                    <p className="text-sm text-slate-700">{mainType?.oneLiner ?? ""}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {subTags?.length ? (
                        subTags.map((t: any) => (
                          <span
                            key={t.code ?? t.label}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            #{t.label ?? t.code}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">서브 태그 없음</span>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Axes</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">5축 점수</p>
                  <div className="mt-4 space-y-3">
                    <ScoreBar label="Demand(수요)" value={Number(axes?.demand ?? 0)} />
                    <ScoreBar label="Cost(광고비)" value={Number(axes?.cost ?? 0)} />
                    <ScoreBar label="Place CVR(전환)" value={Number(axes?.placeCvr ?? 0)} />
                    <ScoreBar label="Hook(후킹)" value={Number(axes?.hook ?? 0)} />
                    <ScoreBar label="Unit Economics(손익)" value={Number(axes?.unitEconomics ?? 0)} />
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">BEP</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">BEP/최대 CPA</p>
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-800">
                    <p className="font-semibold text-slate-900">손익 스냅샷</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      <li>팀당 공헌이익: {currencyLike(metrics?.contribution_margin)}</li>
                      <li>추정 BEP(일): {Math.round(Number(metrics?.bep_daily_teams ?? 0))}팀</li>
                      <li>현재(일): {Math.round(Number(metrics?.current_daily_teams ?? 0))}팀</li>
                      <li>갭(일): {Math.round(Number(metrics?.gap_daily_teams ?? 0))}팀</li>
                      <li>최대 CPA(대략): {currencyLike(metrics?.max_cpa_est)}</li>
                    </ul>
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Keyword Net</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">키워드 그물망(클러스터)</p>
                  <p className="mt-1 text-xs text-slate-600">
                    클러스터를 펼쳐 우선순위 키워드를 확인하세요.
                  </p>

                  {groupedClusters.length ? (
                    <div className="mt-4 space-y-3">
                      {groupedClusters.map((c) => (
                        <details key={c.cluster} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                            {c.cluster}{" "}
                            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                              {c.rows.length}개
                            </span>
                          </summary>
                          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="max-h-[320px] overflow-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">키워드</th>
                                    <th className="px-3 py-2 font-semibold">수요</th>
                                    <th className="px-3 py-2 font-semibold">CTR</th>
                                    <th className="px-3 py-2 font-semibold">3위 입찰</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.rows.map((r) => (
                                    <tr key={r.keyword} className="border-t border-slate-100">
                                      <td className="px-3 py-2 font-semibold text-slate-900">{r.keyword}</td>
                                      <td className="px-3 py-2 text-slate-700">
                                        {formatCompactNumber((r.pc_volume ?? 0) + (r.m_volume ?? 0))}
                                      </td>
                                      <td className="px-3 py-2 text-slate-700">
                                        {r.pc_ctr == null && r.m_ctr == null
                                          ? "-"
                                          : `${(((r.pc_ctr ?? 0) + (r.m_ctr ?? 0)) / 2).toFixed(2)}%`}
                                      </td>
                                      <td className="px-3 py-2 text-slate-700">{currencyLike(r.est_bid_p3)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                      키워드 데이터가 없습니다. (SearchAd 키 설정 또는 API 실패)
                    </div>
                  )}
                </section>

                <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Place RX</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">플레이스 처방전</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-800">
                      {[
                        "정확도: 업종/주소/메뉴/가격/대표키워드/찾아오는 길",
                        "신뢰도: 리뷰/응답/정보 일관성",
                        "최신성: 공지/사진/메뉴/이벤트 업데이트 주기",
                        "인기도: 저장/공유/외부유입/길찾기/전화",
                      ].map((t) => (
                        <li key={t} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Thumbnail</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">썸네일/사진 처방</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {uploadThumbs.length ? (
                        uploadThumbs.map((url) => (
                          <img
                            key={url}
                            src={url}
                            alt="upload"
                            className="aspect-square w-full rounded-2xl border border-slate-200 object-cover"
                          />
                        ))
                      ) : (
                        <div className="col-span-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                          업로드 이미지 없음
                        </div>
                      )}
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                      코멘트 영역(운영용): 업로드된 사진을 보고 “대표사진 5장 구성 템플릿”과 문구 템플릿을 제안합니다.
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Recommendations</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">추천 실행 상품</p>
                <p className="mt-1 text-xs text-slate-600">
                  1~2개만 강하게 노출하고 나머지는 접습니다.
                </p>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr,1fr,1fr]">
                  <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] p-5 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/90">Primary</p>
                    <p className="mt-2 text-lg font-black">우선 추천</p>
                    <ul className="mt-3 space-y-1 text-sm">
                      {(report?.recommendations?.primary ?? []).map((code: string) => {
                        const meta = formatProductMeta(code);
                        return (
                          <li key={code} className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">
                            <p className="text-sm font-black">{meta.title}</p>
                            <p className="mt-1 text-[11px] font-semibold text-cyan-50/75">{meta.subtitle}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <details className="rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:col-span-2">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                      추가 옵션 열기
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(report?.recommendations?.optional ?? []).map((code: string) => {
                        const meta = formatProductMeta(code);
                        return (
                          <div key={code} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                            <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">{meta.subtitle}</p>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>

                <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                  <p className="text-sm font-semibold">30분 무료상담</p>
                  <p className="mt-1 text-sm text-emerald-800">
                    리포트를 기반으로 1순위 액션을 같이 결정합니다. (캘린더 링크는 placeholder)
                  </p>
                  <a
                    href={report?.sections?.consultCta?.calendarLink ?? "https://example.com/placeholder"}
                    className="mt-4 inline-flex rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    상담 예약하기
                  </a>
                </div>
              </section>
            </div>

            <div
              className={[
                "mkdoc-print-show",
                viewMode === "doc" ? "" : "hidden",
              ].join(" ")}
            >
              <MkdocReportDocument
                reportDate={reportRow.created_at}
                storeName={report?.store?.storeName ?? requestRow?.place_resolved_json?.title ?? "매장"}
                area={report?.store?.area ?? ""}
                category={report?.store?.category ?? requestRow?.place_resolved_json?.category ?? null}
                placeLink={report?.store?.placeLink ?? requestRow?.place_resolved_json?.link ?? null}
                answers={requestRow?.answers_json ?? {}}
                totalScore={Number(totalScore ?? 0)}
                axes={{
                  demand: Number(axes?.demand ?? 0),
                  cost: Number(axes?.cost ?? 0),
                  placeCvr: Number(axes?.placeCvr ?? 0),
                  hook: Number(axes?.hook ?? 0),
                  unitEconomics: Number(axes?.unitEconomics ?? 0),
                }}
                mainType={
                  mainType ?? {
                    code: String(reportRow.main_type ?? "UNKNOWN"),
                    name: String(reportRow.main_type ?? "진단"),
                    oneLiner: "",
                  }
                }
                subTags={Array.isArray(subTags) ? subTags : []}
                metrics={(metrics ?? computeMetrics(requestRow?.answers_json ?? {})) as any}
                keywordRows={keywordRows as unknown as MkdocKeywordMetricRow[]}
                uploadThumbs={uploadThumbs}
                recommendations={{
                  primary: report?.recommendations?.primary ?? [],
                  optional: report?.recommendations?.optional ?? [],
                }}
                consultLink={report?.sections?.consultCta?.calendarLink ?? null}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
