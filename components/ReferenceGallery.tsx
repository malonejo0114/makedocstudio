"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export type ReferenceTemplate = {
  id: string;
  category: string;
  image_url: string;
  description: string | null;
  tags?: string[];
  filename?: string;
  visual_guide?: string;
  headline_style?: string;
  sub_text_style?: string;
  cta_style?: string;
  created_at: string;
  source?: "supabase" | "local";
};

type SourceFilter = "all" | "local" | "supabase";

type ReferenceGalleryProps = {
  onSelect: (template: ReferenceTemplate) => void;
  selectedId?: string | null;
  category?: string;
  className?: string;
  reloadToken?: number;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

export default function ReferenceGallery({
  onSelect,
  selectedId = null,
  category,
  className,
  reloadToken = 0,
}: ReferenceGalleryProps) {
  const [allItems, setAllItems] = useState<ReferenceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  useEffect(() => {
    let isActive = true;

    async function loadReferences() {
      try {
        setLoading(true);
        setError(null);

        const localPromise = fetch("/api/local-references")
          .then(async (response) => {
            if (!response.ok) {
              return [] as ReferenceTemplate[];
            }
            const payload = await response.json();
            const localItems = Array.isArray(payload?.items) ? payload.items : [];
            return localItems.map((item: ReferenceTemplate) => ({
              ...item,
              source: "local" as const,
            }));
          })
          .catch(() => [] as ReferenceTemplate[]);

        const supabasePromise = (async () => {
          try {
            const supabase = getSupabaseBrowserClient();
            const richQuery = await supabase
              .from("reference_templates")
              .select(
                "id, category, image_url, description, created_at, visual_guide, headline_style, sub_text_style, cta_style",
              )
              .order("created_at", { ascending: false });

            if (!richQuery.error) {
              return (richQuery.data ?? []).map((item) => ({
                ...item,
                tags: [],
                source: "supabase" as const,
              }));
            }

            const legacyQuery = await supabase
              .from("reference_templates")
              .select("id, category, image_url, description, created_at")
              .order("created_at", { ascending: false });

            if (legacyQuery.error) {
              throw new Error(legacyQuery.error.message);
            }

            return (legacyQuery.data ?? []).map((item) => ({
              ...item,
              tags: [],
              visual_guide: "",
              headline_style: "",
              sub_text_style: "",
              cta_style: "",
              source: "supabase" as const,
            }));
          } catch {
            return [] as ReferenceTemplate[];
          }
        })();

        const [localItems, supabaseItems] = await Promise.all([
          localPromise,
          supabasePromise,
        ]);

        if (isActive) {
          setAllItems([...localItems, ...supabaseItems]);
        }
      } catch (err) {
        if (isActive) {
          const message = err instanceof Error ? err.message : "Failed to load";
          setError(message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadReferences();

    return () => {
      isActive = false;
    };
  }, [reloadToken]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const item of allItems) {
      if (item.category) {
        unique.add(item.category);
      }
    }
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return allItems.filter((item) => {
      if (category && item.category !== category) {
        return false;
      }
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (sourceFilter !== "all" && item.source !== sourceFilter) {
        return false;
      }

      if (!q) {
        return true;
      }

      const haystack = [
        normalizeText(item.category),
        normalizeText(item.description),
        normalizeText(item.filename),
        normalizeText((item.tags ?? []).join(" ")),
      ].join(" ");

      return haystack.includes(q);
    });
  }, [allItems, category, categoryFilter, sourceFilter, query]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        추천 레퍼런스를 불러오는 중입니다...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        레퍼런스 로드 실패: {error}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="검색: 카테고리, 설명, 태그"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "전체 카테고리" : item}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">전체 소스</option>
            <option value="local">로컬 폴더</option>
            <option value="supabase">Supabase</option>
          </select>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            결과 {filteredItems.length} / 전체 {allItems.length}
          </span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategoryFilter("all");
              setSourceFilter("all");
            }}
            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          조건에 맞는 레퍼런스가 없습니다.
        </div>
      ) : (
        <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
          {filteredItems.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect(item)}
                className={[
                  "mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border bg-white text-left shadow-sm transition",
                  isSelected
                    ? "border-emerald-400 ring-2 ring-emerald-200"
                    : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300",
                ].join(" ")}
              >
                <img
                  src={item.image_url}
                  alt={item.description || item.category}
                  className="h-auto w-full object-cover"
                />
                <div className="space-y-1 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {item.category}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {item.source === "local" ? "local folder" : "supabase"}
                  </p>
                  <p className="line-clamp-2 text-xs text-slate-600">
                    {item.description || "고성과 광고 레퍼런스"}
                  </p>
                  {(item.visual_guide ||
                    item.headline_style ||
                    item.sub_text_style ||
                    item.cta_style) && (
                    <p className="text-[10px] font-medium text-emerald-700">
                      스타일 템플릿 포함
                    </p>
                  )}
                  {(item.tags ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(item.tags ?? []).slice(0, 4).map((tag) => (
                        <button
                          key={`${item.id}-${tag}`}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setQuery(tag);
                          }}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-200"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
