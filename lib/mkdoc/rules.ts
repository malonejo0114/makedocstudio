import { z } from "zod";

import ruleJson from "@/config/mkdoc/ruleTable.json";

export type AxisId = "demand" | "cost" | "placeCvr" | "hook" | "unitEconomics";

const AxisIdSchema = z.enum(["demand", "cost", "placeCvr", "hook", "unitEconomics"]);

const ConditionSchema = z.object({
  axis: AxisIdSchema.optional(),
  metric: z.string().optional(),
  answer: z.string().optional(),
  answerArrayLen: z.string().optional(),
  eq: z.any().optional(),
  in: z.array(z.any()).optional(),
  gte: z.number().optional(),
  lte: z.number().optional()
});

const TypeRuleSchema = z.object({
  code: z.string(),
  name: z.string(),
  oneLiner: z.string(),
  priority: z.number(),
  whenAny: z.array(ConditionSchema).optional(),
  whenAll: z.array(ConditionSchema).optional()
});

const SubTagSchema = z.object({
  code: z.string(),
  label: z.string(),
  whenAny: z.array(ConditionSchema).optional(),
  whenAll: z.array(ConditionSchema).optional()
});

const RuleTableSchema = z.object({
  schemaVersion: z.string(),
  axes: z.array(z.object({ id: AxisIdSchema, label: z.string() })),
  types: z.array(TypeRuleSchema),
  subTags: z.array(SubTagSchema),
  products: z.record(z.string(), z.any()),
  recommendationsByType: z.record(
    z.string(),
    z.object({
      primary: z.array(z.string()),
      optional: z.array(z.string())
    })
  )
});

export type RuleTable = z.infer<typeof RuleTableSchema>;
export type TypeRule = z.infer<typeof TypeRuleSchema>;
export type SubTagRule = z.infer<typeof SubTagSchema>;

export const MKDOC_RULE_TABLE: RuleTable = RuleTableSchema.parse(ruleJson);

function getAnswerValue(answers: Record<string, unknown>, key: string): unknown {
  // Supports nested group fields via "groupKey.fieldKey" in the future.
  if (!key.includes(".")) return answers[key];
  const parts = key.split(".");
  let cur: any = answers;
  for (const p of parts) {
    cur = cur?.[p];
  }
  return cur;
}

function matchesCond(cond: z.infer<typeof ConditionSchema>, input: {
  axes: Record<string, number>;
  metrics: Record<string, number>;
  answers: Record<string, unknown>;
}): boolean {
  const { axes, metrics, answers } = input;

  const value = (() => {
    if (cond.axis) return axes[cond.axis] ?? 0;
    if (cond.metric) return metrics[cond.metric] ?? 0;
    if (cond.answer) return getAnswerValue(answers, cond.answer);
    if (cond.answerArrayLen) {
      const arr = getAnswerValue(answers, cond.answerArrayLen);
      return Array.isArray(arr) ? arr.length : 0;
    }
    return undefined;
  })();

  if (cond.eq !== undefined) {
    return value === cond.eq;
  }
  if (cond.in) {
    return cond.in.includes(value as any);
  }

  if (typeof value === "number") {
    if (cond.gte != null && value < cond.gte) return false;
    if (cond.lte != null && value > cond.lte) return false;
    return cond.gte != null || cond.lte != null;
  }

  if (typeof value === "string") {
    if (cond.gte != null || cond.lte != null) {
      const n = Number(value);
      if (!Number.isFinite(n)) return false;
      if (cond.gte != null && n < cond.gte) return false;
      if (cond.lte != null && n > cond.lte) return false;
      return true;
    }
  }

  return false;
}

function matchesRule(rule: { whenAny?: any[]; whenAll?: any[] }, input: {
  axes: Record<string, number>;
  metrics: Record<string, number>;
  answers: Record<string, unknown>;
}): boolean {
  const any = Array.isArray(rule.whenAny) ? rule.whenAny : [];
  const all = Array.isArray(rule.whenAll) ? rule.whenAll : [];
  if (all.length > 0) {
    for (const cond of all) {
      if (!matchesCond(cond, input)) return false;
    }
  }
  if (any.length > 0) {
    return any.some((cond) => matchesCond(cond, input));
  }
  // If no conditions, treat as not matching (fallback handled separately)
  return all.length > 0;
}

export function pickMainType(input: {
  axes: Record<AxisId, number>;
  metrics: Record<string, number>;
  answers: Record<string, unknown>;
}): TypeRule {
  const candidates = MKDOC_RULE_TABLE.types
    .filter((t) => matchesRule(t, input))
    .sort((a, b) => b.priority - a.priority);

  return candidates[0] ?? MKDOC_RULE_TABLE.types[0];
}

export function pickSubTags(input: {
  axes: Record<AxisId, number>;
  metrics: Record<string, number>;
  answers: Record<string, unknown>;
  max?: number;
}): Array<{ code: string; label: string }> {
  const hits = MKDOC_RULE_TABLE.subTags
    .filter((t) => matchesRule(t, input))
    .slice(0, input.max ?? 2)
    .map((t) => ({ code: t.code, label: t.label }));
  return hits;
}

export function getRecommendationsForType(typeCode: string): { primary: string[]; optional: string[] } {
  return MKDOC_RULE_TABLE.recommendationsByType[typeCode] ?? MKDOC_RULE_TABLE.recommendationsByType.default;
}

export type ProductMeta = {
  code: string;
  name: string;
  price?: number | null;
  management_fee?: number | null;
  cpc_note?: string | null;
  active?: boolean;
};

export function getProductMeta(code: string): ProductMeta | null {
  const raw = MKDOC_RULE_TABLE.products?.[code];
  if (!raw || typeof raw !== "object") return null;
  const any = raw as any;
  const name = String(any.name ?? code).trim() || code;
  const price = any.price == null ? null : Number(any.price);
  const managementFee = any.management_fee == null ? null : Number(any.management_fee);
  const cpcNote = any.cpc_note == null ? null : String(any.cpc_note);
  const active = any.active == null ? true : Boolean(any.active);

  return {
    code,
    name,
    price: Number.isFinite(price) ? price : null,
    management_fee: Number.isFinite(managementFee) ? managementFee : null,
    cpc_note: cpcNote,
    active,
  };
}
