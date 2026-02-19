"use client";

import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase";

type GenerationRecord = {
  id: string;
  used_reference_id: string | null;
  source_generation_id: string | null;
  scenario: string;
  scenario_desc: string;
  output_mode: "image_with_text" | "image_only";
  text_mode: "auto" | "custom";
  width: number;
  height: number;
  visual_guide: string;
  headline: string;
  sub_text: string;
  cta: string;
  final_prompt: string;
  model: string;
  generated_image: string;
  created_at: string;
};

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

export default function GenerationHistory() {
  const [items, setItems] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenLoadingId, setRegenLoadingId] = useState<string | null>(null);
  const [legacyMode, setLegacyMode] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const richQuery = await supabase
        .from("generations")
        .select(
          "id, used_reference_id, source_generation_id, scenario, scenario_desc, output_mode, text_mode, width, height, visual_guide, headline, sub_text, cta, final_prompt, model, generated_image, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(40);

      if (!richQuery.error) {
        setLegacyMode(false);
        setItems((richQuery.data ?? []) as GenerationRecord[]);
        return;
      }

      const legacyQuery = await supabase
        .from("generations")
        .select("id, used_reference_id, scenario, text_mode, headline, sub_text, cta, created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (legacyQuery.error) {
        throw new Error(legacyQuery.error.message);
      }
      setLegacyMode(true);

      const legacyMapped = (legacyQuery.data ?? []).map((row: any) => ({
        id: row.id,
        used_reference_id: row.used_reference_id ?? null,
        source_generation_id: null,
        scenario: row.scenario ?? "",
        scenario_desc: "",
        output_mode: "image_with_text",
        text_mode: (row.text_mode ?? "auto") as "auto" | "custom",
        width: 1080,
        height: 1080,
        visual_guide: "",
        headline: row.headline ?? "",
        sub_text: row.sub_text ?? "",
        cta: row.cta ?? "",
        final_prompt: "",
        model: "",
        generated_image: "",
        created_at: row.created_at ?? "",
      })) as GenerationRecord[];

      setItems(legacyMapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "히스토리 조회 실패";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onRegenerate = async (item: GenerationRecord) => {
    try {
      setRegenLoadingId(item.id);
      setError(null);

      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceGenerationId: item.id,
          usedReferenceId: item.used_reference_id,
          scenario: item.scenario,
          scenarioDesc: item.scenario_desc,
          outputMode: item.output_mode,
          textMode: item.text_mode,
          width: item.width,
          height: item.height,
          visualGuide: item.visual_guide,
          headline: item.headline,
          subText: item.sub_text,
          cta: item.cta,
          finalPrompt: item.final_prompt,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "재생성 실패");
      }

      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "재생성 실패";
      setError(message);
    } finally {
      setRegenLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        생성 히스토리 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        저장된 생성 히스토리가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                {item.scenario}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                {item.output_mode}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                {item.model || "n/a"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                {item.width}x{item.height}
              </span>
              {item.source_generation_id && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                  regen
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{formatDate(item.created_at)}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              {item.generated_image ? (
                <img
                  src={item.generated_image}
                  alt="history"
                  className="h-auto w-full rounded-lg border border-slate-200 bg-white object-contain"
                />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-xs text-slate-500">
                  이미지 데이터 없음
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>
                  <strong>Headline:</strong> {item.headline || "-"}
                </p>
                <p>
                  <strong>Sub:</strong> {item.sub_text || "-"}
                </p>
                <p>
                  <strong>CTA:</strong> {item.cta || "-"}
                </p>
              </div>

              <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <summary className="cursor-pointer font-semibold text-slate-800">
                  비주얼 가이드 보기
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                  {item.visual_guide || "-"}
                </pre>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <summary className="cursor-pointer font-semibold text-slate-800">
                  최종 프롬프트 보기
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                  {item.final_prompt || "-"}
                </pre>
              </details>

              <button
                type="button"
                onClick={() => onRegenerate(item)}
                disabled={regenLoadingId === item.id || !item.final_prompt}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {regenLoadingId === item.id
                  ? "재생성 중..."
                  : item.final_prompt
                    ? "이 프롬프트로 재생성"
                    : "프롬프트 없음(재생성 불가)"}
              </button>
            </div>
          </div>
        </article>
      ))}
      {legacyMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
          일부 히스토리는 레거시 데이터 형식입니다. 프롬프트가 없는 항목은 재생성이 불가합니다.
        </div>
      )}
    </div>
  );
}
