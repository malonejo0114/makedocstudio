"use client";

import { useEffect, useMemo, useState } from "react";

type TemplateItem = {
  id: string;
  title: string;
  tags: string[];
  imageUrl: string;
  isFeatured: boolean;
  createdAt: string;
};

export default function TemplatesPageClient() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const url = `/api/templates?q=${encodeURIComponent(query)}`;
    fetch(url)
      .then((response) => response.json())
      .then((payload) => {
        if (!mounted) return;
        if (Array.isArray(payload?.items)) {
          setItems(payload.items);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "템플릿 조회 실패");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [query]);

  const tagPool = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const tag of item.tags) set.add(tag);
    }
    return Array.from(set).slice(0, 10);
  }, [items]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-8">
      <section className="rounded-[32px] border border-black/10 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Template Library</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">레퍼런스 템플릿 라이브러리</h1>
        <p className="mt-2 text-sm text-black/65">태그로 템플릿을 탐색하고 스튜디오 작업의 시작점으로 선택하세요.</p>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="템플릿/태그 검색"
          className="mt-4 w-full rounded-2xl border border-black/10 px-3 py-2.5 text-sm"
        />

        {tagPool.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tagPool.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQuery(tag)}
                className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-black/65"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-black/10 bg-white p-8 text-sm text-black/55">불러오는 중...</div>
      ) : error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-black/10 bg-white p-8 text-sm text-black/55">조건에 맞는 템플릿이 없습니다.</div>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_16px_35px_-28px_rgba(0,0,0,0.45)]"
            >
              <img src={item.imageUrl} alt={item.title} className="h-44 w-full object-cover" />
              <div className="p-3">
                <h2 className="text-sm font-semibold text-[#0B0B0C]">{item.title}</h2>
                <p className="mt-1 text-xs text-black/55">{item.tags.join(" · ") || "일반 템플릿"}</p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
