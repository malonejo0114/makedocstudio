import fs from "node:fs/promises";
import path from "node:path";

import Link from "next/link";

import CopyBlock from "@/components/CopyBlock";
import MarketingGrowthBackdrop from "@/components/MarketingGrowthBackdrop";
import MkdocLogo from "@/components/MkdocLogo";
import { getSupabaseServiceClient } from "@/lib/supabase";

type Check = { ok: boolean; label: string; hint?: string };

function pill(ok: boolean, text: string) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
      ].join(" ")}
    >
      {text}
    </span>
  );
}

async function readLocalFile(relPath: string): Promise<string> {
  try {
    const abs = path.join(process.cwd(), relPath);
    return await fs.readFile(abs, "utf8");
  } catch {
    return "";
  }
}

async function runSupabaseChecks(): Promise<{
  available: boolean;
  error?: string;
  checks: Check[];
}> {
  const checks: Check[] = [];
  try {
    const supabase = getSupabaseServiceClient();

    // Tables
    const tableNames = ["diagnosis_requests", "keyword_metrics", "mkdoc_reports", "recommendations"];
    for (const name of tableNames) {
      // eslint-disable-next-line no-await-in-loop
      const { error } = await supabase.from(name).select("id").limit(1);
      checks.push({
        ok: !error,
        label: `DB 테이블: public.${name}`,
        hint: error ? String(error.message || error) : undefined,
      });
    }

    // Bucket
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      checks.push({
        ok: false,
        label: "Storage 버킷: store-assets",
        hint: String(bucketError.message || bucketError),
      });
    } else {
      const exists = (buckets ?? []).some((b) => b.id === "store-assets" || b.name === "store-assets");
      checks.push({
        ok: exists,
        label: "Storage 버킷: store-assets",
        hint: exists ? undefined : "버킷이 없습니다. one_click_setup_mkdoc.sql 실행 또는 Storage에서 버킷 생성 필요.",
      });
    }

    return { available: true, checks };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase 체크 실패";
    return { available: false, error: msg, checks: [] };
  }
}

export default async function SetupPage() {
  const mkdocSql = await readLocalFile("supabase/one_click_setup_mkdoc.sql");
  const studioSql = await readLocalFile("supabase/one_click_setup.sql");

  const env = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
    naverLocal: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET),
    naverSearchAd: Boolean(
      process.env.NAVER_SEARCHAD_ACCESS_LICENSE &&
        process.env.NAVER_SEARCHAD_SECRET_KEY &&
        process.env.NAVER_SEARCHAD_CUSTOMER_ID,
    ),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  };

  const supabaseCheck = await runSupabaseChecks();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <MarketingGrowthBackdrop />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl" />

      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MkdocLogo compact />
            <div>
              <p className="text-xs font-semibold text-slate-700">초기 설정</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">마케닥(MKDoc) / 광고소재 스튜디오 설정 체크</h1>
              <p className="mt-1 text-sm text-slate-600">
                “테이블 없음 / Bucket not found / 조회 안됨” 같은 오류는 여기서 대부분 해결됩니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/diagnosis"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              진단
            </Link>
            <Link
              href="/keyword-search"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              키워드 서치
            </Link>
            <Link
              href="/creative"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              광고소재 스튜디오
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Env</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">환경변수(.env.local) 체크</p>
            <p className="mt-1 text-xs text-slate-600">
              값은 표시하지 않고, 설정 여부만 확인합니다. 변경 후에는 dev 서버 재시작이 필요합니다.
            </p>

            <div className="mt-4 space-y-2 text-sm text-slate-800">
              <div className="flex items-center justify-between gap-3">
                <span>Supabase URL/Anon</span>
                {pill(env.supabaseUrl && env.supabaseAnon, env.supabaseUrl && env.supabaseAnon ? "OK" : "MISSING")}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Supabase Service Key(서버 API용)</span>
                {pill(env.supabaseService, env.supabaseService ? "OK" : "MISSING")}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Naver Local(플레이스 자동매칭)</span>
                {pill(env.naverLocal, env.naverLocal ? "OK" : "MISSING")}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Naver SearchAd(키워드/입찰가)</span>
                {pill(env.naverSearchAd, env.naverSearchAd ? "OK" : "MISSING")}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Gemini(광고소재 스튜디오)</span>
                {pill(env.gemini, env.gemini ? "OK" : "MISSING")}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">서버 재시작(권장)</p>
              <p className="mt-1">
                캐시/청크 오류가 나면 터미널에서 <span className="font-mono">npm run dev:reset</span> 실행.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Supabase</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">DB/Storage 체크</p>
            <p className="mt-1 text-xs text-slate-600">
              가능하면 Supabase에 실제로 연결해서 “테이블/버킷 존재 여부”를 확인합니다.
            </p>

            {supabaseCheck.available ? (
              <div className="mt-4 space-y-2">
                {supabaseCheck.checks.map((c) => (
                  <div key={c.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                      {pill(c.ok, c.ok ? "OK" : "MISSING")}
                    </div>
                    {c.hint ? <p className="mt-1 text-[11px] text-slate-600">{c.hint}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">자동 체크를 못 했습니다.</p>
                <p className="mt-1 text-sm text-amber-800">
                  {supabaseCheck.error ?? "Supabase 키가 설정되지 않았거나 연결에 실패했습니다."}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">해결법(가장 많이 막히는 2개)</p>
              <p className="mt-1">
                1) <span className="font-mono">diagnosis_requests</span> 테이블 없음:{" "}
                <span className="font-mono">one_click_setup_mkdoc.sql</span> 실행
              </p>
              <p className="mt-1">
                2) <span className="font-mono">Bucket not found</span>:{" "}
                <span className="font-mono">store-assets</span> 버킷 생성(같은 SQL에 포함)
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">SQL</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Supabase SQL Editor에 붙여넣고 Run</p>
            <p className="mt-1 text-xs text-slate-600">
              MKDoc 진단과 광고소재 스튜디오가 각각 별도 SQL 파일입니다. (둘 다 쓰면 둘 다 Run)
            </p>
          </div>

          <CopyBlock
            title="MKDoc(요식업 진단) 원클릭 SQL: supabase/one_click_setup_mkdoc.sql"
            text={mkdocSql || "(파일을 읽을 수 없습니다. 로컬에서 supabase/one_click_setup_mkdoc.sql 확인)"}
            language="sql"
            defaultOpen
          />

          <CopyBlock
            title="광고소재 스튜디오 원클릭 SQL: supabase/one_click_setup.sql"
            text={studioSql || "(파일을 읽을 수 없습니다. 로컬에서 supabase/one_click_setup.sql 확인)"}
            language="sql"
          />
        </section>
      </div>
    </main>
  );
}

