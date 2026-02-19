"use client";

import { useEffect, useMemo, useState } from "react";

type AdminReferenceItem = {
  id: string;
  filename?: string;
  image_url: string;
  category: string;
  description: string | null;
  tags?: string[];
  visual_guide?: string;
  headline_style?: string;
  sub_text_style?: string;
  cta_style?: string;
};

type UploadTarget = "supabase" | "local";

function tagsToString(tags?: string[]): string {
  return Array.isArray(tags) ? tags.join(", ") : "";
}

export default function AdminReferenceManager() {
  const [localItems, setLocalItems] = useState<AdminReferenceItem[]>([]);
  const [supabaseItems, setSupabaseItems] = useState<AdminReferenceItem[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [supabaseLoading, setSupabaseLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [selectedSupabaseId, setSelectedSupabaseId] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>("supabase");

  const [category, setCategory] = useState("기타");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visualGuide, setVisualGuide] = useState("");
  const [headlineStyle, setHeadlineStyle] = useState("");
  const [subTextStyle, setSubTextStyle] = useState("");
  const [ctaStyle, setCtaStyle] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractingStyle, setExtractingStyle] = useState(false);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [savingSupabase, setSavingSupabase] = useState(false);

  const selectedItem = useMemo(
    () => localItems.find((item) => item.filename === selectedFilename) ?? null,
    [localItems, selectedFilename],
  );
  const selectedSupabaseItem = useMemo(
    () => supabaseItems.find((item) => item.id === selectedSupabaseId) ?? null,
    [supabaseItems, selectedSupabaseId],
  );

  const loadLocal = async () => {
    try {
      setLocalLoading(true);
      const response = await fetch("/api/local-references");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "레퍼런스 목록 로드 실패");
      }
      const nextItems = Array.isArray(payload?.items)
        ? (payload.items as AdminReferenceItem[])
        : [];
      setLocalItems(nextItems);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "로드 실패";
      setError(messageText);
    } finally {
      setLocalLoading(false);
    }
  };

  const loadSupabase = async () => {
    try {
      setSupabaseLoading(true);
      const response = await fetch("/api/admin/reference-templates");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Supabase 템플릿 로드 실패");
      }
      const nextItems = Array.isArray(payload?.items)
        ? (payload.items as AdminReferenceItem[])
        : [];
      setSupabaseItems(nextItems);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Supabase 로드 실패";
      setError(messageText);
    } finally {
      setSupabaseLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadLocal(), loadSupabase()]);
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    setCategory(selectedItem.category || "기타");
    setDescription(selectedItem.description || "");
    setTags(tagsToString(selectedItem.tags));
    setVisualGuide(selectedItem.visual_guide || "");
    setHeadlineStyle(selectedItem.headline_style || "");
    setSubTextStyle(selectedItem.sub_text_style || "");
    setCtaStyle(selectedItem.cta_style || "");
    setMessage(null);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedSupabaseItem) {
      return;
    }

    setCategory(selectedSupabaseItem.category || "기타");
    setDescription(selectedSupabaseItem.description || "");
    setTags("");
    setVisualGuide(selectedSupabaseItem.visual_guide || "");
    setHeadlineStyle(selectedSupabaseItem.headline_style || "");
    setSubTextStyle(selectedSupabaseItem.sub_text_style || "");
    setCtaStyle(selectedSupabaseItem.cta_style || "");
    setMessage(null);
  }, [selectedSupabaseItem]);

  const saveMetadata = async (filename: string) => {
    const tagsList = tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const response = await fetch("/api/local-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        category,
        description,
        tags: tagsList,
        visual_guide: visualGuide,
        headline_style: headlineStyle,
        sub_text_style: subTextStyle,
        cta_style: ctaStyle,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "메타데이터 저장 실패");
    }
    return payload;
  };

  const onSaveCurrent = async () => {
    if (!selectedFilename) {
      setMessage("먼저 저장할 레퍼런스를 선택해 주세요.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      await saveMetadata(selectedFilename);
      await loadLocal();
      setMessage("메타데이터 저장 완료");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "저장 실패";
      setError(messageText);
    } finally {
      setSaving(false);
    }
  };

  const onUploadAndSave = async () => {
    if (!uploadFile) {
      setMessage("업로드할 이미지를 선택해 주세요.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setMessage(null);

      const formData = new FormData();
      formData.append("image", uploadFile);
      formData.append("storageTarget", uploadTarget);
      formData.append("category", category);
      formData.append("description", description);
      formData.append("visual_guide", visualGuide);
      formData.append("headline_style", headlineStyle);
      formData.append("sub_text_style", subTextStyle);
      formData.append("cta_style", ctaStyle);
      if (uploadName.trim()) {
        formData.append("filename", uploadName.trim());
      }

      const uploadResponse = await fetch("/api/admin/reference-upload", {
        method: "POST",
        body: formData,
      });
      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadPayload?.error || "이미지 업로드 실패");
      }

      if (uploadTarget === "supabase") {
        const id = String(uploadPayload?.row?.id || "");
        if (!id) {
          throw new Error("Supabase 템플릿 id를 확인할 수 없습니다.");
        }
        await loadSupabase();
        setSelectedSupabaseId(id);
        setUploadFile(null);
        setUploadName("");
        setMessage("Supabase 업로드 + 템플릿 저장 완료");
        return;
      }

      const filename = String(uploadPayload?.filename || "");
      if (!filename) {
        throw new Error("업로드 파일명을 확인할 수 없습니다.");
      }
      await saveMetadata(filename);
      await loadLocal();
      setSelectedFilename(filename);
      setUploadFile(null);
      setUploadName("");
      setMessage("업로드 및 메타데이터 저장 완료");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "업로드 실패";
      setError(messageText);
    } finally {
      setUploading(false);
    }
  };

  const onExtractStyleFromUpload = async () => {
    if (!uploadFile) {
      setMessage("먼저 분석할 이미지를 선택해 주세요.");
      return;
    }

    try {
      setExtractingStyle(true);
      setError(null);
      setMessage(null);

      const formData = new FormData();
      formData.append("image", uploadFile);
      formData.append("width", "1080");
      formData.append("height", "1080");

      const response = await fetch("/api/admin/analyze-template", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "스타일 분석 실패");
      }

      const style = payload?.style ?? {};
      setVisualGuide(typeof style.visual_guide === "string" ? style.visual_guide : "");
      setHeadlineStyle(
        typeof style.headline_style === "string" ? style.headline_style : "",
      );
      setSubTextStyle(
        typeof style.sub_text_style === "string" ? style.sub_text_style : "",
      );
      setCtaStyle(typeof style.cta_style === "string" ? style.cta_style : "");
      setMessage("AI 스타일 추출 완료 (필요하면 수정 후 저장하세요)");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "스타일 분석 실패";
      setError(messageText);
    } finally {
      setExtractingStyle(false);
    }
  };

  const onSyncToSupabase = async () => {
    if (!selectedFilename) {
      setMessage("먼저 동기화할 레퍼런스를 선택해 주세요.");
      return;
    }

    try {
      setSyncingSupabase(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/admin/sync-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedFilename }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "Supabase 동기화 실패");
      }

      setMessage(
        payload?.mode === "rich"
          ? "Supabase(스타일 컬럼 포함) 동기화 완료"
          : "Supabase(기본 컬럼) 동기화 완료",
      );
      await loadSupabase();
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "동기화 실패";
      setError(messageText);
    } finally {
      setSyncingSupabase(false);
    }
  };

  const onSaveSupabaseCurrent = async () => {
    if (!selectedSupabaseId) {
      setMessage("먼저 저장할 Supabase 템플릿을 선택해 주세요.");
      return;
    }

    try {
      setSavingSupabase(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/admin/reference-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSupabaseId,
          category,
          description,
          visual_guide: visualGuide,
          headline_style: headlineStyle,
          sub_text_style: subTextStyle,
          cta_style: ctaStyle,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Supabase 템플릿 저장 실패");
      }

      await loadSupabase();
      setMessage("Supabase 템플릿 저장 완료");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "저장 실패";
      setError(messageText);
    } finally {
      setSavingSupabase(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          1) 레퍼런스 업로드 + 스타일 저장
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          업로드 시 즉시 메타데이터(비주얼/텍스트 스타일)까지 함께 저장됩니다.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">저장 위치</span>
            <select
              value={uploadTarget}
              onChange={(event) => setUploadTarget(event.target.value as UploadTarget)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="supabase">Supabase (운영 기본)</option>
              <option value="local">Local (개발/임시)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">카테고리</span>
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">이미지 파일</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">
              파일명 접두어(선택)
            </span>
            <input
              type="text"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              placeholder="예: perfume-black-premium"
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExtractStyleFromUpload}
            disabled={extractingStyle || !uploadFile}
            className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60"
          >
            {extractingStyle ? "AI 분석 중..." : "AI로 스타일 자동 추출"}
          </button>
          <p className="text-[11px] text-slate-500">
            레퍼런스 이미지의 비주얼/헤드/서브/CTA 디자인 규칙을 자동으로 채웁니다.
          </p>
        </div>

        <label className="mt-3 block space-y-1">
          <span className="block text-xs font-medium text-slate-700">설명</span>
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 block space-y-1">
          <span className="block text-xs font-medium text-slate-700">
            비주얼 스타일 가이드(배경/조명/구도)
          </span>
          <textarea
            rows={3}
            value={visualGuide}
            onChange={(event) => setVisualGuide(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="예: 웜 베이지 배경, 우하단 제품 배치, 소프트 섀도우, 미니멀 여백"
          />
        </label>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">헤드카피 디자인</span>
            <textarea
              rows={3}
              value={headlineStyle}
              onChange={(event) => setHeadlineStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="예: 좌상단 굵은 산세리프, 블랙, 2줄까지 허용"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">서브카피 디자인</span>
            <textarea
              rows={3}
              value={subTextStyle}
              onChange={(event) => setSubTextStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="예: 헤드 아래 16-20px, 보조 톤, 가독성 우선"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">CTA 버튼 디자인</span>
            <textarea
              rows={3}
              value={ctaStyle}
              onChange={(event) => setCtaStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="예: 하단 좌측 아웃라인 버튼, 골드 보더, 고대비 텍스트"
            />
          </label>
        </div>

        {uploadTarget === "local" && (
          <label className="mt-3 block space-y-1">
            <span className="block text-xs font-medium text-slate-700">태그(콤마 구분)</span>
            <input
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="예: 프리미엄, 블랙, 고급무드"
            />
          </label>
        )}

        <button
          type="button"
          onClick={onUploadAndSave}
          disabled={uploading}
          className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {uploading ? "업로드 중..." : "업로드 + 스타일 저장"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          2) 로컬 레퍼런스 스타일 편집
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          로컬 레퍼런스의 메타데이터를 수정합니다. 필요 시 Supabase로 복제할 수 있습니다.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">편집 대상</span>
            <select
              value={selectedFilename}
              onChange={(event) => setSelectedFilename(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">레퍼런스 선택</option>
              {localItems.map((item) => (
                <option key={item.id} value={item.filename}>
                  {item.filename}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            {selectedItem ? (
              <img
                src={selectedItem.image_url}
                alt={selectedItem.filename || "reference"}
                className="h-28 w-auto rounded border border-slate-200 bg-white object-contain"
              />
            ) : (
              <div className="flex h-28 items-center justify-center">
                선택된 이미지가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">카테고리</span>
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="block text-xs font-medium text-slate-700">설명</span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-3 block space-y-1">
          <span className="block text-xs font-medium text-slate-700">태그(콤마 구분)</span>
          <input
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="예: 프리미엄, 블랙, 고급무드"
          />
        </label>

        <label className="mt-3 block space-y-1">
          <span className="block text-xs font-medium text-slate-700">
            비주얼 스타일 가이드(배경/조명/구도)
          </span>
          <textarea
            rows={3}
            value={visualGuide}
            onChange={(event) => setVisualGuide(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="예: 웜 베이지 배경, 우하단 제품 배치, 소프트 섀도우, 미니멀 여백"
          />
        </label>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">헤드카피 디자인</span>
            <textarea
              rows={3}
              value={headlineStyle}
              onChange={(event) => setHeadlineStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="예: 좌상단 굵은 산세리프, 블랙, 2줄까지 허용"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">서브카피 디자인</span>
            <textarea
              rows={3}
              value={subTextStyle}
              onChange={(event) => setSubTextStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="예: 헤드 아래 16-20px, 보조 톤, 가독성 우선"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">CTA 버튼 디자인</span>
            <textarea
              rows={3}
              value={ctaStyle}
              onChange={(event) => setCtaStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="예: 하단 좌측 아웃라인 버튼, 골드 보더, 고대비 텍스트"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveCurrent}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "저장 중..." : "선택 레퍼런스 스타일 저장"}
          </button>
          <button
            type="button"
            onClick={() => void loadLocal()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            목록 새로고침
          </button>
          <button
            type="button"
            onClick={onSyncToSupabase}
            disabled={syncingSupabase || !selectedFilename}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            {syncingSupabase ? "동기화 중..." : "선택 레퍼런스 Supabase 복제"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          3) Supabase 템플릿 스타일 편집
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          운영 템플릿(`reference_templates`)을 직접 수정합니다.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">편집 대상</span>
            <select
              value={selectedSupabaseId}
              onChange={(event) => setSelectedSupabaseId(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Supabase 템플릿 선택</option>
              {supabaseItems.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.category}] {item.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            {selectedSupabaseItem ? (
              <img
                src={selectedSupabaseItem.image_url}
                alt={selectedSupabaseItem.id}
                className="h-28 w-auto rounded border border-slate-200 bg-white object-contain"
              />
            ) : (
              <div className="flex h-28 items-center justify-center">
                선택된 이미지가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">카테고리</span>
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="block text-xs font-medium text-slate-700">설명</span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-3 block space-y-1">
          <span className="block text-xs font-medium text-slate-700">
            비주얼 스타일 가이드(배경/조명/구도)
          </span>
          <textarea
            rows={3}
            value={visualGuide}
            onChange={(event) => setVisualGuide(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">헤드카피 디자인</span>
            <textarea
              rows={3}
              value={headlineStyle}
              onChange={(event) => setHeadlineStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">서브카피 디자인</span>
            <textarea
              rows={3}
              value={subTextStyle}
              onChange={(event) => setSubTextStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">CTA 버튼 디자인</span>
            <textarea
              rows={3}
              value={ctaStyle}
              onChange={(event) => setCtaStyle(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveSupabaseCurrent}
            disabled={savingSupabase}
            className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
          >
            {savingSupabase ? "저장 중..." : "선택 Supabase 템플릿 저장"}
          </button>
          <button
            type="button"
            onClick={() => void loadSupabase()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            목록 새로고침
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">로컬 레퍼런스 목록</h2>
        {localLoading ? (
          <p className="mt-2 text-sm text-slate-500">불러오는 중...</p>
        ) : localItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">등록된 레퍼런스가 없습니다.</p>
        ) : (
          <div className="mt-3 columns-2 gap-3 md:columns-4">
            {localItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedFilename(item.filename || "")}
                className={[
                  "mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border bg-white text-left",
                  selectedFilename === item.filename
                    ? "border-emerald-400 ring-2 ring-emerald-200"
                    : "border-slate-200",
                ].join(" ")}
              >
                <img src={item.image_url} alt={item.filename} className="w-full object-cover" />
                <div className="space-y-1 p-2">
                  <p className="text-xs font-semibold text-slate-800">{item.filename}</p>
                  <p className="line-clamp-2 text-[11px] text-slate-600">
                    {item.description || "-"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Supabase 템플릿 목록</h2>
        {supabaseLoading ? (
          <p className="mt-2 text-sm text-slate-500">불러오는 중...</p>
        ) : supabaseItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">등록된 템플릿이 없습니다.</p>
        ) : (
          <div className="mt-3 columns-2 gap-3 md:columns-4">
            {supabaseItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedSupabaseId(item.id)}
                className={[
                  "mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border bg-white text-left",
                  selectedSupabaseId === item.id
                    ? "border-indigo-400 ring-2 ring-indigo-200"
                    : "border-slate-200",
                ].join(" ")}
              >
                <img src={item.image_url} alt={item.id} className="w-full object-cover" />
                <div className="space-y-1 p-2">
                  <p className="text-xs font-semibold text-slate-800">{item.category}</p>
                  <p className="line-clamp-2 text-[11px] text-slate-600">
                    {item.description || "-"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
