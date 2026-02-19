"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

type ExampleItem = {
  id: string;
  title: string;
  tags: string[];
  imageUrl: string;
  isFeatured: boolean;
  createdAt: string;
};

export default function ExamplesPageClient() {
  const [items, setItems] = useState<ExampleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/examples")
      .then((response) => response.json())
      .then((payload) => {
        if (!mounted) return;
        if (Array.isArray(payload?.items)) {
          setItems(payload.items);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "예시를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-8">
      <section className="rounded-[32px] border border-black/10 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Examples</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">생성 예시 갤러리</h1>
        <p className="mt-2 text-sm text-black/65">
          템플릿 기반 예시를 빠르게 훑고 스튜디오에서 바로 재해석할 수 있습니다.
        </p>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-black/10 bg-white p-8 text-sm text-black/50">
          불러오는 중...
        </div>
      ) : error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{error}</div>
      ) : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_16px_35px_-30px_rgba(0,0,0,0.45)]"
            >
              <img src={item.imageUrl} alt={item.title} className="h-52 w-full object-cover" />
              <div className="space-y-1 p-3">
                <h2 className="text-sm font-semibold text-[#0B0B0C]">{item.title}</h2>
                <p className="text-xs text-black/55">{item.tags.slice(0, 3).join(" · ") || "템플릿"}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      <div>
        <Link
          href="/studio-entry"
          className="inline-flex rounded-full bg-[#0B0B0C] px-5 py-2.5 text-sm font-semibold text-[#D6FF4F]"
        >
          스튜디오에서 생성 시작
        </Link>
      </div>
    </main>
  );
}
