"use client";

import { useMemo } from "react";

import type { SurveyQuestion } from "@/lib/mkdoc/survey";

type Props = {
  question: SurveyQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
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

export default function MkdocSurveyQuestionRenderer(props: Props) {
  const q = props.question;

  const helper = useMemo(() => {
    const text = String((q as any).helperText ?? "").trim();
    return text || null;
  }, [q]);

  if (q.type === "single_select" && Array.isArray(q.options)) {
    const selected = String(props.value ?? "");
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => (
            <Pill
              key={opt.value}
              selected={selected === opt.value}
              onClick={() => props.onChange(opt.value)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
        {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
      </div>
    );
  }

  if (q.type === "multi_select" && Array.isArray(q.options)) {
    const selected = new Set(Array.isArray(props.value) ? props.value.map(String) : []);
    const maxSelections = typeof (q as any).maxSelections === "number" ? Number((q as any).maxSelections) : null;

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => (
            <Pill
              key={opt.value}
              selected={selected.has(opt.value)}
              onClick={() => {
                const next = new Set(selected);
                if (next.has(opt.value)) {
                  next.delete(opt.value);
                  props.onChange(Array.from(next));
                  return;
                }

                if (maxSelections && next.size >= maxSelections) {
                  // Enforce a hard cap (simple UX).
                  return;
                }

                next.add(opt.value);
                props.onChange(Array.from(next));
              }}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
        {maxSelections ? (
          <p className="text-[11px] text-slate-500">
            최대 {maxSelections}개 선택
          </p>
        ) : helper ? (
          <p className="text-[11px] text-slate-500">{helper}</p>
        ) : null}
      </div>
    );
  }

  if (q.type === "rating_1_5") {
    const selected = Number(props.value ?? 0) || 0;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <Pill key={n} selected={selected === n} onClick={() => props.onChange(n)}>
              {n}
            </Pill>
          ))}
        </div>
        {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
      </div>
    );
  }

  if (q.type === "currency") {
    const n = isFiniteNumber(props.value) ? props.value : 0;
    return (
      <div className="space-y-2">
        <input
          value={n ? n.toLocaleString("ko-KR") : ""}
          onChange={(e) => props.onChange(currencyToNumber(e.target.value))}
          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          placeholder={q.placeholder ?? ""}
          inputMode="numeric"
        />
        {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
      </div>
    );
  }

  if (q.type === "percent") {
    const n = isFiniteNumber(props.value) ? props.value : 0;
    return (
      <div className="space-y-2">
        <input
          value={n ? String(n) : ""}
          onChange={(e) => props.onChange(percentToNumber(e.target.value))}
          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          placeholder={q.placeholder ?? ""}
          inputMode="decimal"
        />
        {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
      </div>
    );
  }

  if (q.type === "number") {
    const n = isFiniteNumber(props.value) ? props.value : 0;
    return (
      <div className="space-y-2">
        <input
          value={n ? String(n) : ""}
          onChange={(e) => props.onChange(numberToNumber(e.target.value))}
          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          placeholder={q.placeholder ?? ""}
          inputMode="numeric"
        />
        {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
      </div>
    );
  }

  if (q.type === "textarea") {
    return (
      <div className="space-y-2">
        <textarea
          value={typeof props.value === "string" ? props.value : ""}
          onChange={(e) => props.onChange(e.target.value)}
          className="min-h-[120px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          placeholder={q.placeholder ?? ""}
        />
        {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
      </div>
    );
  }

  if (q.type === "url") {
    return (
      <div className="space-y-2">
        <input
          value={typeof props.value === "string" ? props.value : ""}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          placeholder={q.placeholder ?? "https://"}
          inputMode="url"
        />
        {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
      </div>
    );
  }

  if (q.type === "multi_text") {
    const raw = Array.isArray(props.value) ? props.value.map((x) => String(x ?? "")) : [];
    const maxItems = typeof (q as any).maxItems === "number" ? Number((q as any).maxItems) : 5;
    const minItems = typeof (q as any).minItems === "number" ? Number((q as any).minItems) : 0;
    const display = raw.length > 0 ? raw : minItems > 0 ? Array.from({ length: minItems }, () => "") : [""];

    const commit = (next: string[]) => {
      const trimmed = next.map((x) => x.trim());
      props.onChange(trimmed.filter((x) => x.length > 0));
    };

    return (
      <div className="space-y-2">
        <div className="space-y-2">
          {display.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                value={item}
                onChange={(e) => {
                  const next = display.slice();
                  next[idx] = e.target.value;
                  // Keep empty entries in UI; commit filters empties.
                  commit(next);
                }}
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder={q.placeholder ?? ""}
              />
              <button
                type="button"
                onClick={() => {
                  if (display.length <= Math.max(1, minItems)) return;
                  const next = display.slice();
                  next.splice(idx, 1);
                  commit(next);
                }}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            {maxItems ? `최대 ${maxItems}개` : null}
            {helper ? (maxItems ? ` · ${helper}` : helper) : null}
          </p>
          <button
            type="button"
            onClick={() => {
              if (display.length >= maxItems) return;
              const next = display.concat([""]);
              commit(next);
            }}
            className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            + 추가
          </button>
        </div>
      </div>
    );
  }

  if (q.type === "group" && Array.isArray(q.fields)) {
    const obj = props.value && typeof props.value === "object" && !Array.isArray(props.value) ? (props.value as any) : {};

    const setField = (fieldKey: string, next: unknown) => {
      props.onChange({ ...obj, [fieldKey]: next });
    };

    return (
      <div className="space-y-2">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {q.fields.map((field: any) => {
            const fieldKey = String(field.key);
            const fieldValue = obj[fieldKey];
            const title = String(field.title ?? field.key);

            if (field.type === "single_select" && Array.isArray(field.options)) {
              const selected = String(fieldValue ?? "");
              return (
                <div key={fieldKey} className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">{title}</p>
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((opt: any) => (
                      <Pill
                        key={String(opt.value)}
                        selected={selected === String(opt.value)}
                        onClick={() => setField(fieldKey, opt.value)}
                      >
                        {String(opt.label)}
                      </Pill>
                    ))}
                  </div>
                </div>
              );
            }

            const type = String(field.type ?? "number");
            const numeric = type === "currency" ? currencyToNumber : type === "percent" ? percentToNumber : numberToNumber;
            const inputMode = type === "percent" ? "decimal" : "numeric";

            const displayValue = isFiniteNumber(fieldValue)
              ? type === "currency"
                ? fieldValue.toLocaleString("ko-KR")
                : String(fieldValue)
              : typeof fieldValue === "string"
                ? fieldValue
                : "";

            return (
              <label key={fieldKey} className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">{title}</span>
                <input
                  value={displayValue}
                  onChange={(e) => setField(fieldKey, numeric(e.target.value))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  placeholder={String(field.placeholder ?? "")}
                  inputMode={inputMode}
                />
              </label>
            );
          })}
        </div>
        {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
      </div>
    );
  }

  // Default: simple text input
  return (
    <div className="space-y-2">
      <input
        value={typeof props.value === "string" ? props.value : ""}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        placeholder={q.placeholder ?? ""}
      />
      {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

