import {
  FOOD_DIAGNOSIS_V1_DIMENSION_SCORING,
  FOOD_DIAGNOSIS_V1_DIMENSIONS,
  FOOD_DIAGNOSIS_V1_REPORT_PARTIALS,
  FOOD_DIAGNOSIS_V1_REPORT_TEMPLATES,
  FOOD_DIAGNOSIS_V1_SCHEMA_VERSION,
  FOOD_DIAGNOSIS_V1_TYPE_LABELS,
  FOOD_DIAGNOSIS_V1_TYPE_RULES,
  type FoodDiagnosisV1DimensionId,
  type FoodDiagnosisV1MetricId,
  type FoodDiagnosisV1Question,
  type FoodDiagnosisV1Signals,
  type FoodDiagnosisV1TypeId,
} from "@/config/foodservice_diagnosis_v1";

export type FoodDiagnosisV1Values = Record<string, unknown>;

export type FoodDiagnosisV1Metrics = Record<FoodDiagnosisV1MetricId, number>;

export type FoodDiagnosisV1DimensionScores = Record<FoodDiagnosisV1DimensionId, number>;

export type FoodDiagnosisV1SecondaryIssue = {
  id: FoodDiagnosisV1DimensionId;
  label: string;
  score: number;
};

export type FoodDiagnosisV1Report = {
  heroTitle: string;
  heroSubtitle: string;
  why: string[];
  rx_72h: string[];
  rx_14d: string[];
  rx_30d: string[];
  recommendedProducts: string[];
};

export type FoodDiagnosisV1Result = {
  schemaVersion: typeof FOOD_DIAGNOSIS_V1_SCHEMA_VERSION;
  values: FoodDiagnosisV1Values;
  metrics: FoodDiagnosisV1Metrics;
  dimensions: FoodDiagnosisV1DimensionScores;
  type: { id: FoodDiagnosisV1TypeId; label: string };
  secondaryIssues: FoodDiagnosisV1SecondaryIssue[];
  report: FoodDiagnosisV1Report;
  partials: {
    placeFramework: { title: string; body: readonly string[] };
    bepBlock: { title: string; body: readonly string[] };
    paywall: {
      title: string;
      bullets: readonly string[];
      ctaPrimary: string;
      ctaSecondary: string;
    };
  };
};

const DIMENSION_LABELS: Record<FoodDiagnosisV1DimensionId, string> =
  Object.fromEntries(
    FOOD_DIAGNOSIS_V1_DIMENSIONS.map((d) => [d.id, d.label]),
  ) as Record<FoodDiagnosisV1DimensionId, string>;

function clampScore(score: number) {
  return Math.max(
    FOOD_DIAGNOSIS_V1_DIMENSION_SCORING.minScore,
    Math.min(FOOD_DIAGNOSIS_V1_DIMENSION_SCORING.maxScore, Math.round(score)),
  );
}

function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof File) return true;
  if (typeof value === "object") return Object.keys(value as any).length > 0;
  return false;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.]/g, "");
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function applySignals(
  scores: FoodDiagnosisV1DimensionScores,
  signals: FoodDiagnosisV1Signals | undefined,
) {
  if (!signals) return;
  for (const [dimension, delta] of Object.entries(signals)) {
    if (delta == null) continue;
    const key = dimension as FoodDiagnosisV1DimensionId;
    if (!(key in scores)) continue;
    scores[key] = clampScore(scores[key] + Number(delta));
  }
}

function applyNumericRules(
  scores: FoodDiagnosisV1DimensionScores,
  rules: Array<{ if: any; add: FoodDiagnosisV1Signals }> | undefined,
  rawValue: unknown,
) {
  if (!rules || !rules.length) return;
  const value = toNumber(rawValue);
  if (value == null) return;

  for (const rule of rules) {
    const cond = rule.if || {};
    const between = cond.between as [number, number] | undefined;
    let ok = true;
    if (cond.gte != null) ok = ok && value >= Number(cond.gte);
    if (cond.lte != null) ok = ok && value <= Number(cond.lte);
    if (between && between.length === 2) {
      ok = ok && value >= between[0] && value <= between[1];
    }
    if (ok) {
      applySignals(scores, rule.add);
    }
  }
}

function applyMultiSelectSignals(
  scores: FoodDiagnosisV1DimensionScores,
  rules:
    | Array<{ includes: string; add: FoodDiagnosisV1Signals }>
    | undefined,
  rawValue: unknown,
) {
  if (!rules || !rules.length) return;
  const values = Array.isArray(rawValue) ? rawValue.map(String) : [];
  for (const rule of rules) {
    if (values.includes(rule.includes)) {
      applySignals(scores, rule.add);
    }
  }
}

function getValue(values: FoodDiagnosisV1Values, path: string): unknown {
  if (!path) return undefined;
  if (!path.includes(".")) return values[path];

  const parts = path.split(".");
  let current: any = values;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export function computeFoodDiagnosisV1Metrics(values: FoodDiagnosisV1Values): FoodDiagnosisV1Metrics {
  const avg = Math.max(0, toNumber(values.avg_ticket) ?? 0);
  const fixed = Math.max(0, toNumber(values.fixed_cost) ?? 0);
  const variableRate = Math.max(
    0,
    Math.min(90, toNumber(values.variable_rate) ?? 0),
  );
  const monthlyTeams = Math.max(0, toNumber(values.monthly_teams) ?? 0);

  const contribution = avg * (1 - variableRate / 100);
  const safeContribution = Math.max(contribution, 1);
  const bepMonthly = fixed / safeContribution;
  const bepDaily = bepMonthly / 30;
  const currentDaily = monthlyTeams / 30;
  const gapDaily = Math.max(0, bepDaily - currentDaily);
  const gapRatio = bepDaily / Math.max(currentDaily, 1);

  return {
    contribution_margin: contribution,
    bep_monthly_teams: bepMonthly,
    bep_daily_teams: bepDaily,
    current_daily_teams: currentDaily,
    gap_daily_teams: gapDaily,
    gap_ratio: gapRatio,
  };
}

export function scoreFoodDiagnosisV1Dimensions(
  questions: FoodDiagnosisV1Question[],
  values: FoodDiagnosisV1Values,
): FoodDiagnosisV1DimensionScores {
  const scores = Object.fromEntries(
    FOOD_DIAGNOSIS_V1_DIMENSIONS.map((d) => [d.id, FOOD_DIAGNOSIS_V1_DIMENSION_SCORING.baseScore]),
  ) as FoodDiagnosisV1DimensionScores;

  const handleSignalsByOption = (
    selected: unknown,
    signalsByOption: Record<string, FoodDiagnosisV1Signals> | undefined,
  ) => {
    if (!signalsByOption) return;
    const key = typeof selected === "string" ? selected : String(selected ?? "");
    if (!key) return;
    applySignals(scores, signalsByOption[key]);
  };

  const visitField = (field: any, prefix?: string) => {
    const keyPath = prefix ? `${prefix}.${field.key}` : field.key;
    const value = getValue(values, keyPath);

    if (field.type === "subgroup") {
      const subgroupFields = Array.isArray(field.fields) ? field.fields : [];
      const anyAnswered = subgroupFields.some((sub: any) =>
        isAnswered(getValue(values, `${keyPath}.${sub.key}`)),
      );
      if (anyAnswered) {
        applySignals(scores, field.signals?.onAnyAnswered);
      }
      for (const sub of subgroupFields) {
        visitField(sub, keyPath);
      }
      return;
    }

    if (isAnswered(value)) {
      applySignals(scores, field.signals?.onAnswered);
      handleSignalsByOption(value, field.signalsByOption);
      applyNumericRules(scores, field.numericRules, value);
      applyMultiSelectSignals(scores, field.multiSelectSignals, value);
      applyMultiSelectSignals(scores, field.signalsByIncludes, value);
    }
  };

  for (const question of questions) {
    if (question.type === "group") {
      const groupFields = Array.isArray(question.fields) ? question.fields : [];
      const anyAnswered = groupFields.some((f) =>
        isAnswered(getValue(values, f.key)),
      );
      if (anyAnswered) {
        applySignals(scores, question.signals?.onAnswered);
      }
      for (const field of groupFields) {
        visitField(field, undefined);
      }
      continue;
    }

    const key = question.key || question.id;
    const value = values[key];
    if (!isAnswered(value)) continue;

    applySignals(scores, question.signals?.onAnswered);
    handleSignalsByOption(value, question.signalsByOption);
    applyNumericRules(scores, question.numericRules, value);
    applyMultiSelectSignals(scores, question.multiSelectSignals, value);
    applyMultiSelectSignals(scores, (question as any).signalsByIncludes, value);
  }

  return scores;
}

function matchesNumberRule(value: number, cond: { gte?: number; lte?: number; between?: [number, number] }): boolean {
  if (cond.gte != null && value < cond.gte) return false;
  if (cond.lte != null && value > cond.lte) return false;
  if (cond.between && cond.between.length === 2) {
    if (value < cond.between[0] || value > cond.between[1]) return false;
  }
  return true;
}

export function pickFoodDiagnosisV1Type(input: {
  values: FoodDiagnosisV1Values;
  metrics: FoodDiagnosisV1Metrics;
  dimensions: FoodDiagnosisV1DimensionScores;
}): FoodDiagnosisV1TypeId {
  const rules = [...FOOD_DIAGNOSIS_V1_TYPE_RULES].sort((a, b) => b.priority - a.priority);

  const getArray = (path: string) => {
    const v = getValue(input.values, path);
    return Array.isArray(v) ? v.map(String) : [];
  };

  const evalCondition = (cond: any): boolean => {
    if (cond.metric) {
      const m = input.metrics[cond.metric as FoodDiagnosisV1MetricId];
      if (typeof m !== "number") return false;
      return matchesNumberRule(m, cond);
    }
    if (cond.dimension) {
      const d = input.dimensions[cond.dimension as FoodDiagnosisV1DimensionId];
      if (typeof d !== "number") return false;
      return matchesNumberRule(d, cond);
    }
    if (cond.answer) {
      const raw = getValue(input.values, cond.answer as string);
      if (cond.eq != null) return String(raw ?? "") === String(cond.eq);
      if (cond.ne != null) return String(raw ?? "") !== String(cond.ne);
      if (Array.isArray(cond.in)) return cond.in.map(String).includes(String(raw ?? ""));

      const n = toNumber(raw);
      if (n == null) return false;
      return matchesNumberRule(n, cond);
    }
    if (cond.answerIncludes) {
      const path = String(cond.answerIncludes.path || "");
      const value = String(cond.answerIncludes.value || "");
      return getArray(path).includes(value);
    }
    if (cond.answerArrayLen) {
      const path = String(cond.answerArrayLen.path || "");
      const len = getArray(path).length;
      return matchesNumberRule(len, cond.answerArrayLen);
    }
    return false;
  };

  for (const rule of rules) {
    const any = Array.isArray(rule.whenAny) ? rule.whenAny : [];
    const all = Array.isArray(rule.whenAll) ? rule.whenAll : [];
    const okAny = any.length ? any.some(evalCondition) : false;
    const okAll = all.length ? all.every(evalCondition) : true;
    if ((any.length && okAny) || (all.length && okAll && !any.length)) {
      return rule.typeId;
    }
    if (any.length && all.length && okAny && okAll) {
      return rule.typeId;
    }
  }

  // Fallback: pick the weakest dimension.
  const sorted = Object.entries(input.dimensions).sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0]?.[0] as FoodDiagnosisV1DimensionId | undefined;
  switch (weakest) {
    case "unit_economics":
      return "T6_UNIT_ECON_RISK";
    case "place_conversion":
      return "T4_PLACE_LEAK";
    case "review_trust":
      return "T5_REVIEW_GAP";
    case "retention":
      return "T7_RETENTION_LEAK";
    case "content_engine":
      return "T9_CONTENT_STUCK";
    case "data_readiness":
      return "T10_DATA_BLIND";
    case "traffic":
      return "T1_SCALE_TRAFFIC";
    case "product_hook":
      return "T2_BUILD_HOOK";
    default:
      return "T10_DATA_BLIND";
  }
}

function formatNumber(value: number, digits = 0): string {
  const rounded =
    digits > 0 ? Math.round(value * 10 ** digits) / 10 ** digits : Math.round(value);
  if (digits > 0 && Number.isInteger(rounded)) {
    return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(rounded);
  }
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? 0 : 0,
  }).format(rounded);
}

function formatCurrencyLike(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function labelBizType(raw: unknown): string {
  const v = String(raw ?? "");
  switch (v) {
    case "cafe":
      return "카페/디저트";
    case "restaurant":
      return "일반식당";
    case "bar":
      return "주점/이자카야";
    case "delivery":
      return "배달전문";
    case "franchise":
      return "프랜차이즈";
    default:
      return v || "-";
  }
}

function labelStage(raw: unknown): string {
  const v = String(raw ?? "");
  switch (v) {
    case "new_90":
      return "신규오픈";
    case "growth":
      return "운영중";
    case "mature":
      return "장기운영";
    default:
      return v || "-";
  }
}

function labelBudgetBand(raw: unknown): string {
  const v = String(raw ?? "");
  switch (v) {
    case "0":
      return "0원";
    case "1_30":
      return "1~30만원";
    case "30_100":
      return "30~100만원";
    case "100_200":
      return "100~200만원";
    case "200_plus":
      return "200만원 이상";
    default:
      return v || "-";
  }
}

function labelHookLevel(raw: unknown): string {
  const v = String(raw ?? "");
  switch (v) {
    case "strong":
      return "강";
    case "medium":
      return "중";
    case "weak":
      return "약";
    default:
      return v || "-";
  }
}

function labelRevisitBand(raw: unknown): string {
  const v = String(raw ?? "");
  switch (v) {
    case "unknown":
      return "모름/측정 안 됨";
    case "0_10":
      return "0~10%";
    case "10_25":
      return "10~25%";
    case "25_40":
      return "25~40%";
    case "40_plus":
      return "40% 이상";
    default:
      return v || "-";
  }
}

function labelChannels(raw: unknown): string {
  const channels = Array.isArray(raw) ? raw.map(String) : [];
  const toLabel = (value: string) => {
    switch (value) {
      case "naver_place":
        return "플레이스";
      case "naver_search":
        return "네이버검색";
      case "delivery_app":
        return "배달앱";
      case "instagram":
        return "인스타";
      case "tiktok":
        return "틱톡";
      case "threads":
        return "스레드";
      case "carrot":
        return "당근";
      case "offline_repeat":
        return "입소문/단골";
      default:
        return value;
    }
  };
  const labels = channels.map(toLabel).filter(Boolean);
  return labels.length ? labels.join(", ") : "-";
}

function labelPainPoints(raw: unknown): string {
  const values = Array.isArray(raw) ? raw.map(String) : [];
  const toLabel = (value: string) => {
    switch (value) {
      case "no_exposure":
        return "노출 부족";
      case "low_click":
        return "클릭 낮음(썸네일)";
      case "low_visit":
        return "방문/전화 낮음";
      case "low_reviews":
        return "리뷰 약함";
      case "low_repeat":
        return "재방문 낮음";
      case "low_ticket":
        return "객단가 낮음";
      case "high_cogs":
        return "원가 높음";
      case "no_content":
        return "콘텐츠 부족";
      default:
        return value;
    }
  };
  const labels = values.map(toLabel).filter(Boolean);
  return labels.length ? labels.join(", ") : "-";
}

function renderTokens(input: { values: FoodDiagnosisV1Values; metrics: FoodDiagnosisV1Metrics }): Record<string, string> {
  const storeName = String(input.values.store_name ?? "").trim() || "내 매장";
  const contribution = input.metrics.contribution_margin ?? 0;
  const bepMonthly = input.metrics.bep_monthly_teams ?? 0;
  const bepDaily = input.metrics.bep_daily_teams ?? 0;
  const currentDaily = input.metrics.current_daily_teams ?? 0;
  const gapDaily = input.metrics.gap_daily_teams ?? 0;
  const gapRatio = input.metrics.gap_ratio ?? 0;

  return {
    store_name: storeName,
    biz_type: labelBizType(input.values.biz_type),
    area: String(input.values.area ?? "").trim() || "-",
    stage: labelStage(input.values.stage),
    avg_ticket: formatCurrencyLike(toNumber(input.values.avg_ticket) ?? 0),
    fixed_cost: formatCurrencyLike(toNumber(input.values.fixed_cost) ?? 0),
    variable_rate: formatNumber(toNumber(input.values.variable_rate) ?? 0, 0),
    monthly_teams: formatNumber(toNumber(input.values.monthly_teams) ?? 0, 0),
    revisit_rate_band: labelRevisitBand(input.values.revisit_rate_band),
    budget_band: labelBudgetBand(input.values.budget_band),
    channels: labelChannels(input.values.channels),
    hook_level: labelHookLevel(input.values.hook_level),
    visitor_reviews: formatNumber(toNumber(input.values.visitor_reviews) ?? 0, 0),
    blog_reviews: formatNumber(toNumber(input.values.blog_reviews) ?? 0, 0),
    rating: formatNumber(toNumber(input.values.rating) ?? 0, 1),
    saves: formatNumber(toNumber(input.values.saves) ?? 0, 0),
    pain_points: labelPainPoints(input.values.pain_points),

    contribution_margin: formatCurrencyLike(contribution),
    bep_monthly_teams: formatNumber(Math.ceil(bepMonthly), 0),
    bep_daily_teams: formatNumber(Math.ceil(bepDaily * 10) / 10, 1),
    current_daily_teams: formatNumber(Math.ceil(currentDaily * 10) / 10, 1),
    gap_daily_teams: formatNumber(Math.ceil(gapDaily * 10) / 10, 1),
    gap_ratio: `${formatNumber(Math.round(gapRatio * 10) / 10, 1)}배`,
  };
}

function renderText(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, token) => {
    const value = tokens[token];
    return value != null && value !== "" ? value : "-";
  });
}

function renderLines(lines: readonly string[], tokens: Record<string, string>): string[] {
  return [...lines].map((line) => renderText(line, tokens));
}

export function evaluateFoodDiagnosisV1(input: {
  questions: FoodDiagnosisV1Question[];
  values: FoodDiagnosisV1Values;
}): FoodDiagnosisV1Result {
  const metrics = computeFoodDiagnosisV1Metrics(input.values);
  const dimensions = scoreFoodDiagnosisV1Dimensions(input.questions, input.values);
  const typeId = pickFoodDiagnosisV1Type({ values: input.values, metrics, dimensions });
  const typeLabel = FOOD_DIAGNOSIS_V1_TYPE_LABELS[typeId] || typeId;

  const secondaryIssues = Object.entries(dimensions)
    .map(([id, score]) => ({
      id: id as FoodDiagnosisV1DimensionId,
      label: DIMENSION_LABELS[id as FoodDiagnosisV1DimensionId] || id,
      score,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const tokens = renderTokens({ values: input.values, metrics });
  const rawTemplate = FOOD_DIAGNOSIS_V1_REPORT_TEMPLATES[typeId];
  const report: FoodDiagnosisV1Report = {
    heroTitle: renderText(rawTemplate.heroTitle, tokens),
    heroSubtitle: renderText(rawTemplate.heroSubtitle, tokens),
    why: renderLines(rawTemplate.why, tokens),
    rx_72h: renderLines(rawTemplate.rx_72h, tokens),
    rx_14d: renderLines(rawTemplate.rx_14d, tokens),
    rx_30d: renderLines(rawTemplate.rx_30d, tokens),
    recommendedProducts: renderLines(rawTemplate.recommendedProducts, tokens),
  };

  const partials = {
    placeFramework: {
      title: FOOD_DIAGNOSIS_V1_REPORT_PARTIALS.place_framework.title,
      body: FOOD_DIAGNOSIS_V1_REPORT_PARTIALS.place_framework.body,
    },
    bepBlock: {
      title: FOOD_DIAGNOSIS_V1_REPORT_PARTIALS.bep_block.title,
      body: renderLines(FOOD_DIAGNOSIS_V1_REPORT_PARTIALS.bep_block.body, tokens),
    },
    paywall: {
      title: FOOD_DIAGNOSIS_V1_REPORT_PARTIALS.paywall_copy.title,
      bullets: FOOD_DIAGNOSIS_V1_REPORT_PARTIALS.paywall_copy.bullets,
      ctaPrimary: FOOD_DIAGNOSIS_V1_REPORT_PARTIALS.paywall_copy.ctaPrimary,
      ctaSecondary: FOOD_DIAGNOSIS_V1_REPORT_PARTIALS.paywall_copy.ctaSecondary,
    },
  };

  return {
    schemaVersion: FOOD_DIAGNOSIS_V1_SCHEMA_VERSION,
    values: input.values,
    metrics,
    dimensions,
    type: { id: typeId, label: typeLabel },
    secondaryIssues,
    report,
    partials,
  };
}
