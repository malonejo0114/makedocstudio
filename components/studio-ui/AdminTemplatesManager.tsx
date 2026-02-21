"use client";

import { useEffect, useState } from "react";

import { optimizeImageForUpload } from "@/lib/studio/imageUpload.client";

type TemplateItem = {
  id: string;
  title: string;
  tags: string[];
  imageUrl: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

type Payload = {
  items: TemplateItem[];
};

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("application/json")) {
    return response.json().catch(() => null);
  }

  const rawText = await response.text().catch(() => "");
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return { rawText };
  }
}

function toErrorMessage(payload: unknown, fallback: string, responseStatus?: number): string {
  if (typeof payload === "object" && payload) {
    if ("error" in payload && typeof (payload as { error?: unknown }).error === "string") {
      return (payload as { error: string }).error;
    }
    if ("rawText" in payload && typeof (payload as { rawText?: unknown }).rawText === "string") {
      const text = (payload as { rawText: string }).rawText;
      const payloadTooLarge =
        responseStatus === 413 ||
        text.includes("FUNCTION_PAYLOAD_TOO_LARGE") ||
        text.includes("Request Entity Too Large");
      if (payloadTooLarge) {
        return "업로드 이미지 용량이 너무 큽니다. 3MB 이하(권장 2000px 이하)로 줄여 다시 시도해 주세요.";
      }
      return text.replace(/\s+/g, " ").slice(0, 180) || fallback;
    }
  }
  return fallback;
}

export default function AdminTemplatesManager() {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [featured, setFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/templates");
    const payload = (await readResponsePayload(response)) as (Payload & { error?: string }) | null;
    if (!response.ok) {
      throw new Error(toErrorMessage(payload, "템플릿 목록 조회 실패", response.status));
    }
    setItems(payload?.items || []);
  }

  useEffect(() => {
    let mounted = true;
    load()
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
  }, []);

  async function onUpload() {
    if (!uploadFile) {
      setError("업로드할 이미지를 선택해 주세요.");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const optimizedFile = await optimizeImageForUpload(uploadFile, {
        maxBytes: 3 * 1024 * 1024,
        maxEdge: 2048,
      });
      const formData = new FormData();
      formData.append("image", optimizedFile);
      formData.append("title", title);
      formData.append("tags", tags);
      formData.append("isFeatured", String(featured));

      const response = await fetch("/api/admin/templates", {
        method: "POST",
        body: formData,
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "업로드 실패", response.status));
      }

      setUploadFile(null);
      setTitle("");
      setTags("");
      setFeatured(false);
      await load();
      setMessage("템플릿 업로드를 완료했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿 업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function onPatch(item: TemplateItem, updates: Partial<TemplateItem>) {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/templates", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          title: updates.title,
          tags: updates.tags,
          isFeatured: updates.isFeatured,
        }),
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "수정 실패", response.status));
      }
      await load();
      setMessage("템플릿을 수정했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿 수정 실패");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("이 템플릿을 삭제하시겠습니까?")) return;

    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/templates", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "삭제 실패", response.status));
      }
      await load();
      setMessage("템플릿을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿 삭제 실패");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-black/10 bg-white p-4">
        <h2 className="text-lg font-semibold text-[#0B0B0C]">템플릿 업로드/태깅</h2>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="템플릿 제목"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="태그 (콤마 구분)"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70">
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => setFeatured(event.target.checked)}
            />
            Featured 표시
          </label>
        </div>

        <button
          type="button"
          onClick={() => void onUpload()}
          disabled={uploading}
          className="mt-3 rounded-full bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F]"
        >
          {uploading ? "업로드 중..." : "템플릿 업로드"}
        </button>
      </section>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <section className="rounded-[28px] border border-black/10 bg-white p-4">
        <h2 className="text-lg font-semibold text-[#0B0B0C]">템플릿 목록</h2>
        {loading ? (
          <p className="mt-3 text-sm text-black/55">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-black/55">등록된 템플릿이 없습니다.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                <img src={item.imageUrl} alt={item.title} className="h-40 w-full object-cover" />
                <div className="space-y-2 p-3">
                  <input
                    defaultValue={item.title}
                    onBlur={(event) => {
                      const next = event.target.value.trim();
                      if (next && next !== item.title) {
                        void onPatch(item, { title: next });
                      }
                    }}
                    className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm font-semibold"
                  />

                  <input
                    defaultValue={item.tags.join(",")}
                    onBlur={(event) => {
                      const nextTags = event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean);
                      if (nextTags.join(",") !== item.tags.join(",")) {
                        void onPatch(item, { tags: nextTags });
                      }
                    }}
                    className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs"
                  />

                  <label className="flex items-center gap-2 text-xs text-black/70">
                    <input
                      type="checkbox"
                      checked={item.isFeatured}
                      onChange={(event) =>
                        void onPatch(item, {
                          isFeatured: event.target.checked,
                        })
                      }
                    />
                    Featured
                  </label>

                  <button
                    type="button"
                    onClick={() => void onDelete(item.id)}
                    className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
