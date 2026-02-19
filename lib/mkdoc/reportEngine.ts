import reportTemplateJson from "@/config/mkdoc/reportTemplate.json";
import type { KeywordNetResult } from "@/lib/keywordNet";
import { coerceNumber } from "@/lib/mkdoc/survey";
import { getRecommendationsForType, pickMainType, pickSubTags, type AxisId } from "@/lib/mkdoc/rules";

export type DiagnosisRequestStatus = "preview" | "paid" | "report_ready";

export type MkdocAnswers = Record<string, unknown>;

export type MkdocMetrics = {
  contribution_margin: number;
  bep_monthly_teams: number;
  bep_daily_teams: number;
  current_daily_teams: number;
  gap_daily_teams: number;
  gap_ratio: number;
  max_cpa_est: number;
};

export type MkdocAxisScores = Record<AxisId, number>;

export type MkdocReport = {
  version: 1;
  requestId: string;
  store: {
    storeName: string;
    area: string;
    category: string | null;
    roadAddress: string | null;
    placeLink: string | null;
  };
  totalScore: number;
  axes: MkdocAxisScores;
  mainType: { code: string; name: string; oneLiner: string };
  subTags: Array<{ code: string; label: string }>;
  metrics: MkdocMetrics;
  keyword: {
    summary: KeywordNetResult["summary"] | null;
    rows: KeywordNetResult["keywordNet"] | null;
  };
  sections: Record<string, any>;
  recommendations: {
    primary: string[];
    optional: string[];
  };
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mapRatingToScore(n: number): number {
  // 1..5 => 20..100
  const x = Math.max(1, Math.min(5, n));
  return clamp100(((x - 1) / 4) * 80 + 20);
}

function scoreDemandFromTop10(demand: number | null | undefined): number {
  const v = typeof demand === "number" && Number.isFinite(demand) ? demand : 0;
  // log scale: 0 -> 10, 10k -> ~60, 50k -> ~78, 200k -> ~92
  const s = Math.log10(v + 10) * 28;
  return clamp100(s);
}

function scoreCostFromBid(bid: number | null | undefined): number {
  const v = typeof bid === "number" && Number.isFinite(bid) ? bid : 0;
  // High bid => lower score. 1000 => 85, 3000 => 65, 6000 => 40, 12000 => 15
  const s = 95 - Math.log10(v + 100) * 25;
  return clamp100(s);
}

function scoreHook(hasImpulse: unknown): number {
  const yes = String(hasImpulse ?? "") === "yes";
  return yes ? 75 : 35;
}

function scoreUnitEconomics(metrics: MkdocMetrics): number {
  // gap_ratio 1.0 is ok, 1.4 is risky.
  const ratio = metrics.gap_ratio;
  const penalty = Math.max(0, Math.min(1.2, ratio - 1)) * 70;
  const s = 90 - penalty;
  return clamp100(s);
}

export function computeMetrics(answers: MkdocAnswers): MkdocMetrics {
  const avg = Math.max(0, coerceNumber(answers.avg_ticket));
  const fixed = Math.max(0, coerceNumber(answers.fixed_cost));
  const variableRate = Math.max(0, Math.min(90, coerceNumber(answers.variable_rate)));

  const current = answers.current_metric && typeof answers.current_metric === "object" ? (answers.current_metric as any) : {};
  const mode = String(current.mode ?? "sales");
  const val = Math.max(0, coerceNumber(current.value));

  const contribution = avg * (1 - variableRate / 100);
  const safeContribution = Math.max(contribution, 1);
  const bepMonthly = fixed / safeContribution;
  const bepDaily = bepMonthly / 30;

  const currentMonthlyTeams = mode === "teams" ? val : avg > 0 ? val / avg : 0;
  const currentDaily = currentMonthlyTeams / 30;
  const gapDaily = Math.max(0, bepDaily - currentDaily);
  const gapRatio = bepDaily / Math.max(currentDaily, 1);

  // Very rough maximum CPA upper bound: contribution margin per team.
  const maxCpa = Math.max(0, Math.round(contribution));

  return {
    contribution_margin: contribution,
    bep_monthly_teams: bepMonthly,
    bep_daily_teams: bepDaily,
    current_daily_teams: currentDaily,
    gap_daily_teams: gapDaily,
    gap_ratio: gapRatio,
    max_cpa_est: maxCpa,
  };
}

export function computeAxes(input: {
  answers: MkdocAnswers;
  metrics: MkdocMetrics;
  keyword?: KeywordNetResult | null;
}): MkdocAxisScores {
  const rating = Number(input.answers.place_thumbnail_ctr_self ?? 3);
  const placeCvr = Number.isFinite(rating) ? mapRatingToScore(rating) : 60;

  const demand = scoreDemandFromTop10(input.keyword?.summary?.demand_top10);
  const cost = scoreCostFromBid(input.keyword?.summary?.median_bid_pos3_top10);
  const hook = scoreHook(input.answers.has_impulse_scene);
  const unitEconomics = scoreUnitEconomics(input.metrics);

  return { demand, cost, placeCvr, hook, unitEconomics };
}

export function computeTotalScore(axes: MkdocAxisScores): number {
  // Weighted average: PlaceCVR & UnitEconomics matter more.
  const w: Record<AxisId, number> = {
    demand: 0.18,
    cost: 0.14,
    placeCvr: 0.26,
    hook: 0.18,
    unitEconomics: 0.24,
  };
  const sum = (Object.keys(w) as AxisId[]).reduce((acc, k) => acc + axes[k] * w[k], 0);
  return clamp100(sum);
}

function fillTemplateStrings(input: any, vars: Record<string, string>): any {
  if (typeof input === "string") {
    let out = input;
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(k).join(v);
    }
    return out;
  }
  if (Array.isArray(input)) {
    return input.map((x) => fillTemplateStrings(x, vars));
  }
  if (input && typeof input === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = fillTemplateStrings(v, vars);
    }
    return out;
  }
  return input;
}

export function buildReport(input: {
  requestId: string;
  placeResolved: any;
  answers: MkdocAnswers;
  keyword: KeywordNetResult | null;
}): MkdocReport {
  const metrics = computeMetrics(input.answers);
  const axes = computeAxes({ answers: input.answers, metrics, keyword: input.keyword });
  const totalScore = computeTotalScore(axes);

  const mainType = pickMainType({ axes, metrics, answers: input.answers });
  const subTags = pickSubTags({ axes, metrics, answers: input.answers, max: 2 });
  const rec = getRecommendationsForType(mainType.code);

  const storeName = String(input.placeResolved?.title ?? input.placeResolved?.storeName ?? "").trim();
  const area = String(input.placeResolved?.roadAddress ?? input.placeResolved?.address ?? "").trim();

  const vars = {
    "{{storeName}}": storeName || "매장",
    "{{area}}": area || "",
    "{{totalScore}}": String(totalScore),
    "{{mainTypeName}}": mainType.name,
    "{{bepDailyTeams}}": `${Math.round(metrics.bep_daily_teams)}`,
    "{{gapDailyTeams}}": `${Math.round(metrics.gap_daily_teams)}`,
  };

  const sections = fillTemplateStrings((reportTemplateJson as any).sections ?? {}, vars);

  return {
    version: 1,
    requestId: input.requestId,
    store: {
      storeName: storeName || String(input.answers.store_name ?? "").trim() || "매장",
      area: String(input.answers.area ?? "").trim() || area,
      category: input.placeResolved?.category ?? null,
      roadAddress: input.placeResolved?.roadAddress ?? null,
      placeLink: input.placeResolved?.link ?? null,
    },
    totalScore,
    axes,
    mainType: { code: mainType.code, name: mainType.name, oneLiner: mainType.oneLiner },
    subTags,
    metrics,
    keyword: {
      summary: input.keyword?.summary ?? null,
      rows: input.keyword?.keywordNet ?? null,
    },
    sections,
    recommendations: rec,
  };
}

