import { z } from "zod";

import surveyJson from "@/config/mkdoc/survey_v1.json";

export const SurveyStageSchema = z.enum(["pre", "post"]);
export type SurveyStage = z.infer<typeof SurveyStageSchema>;

const FieldTypeSchema = z.enum([
  "text",
  "textarea",
  "url",
  "number",
  "currency",
  "percent",
  "single_select",
  "multi_select",
  "multi_text",
  "rating_1_5",
]);

export type SurveyFieldType = z.infer<typeof FieldTypeSchema>;

const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export type SurveyField = {
  key: string;
  type: SurveyFieldType;
  title?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  min?: number;
  max?: number;
  minItems?: number;
  maxItems?: number;
  maxSelections?: number;
  options?: Array<z.infer<typeof OptionSchema>>;
  fields?: SurveyField[];
};

const FieldSchema: z.ZodType<SurveyField> = z.lazy(() =>
  z.object({
    key: z.string(),
    type: FieldTypeSchema,
    title: z.string().optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    helperText: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    // Optional multi-text fields may explicitly set minItems=0.
    minItems: z.number().int().nonnegative().optional(),
    maxItems: z.number().int().positive().optional(),
    maxSelections: z.number().int().positive().optional(),
    options: z.array(OptionSchema).optional(),
    fields: z.array(FieldSchema).optional(),
  }),
);

const VisibilityCondSchema = z.object({
  key: z.string(),
  eq: z.any().optional(),
  ne: z.any().optional(),
  in: z.array(z.any()).optional(),
  includes: z.any().optional(),
  truthy: z.boolean().optional(),
});

const VisibilitySchema = z.object({
  all: z.array(VisibilityCondSchema).optional(),
  any: z.array(VisibilityCondSchema).optional(),
});

export const SurveyQuestionSchema = z.object({
  id: z.string(),
  stage: SurveyStageSchema,
  key: z.string(),
  type: z.enum([
    "text",
    "textarea",
    "url",
    "number",
    "currency",
    "percent",
    "single_select",
    "multi_select",
    "multi_text",
    "rating_1_5",
    "group",
  ]),
  title: z.string(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  helperText: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  // Optional multi-text questions may explicitly set minItems=0.
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().positive().optional(),
  maxSelections: z.number().int().positive().optional(),
  options: z.array(OptionSchema).optional(),
  fields: z.array(FieldSchema).optional(),
  showWhen: VisibilitySchema.optional(),
});

export const SurveyConfigSchema = z.object({
  schemaVersion: z.string(),
  stages: z.record(
    SurveyStageSchema,
    z.object({
      title: z.string(),
      description: z.string().optional(),
      questionIds: z.array(z.string()),
    }),
  ),
  questions: z.array(SurveyQuestionSchema),
});

export type SurveyQuestion = z.infer<typeof SurveyQuestionSchema>;
export type SurveyConfig = z.infer<typeof SurveyConfigSchema>;

export const MKDOC_SURVEY_V1: SurveyConfig = SurveyConfigSchema.parse(surveyJson);

function getValueByKey(values: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) return values[key];
  const parts = key.split(".");
  let cur: any = values;
  for (const p of parts) {
    cur = cur?.[p];
  }
  return cur;
}

function matchesVisibilityCond(
  cond: z.infer<typeof VisibilityCondSchema>,
  values: Record<string, unknown>,
): boolean {
  const v = getValueByKey(values, cond.key);

  if (cond.truthy) return Boolean(v);
  if (cond.eq !== undefined) return v === cond.eq;
  if (cond.ne !== undefined) return v !== cond.ne;
  if (Array.isArray(cond.in)) return cond.in.includes(v as any);
  if (cond.includes !== undefined) {
    if (Array.isArray(v)) return v.includes(cond.includes as any);
    if (typeof v === "string") return v.includes(String(cond.includes));
    return false;
  }
  return false;
}

export function isSurveyQuestionVisible(
  question: SurveyQuestion,
  values: Record<string, unknown> | null | undefined,
): boolean {
  const showWhen = (question as any).showWhen as z.infer<typeof VisibilitySchema> | undefined;
  if (!showWhen) return true;
  const vs = values ?? {};

  const all = Array.isArray(showWhen.all) ? showWhen.all : [];
  const any = Array.isArray(showWhen.any) ? showWhen.any : [];

  if (all.length > 0) {
    for (const c of all) {
      if (!matchesVisibilityCond(c, vs)) return false;
    }
  }
  if (any.length > 0) {
    return any.some((c) => matchesVisibilityCond(c, vs));
  }
  return true;
}

export function getSurveyQuestionsByStage(
  stage: SurveyStage,
  values?: Record<string, unknown>,
): SurveyQuestion[] {
  const ids = new Set(MKDOC_SURVEY_V1.stages[stage].questionIds);
  const order = MKDOC_SURVEY_V1.stages[stage].questionIds;
  const map = new Map(MKDOC_SURVEY_V1.questions.map((q) => [q.id, q]));
  return order
    .map((id) => map.get(id))
    .filter((q): q is SurveyQuestion => Boolean(q && ids.has(q.id)))
    .filter((q) => isSurveyQuestionVisible(q, values));
}

export function isSurveyComplete(stage: SurveyStage, values: Record<string, unknown>): boolean {
  const questions = getSurveyQuestionsByStage(stage, values);
  for (const q of questions) {
    const required = q.required ?? true;
    if (!required) continue;
    if (q.type === "group") {
      const obj = (values[q.key] ?? {}) as any;
      const fields = Array.isArray(q.fields) ? q.fields : [];
      for (const f of fields) {
        if (f.required === false) continue;
        const v = obj?.[f.key];
        if (!isAnswered(v)) return false;
      }
      continue;
    }
    if (!isAnswered(values[q.key])) return false;
  }
  return true;
}

export function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as any).length > 0;
  return false;
}

export function coerceNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return 0;
  const normalized = raw.replace(/[^\d.-]/g, "");
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
