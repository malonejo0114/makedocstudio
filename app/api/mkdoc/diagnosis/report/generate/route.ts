import { NextResponse } from "next/server";

import { z } from "zod";

import { consumeRateLimit } from "@/lib/rateLimit";
import { requireUserFromAuthHeader } from "@/lib/mkdoc/auth.server";
import { buildReport } from "@/lib/mkdoc/reportEngine";
import { clusterKeywordNetRows } from "@/lib/mkdoc/keywordClusters";
import { buildKeywordNetCached } from "@/lib/keywordNetCache.server";
import { getSearchAdCredsFromEnv } from "@/lib/naver/searchad";
import { getSupabaseServiceClient } from "@/lib/supabase";

const RequestSchema = z.object({
  requestId: z.string().uuid(),
});

function hasSearchAdEnv(): boolean {
  return Boolean(
    process.env.NAVER_CLIENT_ID &&
      process.env.NAVER_CLIENT_SECRET &&
      process.env.NAVER_SEARCHAD_ACCESS_LICENSE &&
      process.env.NAVER_SEARCHAD_SECRET_KEY &&
      process.env.NAVER_SEARCHAD_CUSTOMER_ID,
  );
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = consumeRateLimit(`mkdoc:report-generate:${ip}`, { limit: 6, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limited. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    const user = await requireUserFromAuthHeader(request);
    const body = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", detail: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: dr, error: drError } = await supabase
      .from("diagnosis_requests")
      .select("id, user_id, status, place_raw_input, place_resolved_json, answers_json, uploads_json")
      .eq("id", parsed.data.requestId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (drError || !dr) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (dr.status !== "paid" && dr.status !== "report_ready") {
      return NextResponse.json(
        { error: "결제 전에는 풀 리포트를 생성할 수 없습니다." },
        { status: 402 },
      );
    }

    // Already generated
    const { data: existingReport } = await supabase
      .from("mkdoc_reports")
      .select("id, request_id, total_score, axis_scores_json, main_type, sub_tags_json, report_json, created_at")
      .eq("request_id", dr.id)
      .maybeSingle();
    if (existingReport?.id) {
      return NextResponse.json({ ok: true, report: existingReport, already: true }, { status: 200 });
    }

    const answers = (dr.answers_json as any) ?? {};
    const placeResolved = (dr.place_resolved_json as any) ?? {};

    // Keyword net (optional, but improves Demand/Cost axes)
    let keywordNet: any = null;
    if (hasSearchAdEnv()) {
      try {
        const storeName = String(placeResolved.title ?? answers.store_name ?? "").trim() || String(answers.store_name ?? "").trim() || "매장";
        const area = String(answers.area ?? "").trim() || String(placeResolved.roadAddress ?? placeResolved.address ?? "").trim() || "지역";
        const bizType = String(answers.biz_type ?? answers.bizType ?? "restaurant");

        const creds = getSearchAdCredsFromEnv();
        const toSeedArray = (v: unknown): string[] =>
          Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
        const extraHintSeeds = [
          ...toSeedArray(answers.keyword_menu_terms),
          ...toSeedArray(answers.keyword_area_aliases),
          ...toSeedArray(answers.keyword_intents),
          ...toSeedArray(answers.signature_menus),
          ...toSeedArray(answers.competitors),
        ].slice(0, 12);

        const { result } = await buildKeywordNetCached({
          creds,
          storeName,
          area,
          bizType,
          placeUrl: typeof dr.place_raw_input === "string" ? dr.place_raw_input : undefined,
          selectedPlaceLink: placeResolved.link ?? undefined,
          device: "PC",
          extraHintSeeds,
        });
        keywordNet = result;
      } catch (err) {
        console.warn("[mkdoc report] keyword net failed:", err);
        keywordNet = null;
      }
    }

    const report = buildReport({
      requestId: dr.id,
      placeResolved,
      answers,
      keyword: keywordNet,
    });

    // Persist keyword metrics (paid-only data)
    if (keywordNet?.keywordNet?.length) {
      const clustered = clusterKeywordNetRows(keywordNet.keywordNet, report.store.storeName);
      try {
        await supabase.from("keyword_metrics").delete().eq("request_id", dr.id);
      } catch {
        // ignore
      }

      const insertRows = clustered.slice(0, 200).map((r) => ({
        request_id: dr.id,
        keyword: r.keyword,
        pc_volume: r.pcVolume,
        m_volume: r.mVolume,
        pc_ctr: r.pcCtr,
        m_ctr: r.mCtr,
        comp_idx: r.compIdx,
        est_bid_p1: r.estBidP1,
        est_bid_p2: r.estBidP2,
        est_bid_p3: r.estBidP3,
        est_bid_p4: r.estBidP4,
        est_bid_p5: r.estBidP5,
        cluster: r.clusterName,
        intent: r.intent,
        priority: r.priorityScore,
      }));
      if (insertRows.length) {
        await supabase.from("keyword_metrics").insert(insertRows);
      }
    }

    // Persist report + recommendations
    const { data: reportRow, error: reportError } = await supabase
      .from("mkdoc_reports")
      .insert({
        request_id: dr.id,
        total_score: report.totalScore,
        axis_scores_json: report.axes,
        main_type: report.mainType.code,
        sub_tags_json: report.subTags,
        report_json: report,
      })
      .select("id, request_id, total_score, axis_scores_json, main_type, sub_tags_json, report_json, created_at")
      .single();
    if (reportError || !reportRow) {
      throw new Error(reportError?.message || "Failed to save report.");
    }

    // Recommendations are supplementary; do not fail report creation if insert fails.
    await supabase.from("recommendations").insert({
      report_id: reportRow.id,
      primary_products_json: report.recommendations.primary,
      optional_products_json: report.recommendations.optional,
    });

    await supabase
      .from("diagnosis_requests")
      .update({ status: "report_ready" })
      .eq("id", dr.id)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, report: reportRow, already: false }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report generation failed.";
    const status = msg.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
