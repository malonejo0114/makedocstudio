"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import MkdocLogo from "@/components/MkdocLogo";
import {
  FOOD_DIAGNOSIS_V1_QUESTIONS,
  type FoodDiagnosisV1Field,
  type FoodDiagnosisV1Question,
} from "@/config/foodservice_diagnosis_v1";
import { evaluateFoodDiagnosisV1 } from "@/lib/foodDiagnosisV1";

export const FOOD_DIAGNOSIS_V1_DRAFT_KEY = "mkdoc:food_diagnosis_v1_draft";

type StepId = "basic" | "finance" | "growth" | "assets";

const STEP_META: Array<{ id: StepId; title: string; desc: string }> = [
  {
    id: "basic",
    title: "기본/목표",
    desc: "플레이스 링크와 매장 기본 정보를 입력합니다.",
  },
  {
    id: "finance",
    title: "손익(BEP)",
    desc: "객단가·고정비·변동비로 손익분기를 계산합니다.",
  },
  {
    id: "growth",
    title: "유입/후킹",
    desc: "유입 채널/예산/후킹 상태로 병목을 분류합니다.",
  },
  {
    id: "assets",
    title: "자료/고민",
    desc: "자료를 추가하면 정확도가 올라가고, 고민을 선택하면 처방이 날카로워집니다.",
  },
];

function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as any).length > 0;
  return false;
}

function currencyToNumber(raw: string): number {
  const normalized = raw.replace(/[^\d]/g, "");
  if (!normalized) return 0;
  return Number(normalized);
}

function percentToNumber(raw: string): number {
  const normalized = raw.replace(/[^\d.]/g, "");
  if (!normalized) return 0;
  return Number(normalized);
}

function numberToNumber(raw: string): number {
  const normalized = raw.replace(/[^\d.-]/g, "");
  if (!normalized) return 0;
  return Number(normalized);
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        selected
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function groupStep(question: FoodDiagnosisV1Question): StepId {
  if (question.section === "기본" || question.section === "목표") return "basic";
  if (question.section === "손익") return "finance";
  if (
    question.section === "현황" ||
    question.section === "유입" ||
    question.section === "상품/소재"
  ) {
    return "growth";
  }
  return "assets";
}

function ensureObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function updateNestedValue(
  prev: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (!path.includes(".")) {
    return { ...prev, [path]: value };
  }
  const [root, leaf] = path.split(".", 2);
  const rootObj = ensureObject(prev[root]);
  return { ...prev, [root]: { ...rootObj, [leaf]: value } };
}

function validateField(values: Record<string, unknown>, field: FoodDiagnosisV1Field): boolean {
  if (!field.required) return true;

  if (field.type === "subgroup") {
    const subFields = Array.isArray(field.fields) ? field.fields : [];
    // subgroup itself isn't required here in v1; required is per sub-field.
    return subFields.every((sub) => validateField(ensureObject(values[field.key]) as any, sub));
  }

  const v = values[field.key];
  if (!isAnswered(v)) return false;
  if (field.type === "url") {
    return typeof v === "string" ? /^https?:\/\//i.test(v.trim()) : false;
  }

  if (typeof v === "number") {
    const min = field.validation?.min;
    const max = field.validation?.max;
    if (typeof min === "number" && v < min) return false;
    if (typeof max === "number" && v > max) return false;
  }

  return true;
}

function validateQuestion(values: Record<string, unknown>, q: FoodDiagnosisV1Question): boolean {
  if (q.type === "group") {
    const fields = Array.isArray(q.fields) ? q.fields : [];
    return fields.every((f) => {
      if (f.type === "subgroup") {
        const root = ensureObject(values[f.key]);
        const subs = Array.isArray(f.fields) ? f.fields : [];
        return subs.every((sub) => validateField(root, sub));
      }
      return validateField(values, f);
    });
  }

  if (!q.required) return true;
  const key = q.key || q.id;
  const v = values[key];
  if (!isAnswered(v)) return false;
  if (q.type === "url") {
    return typeof v === "string" ? /^https?:\/\//i.test(v.trim()) : false;
  }
  if (typeof v === "number") {
    const min = q.validation?.min;
    const max = q.validation?.max;
    if (typeof min === "number" && v < min) return false;
    if (typeof max === "number" && v > max) return false;
  }
  return true;
}

function FileList({ files }: { files: File[] }) {
  if (!files.length) return <p className="text-xs text-slate-500">선택된 파일 없음</p>;
  return (
    <ul className="mt-2 space-y-1 text-xs text-slate-700">
      {files.map((f) => (
        <li key={`${f.name}-${f.size}`}>{f.name}</li>
      ))}
    </ul>
  );
}

function FieldRenderer({
  field,
  values,
  setValues,
  nestedPrefix,
}: {
  field: FoodDiagnosisV1Field;
  values: Record<string, unknown>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  nestedPrefix?: string;
}) {
  if (field.type === "subgroup") {
    const root = ensureObject(values[field.key]);
    const subs = Array.isArray(field.fields) ? field.fields : [];
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">{field.label}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {subs.map((sub) => (
            <div key={sub.key}>
              <FieldRenderer
                field={sub}
                values={root}
                setValues={(updater) => {
                  setValues((prev) => {
                    const nextRoot =
                      typeof updater === "function" ? updater(root) : updater;
                    return { ...prev, [field.key]: nextRoot };
                  });
                }}
                nestedPrefix={field.key}
              />
            </div>
          ))}
        </div>
        {field.helperText && (
          <p className="mt-3 text-xs text-slate-600">{field.helperText}</p>
        )}
      </div>
    );
  }

  const keyPath = nestedPrefix ? `${nestedPrefix}.${field.key}` : field.key;
  const rawValue = nestedPrefix ? ensureObject(values)[field.key] : values[field.key];

  const requiredMark = field.required ? (
    <span className="ml-1 text-rose-500">*</span>
  ) : null;

  if (field.type === "text" || field.type === "url") {
    return (
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-800">
          {field.label}
          {requiredMark}
        </span>
        <input
          value={typeof rawValue === "string" ? rawValue : ""}
          onChange={(e) =>
            setValues((prev) => updateNestedValue(prev, keyPath, e.target.value))
          }
          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          placeholder={field.placeholder}
          inputMode={field.type === "url" ? "url" : "text"}
        />
      </label>
    );
  }

  if (field.type === "currency") {
    const numeric = typeof rawValue === "number" ? rawValue : 0;
    return (
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-800">
          {field.label}
          {requiredMark}
        </span>
        <input
          value={numeric.toLocaleString("ko-KR")}
          onChange={(e) =>
            setValues((prev) => updateNestedValue(prev, keyPath, currencyToNumber(e.target.value)))
          }
          inputMode="numeric"
          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>
    );
  }

  if (field.type === "percent" || field.type === "number") {
    const numeric = typeof rawValue === "number" ? rawValue : 0;
    return (
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-800">
          {field.label}
          {requiredMark}
        </span>
        <input
          value={String(numeric)}
          onChange={(e) =>
            setValues((prev) =>
              updateNestedValue(
                prev,
                keyPath,
                field.type === "percent"
                  ? percentToNumber(e.target.value)
                  : numberToNumber(e.target.value),
              ),
            )
          }
          inputMode="decimal"
          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          placeholder={field.placeholder}
        />
        {field.type === "percent" && (
          <p className="text-xs text-slate-500">예: 35 (원가+수수료 포함 대략)</p>
        )}
      </label>
    );
  }

  if (field.type === "single_select") {
    return (
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-800">
          {field.label}
          {requiredMark}
        </span>
        <select
          value={typeof rawValue === "string" ? rawValue : field.options?.[0]?.value ?? ""}
          onChange={(e) =>
            setValues((prev) => updateNestedValue(prev, keyPath, e.target.value))
          }
          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "multi_select") {
    const selected = Array.isArray(rawValue) ? rawValue.map(String) : [];
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-800">
          {field.label}
          {requiredMark}
        </p>
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <Pill
              key={opt.value}
              selected={selected.includes(opt.value)}
              onClick={() =>
                setValues((prev) => {
                  const current = Array.isArray(getValue(prev, keyPath))
                    ? (getValue(prev, keyPath) as unknown[]).map(String)
                    : [];
                  const set = new Set(current);
                  if (set.has(opt.value)) set.delete(opt.value);
                  else set.add(opt.value);
                  return updateNestedValue(prev, keyPath, Array.from(set));
                })
              }
            >
              {opt.label}
            </Pill>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "file") {
    const files = Array.isArray(rawValue) ? (rawValue as File[]) : [];
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">
          {field.label}
          {requiredMark}
        </p>
        {field.helperText && (
          <p className="mt-1 text-xs text-slate-600">{field.helperText}</p>
        )}
        <input
          type="file"
          multiple
          accept={field.accept?.join(",") || "image/*"}
          onChange={(e) =>
            setValues((prev) =>
              updateNestedValue(prev, keyPath, Array.from(e.target.files ?? [])),
            )
          }
          className="mt-3 block w-full text-sm"
        />
        <FileList files={files} />
      </div>
    );
  }

  return null;
}

function getValue(values: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return values[path];
  const [root, leaf] = path.split(".", 2);
  const rootObj = ensureObject(values[root]);
  return rootObj[leaf];
}

export default function FoodDiagnosisSurveyWizardV1() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, unknown>>({
    place_url: "",
    store_name: "",
    biz_type: "cafe",
    area: "",
    stage: "growth",
    goal: "sales_fast",
    avg_ticket: 15000,
    fixed_cost: 6000000,
    variable_rate: 35,
    monthly_teams: 0,
    revisit_rate_band: "unknown",
    budget_band: "1_30",
    channels: ["naver_place"],
    hook_level: "medium",
    place_metrics: {},
    uploads: [],
    pain_points: [],
  });

  const questionsByStep = useMemo(() => {
    const buckets: Record<StepId, FoodDiagnosisV1Question[]> = {
      basic: [],
      finance: [],
      growth: [],
      assets: [],
    };
    for (const q of [...FOOD_DIAGNOSIS_V1_QUESTIONS].sort((a, b) => a.order - b.order)) {
      buckets[groupStep(q)].push(q);
    }
    return buckets;
  }, []);

  const step = STEP_META[stepIndex];
  const stepQuestions = questionsByStep[step.id];

  const stepValid = useMemo(() => {
    return stepQuestions.every((q) => validateQuestion(values, q));
  }, [stepQuestions, values]);

  const goBack = () => {
    setError(null);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const goNext = () => {
    setError(null);
    if (!stepValid) {
      setError("필수 입력을 확인해 주세요.");
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, STEP_META.length - 1));
  };

  const onSubmit = async () => {
    setError(null);
    if (!stepValid) {
      setError("필수 입력을 확인해 주세요.");
      return;
    }

    try {
      setLoading(true);
      const result = evaluateFoodDiagnosisV1({
        questions: FOOD_DIAGNOSIS_V1_QUESTIONS,
        values,
      });

      sessionStorage.setItem(
        FOOD_DIAGNOSIS_V1_DRAFT_KEY,
        JSON.stringify({ values, result, savedAt: Date.now() }),
      );
      router.push("/diagnosis/result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "진단 생성 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">
              마케닥 요식업 진단 (MVP)
            </p>
            <p className="text-xs text-slate-500">
              근거(수치) → 진단 → 72h/14d/30d 처방
            </p>
          </div>
        </div>
        <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
          {stepIndex + 1} / {STEP_META.length}
        </div>
      </header>

      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Step {stepIndex + 1}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {step.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{step.desc}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/diagnosis")}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            홈으로
          </button>
        </div>

        <div className="mt-6 grid gap-5">
          {stepQuestions.map((q) => (
            <section
              key={q.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.18)]"
            >
              <p className="text-sm font-semibold text-slate-900">
                {q.title}
                {q.required ? <span className="ml-1 text-rose-500">*</span> : null}
              </p>
              {q.helperText && (
                <p className="mt-1 text-xs text-slate-500">{q.helperText}</p>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {q.type === "group" ? (
                  (q.fields ?? []).map((field) => (
                    <div
                      key={field.key}
                      className={field.type === "subgroup" ? "sm:col-span-2" : ""}
                    >
                      <FieldRenderer
                        field={field}
                        values={values}
                        setValues={setValues}
                      />
                    </div>
                  ))
                ) : (
                  <div className="sm:col-span-2">
                    <FieldRenderer
                      field={{
                        key: q.key || q.id,
                        label: q.title,
                        type: q.type as any,
                        required: q.required,
                        placeholder: q.placeholder,
                        options: q.options,
                        accept: q.accept,
                        maxFiles: q.maxFiles,
                        helperText: q.helperText,
                        validation: q.validation,
                      }}
                      values={values}
                      setValues={setValues}
                    />
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={loading || stepIndex === 0}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            이전
          </button>

          {stepIndex < STEP_META.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={loading}
              className="rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={loading}
              className="rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "진단 생성 중..." : "진단 결과 보기"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {STEP_META.map((s, idx) => (
          <div
            key={s.id}
            className={[
              "rounded-3xl border p-4 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.2)]",
              idx === stepIndex
                ? "border-emerald-200 bg-emerald-50"
                : "border-white/60 bg-white/60",
            ].join(" ")}
          >
            <p className="text-xs font-semibold text-slate-900">
              {idx + 1}. {s.title}
            </p>
            <p className="mt-1 text-xs text-slate-600">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
