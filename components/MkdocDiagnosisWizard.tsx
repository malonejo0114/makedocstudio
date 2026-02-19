"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import GuidedTour, { type TourStep } from "@/components/GuidedTour";
import MkdocLogo from "@/components/MkdocLogo";
import MkdocSurveyQuestionRenderer from "@/components/MkdocSurveyQuestionRenderer";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  getSurveyQuestionsByStage,
  isSurveyComplete,
} from "@/lib/mkdoc/survey";

type PlaceCandidate = {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  telephone: string;
  link: string;
  mapx: string;
  mapy: string;
};

type PlaceResolveResponse =
  | { ok: true; items: PlaceCandidate[] }
  | { error: string; detail?: any };

type CreateRequestResponse =
  | { ok: true; request: { id: string; status: string; created_at: string } }
  | { error: string; detail?: any };

type BizType = "restaurant" | "cafe" | "bar" | "delivery" | "franchise" | "etc";

const BIZ_TYPE_OPTIONS: Array<{ value: BizType; label: string }> = [
  { value: "restaurant", label: "일반식당" },
  { value: "cafe", label: "카페/디저트" },
  { value: "bar", label: "주점/이자카야" },
  { value: "delivery", label: "배달/포장 위주" },
  { value: "franchise", label: "프랜차이즈" },
  { value: "etc", label: "기타" },
];

function isArrayOfFiles(input: unknown): input is File[] {
  return Array.isArray(input) && input.every((x) => x instanceof File);
}

function extractNaverPlaceId(raw: string | null | undefined): string | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;
  const m = input.match(/(?:m\.)?place\.naver\.com\/[^/]+\/(\d{5,})/i);
  if (m?.[1]) return m[1];
  const any = input.match(/\b(\d{7,})\b/);
  return any?.[1] ?? null;
}

async function uploadFiles(args: {
  userId: string;
  requestId: string;
  bucket: string;
  category: string;
  files: File[];
}): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const urls: string[] = [];

  for (let i = 0; i < args.files.length; i += 1) {
    const file = args.files[i];
    const ext = file.name.split(".").pop() || "png";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "png";
    const key = `diagnosis/${args.userId}/${args.requestId}/${args.category}/${Date.now()}-${i}.${safeExt}`;

    const { error } = await supabase.storage
      .from(args.bucket)
      .upload(key, file, { cacheControl: "3600", upsert: false });
    if (error) {
      const raw = error.message || "업로드 실패";
      const lower = raw.toLowerCase();
      if (lower.includes("bucket not found")) {
        throw new Error(
          `Supabase Storage에 '${args.bucket}' 버킷이 없습니다. ` +
            `Supabase SQL Editor에서 \`supabase/one_click_setup_mkdoc.sql\` (또는 \`supabase/migrations/20260214_000008_store_assets_bucket.sql\`) 을 실행하거나, ` +
            `Storage → Buckets에서 '${args.bucket}'(Public) 버킷을 생성해 주세요.`,
        );
      }
      if (lower.includes("row-level security") || lower.includes("policy") || lower.includes("permission")) {
        throw new Error(
          `Supabase Storage 업로드 권한이 없습니다. ` +
            `Supabase SQL Editor에서 \`supabase/one_click_setup_mkdoc.sql\` (또는 \`supabase/migrations/20260214_000008_store_assets_bucket.sql\`) 을 실행해 정책(RLS)을 추가한 뒤 다시 시도해 주세요.`,
        );
      }
      throw new Error(raw);
    }

    const { data } = supabase.storage.from(args.bucket).getPublicUrl(key);
    urls.push(data.publicUrl);
  }

  return urls;
}

export default function MkdocDiagnosisWizard() {
  const router = useRouter();

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [tourOpen, setTourOpen] = useState(false);
  const [tourEligible, setTourEligible] = useState(false);

  const [placeInput, setPlaceInput] = useState("");
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [selectedPlaceLink, setSelectedPlaceLink] = useState<string>("");
  const [resolving, setResolving] = useState(false);
  const [manualPlaceMode, setManualPlaceMode] = useState(false);
  const [manualStoreName, setManualStoreName] = useState("");
  const [manualRoadAddress, setManualRoadAddress] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualPlaceLink, setManualPlaceLink] = useState("");

  const [area, setArea] = useState("");
  const [bizType, setBizType] = useState<BizType>("restaurant");
  const selectedPlace = useMemo(
    () => {
      if (manualPlaceMode) {
        const title = manualStoreName.trim();
        if (!title) return null;
        return {
          title,
          category: manualCategory.trim(),
          address: manualRoadAddress.trim(),
          roadAddress: manualRoadAddress.trim(),
          telephone: "",
          link: manualPlaceLink.trim(),
          mapx: "",
          mapy: "",
        } satisfies PlaceCandidate;
      }
      return placeCandidates.find((c) => c.link === selectedPlaceLink) ?? null;
    },
    [
      manualCategory,
      manualPlaceLink,
      manualPlaceMode,
      manualRoadAddress,
      manualStoreName,
      placeCandidates,
      selectedPlaceLink,
    ],
  );

  const [exteriorFiles, setExteriorFiles] = useState<File[]>([]);
  const [interiorFiles, setInteriorFiles] = useState<File[]>([]);
  const [menuFiles, setMenuFiles] = useState<File[]>([]);

  const [values, setValues] = useState<Record<string, unknown>>({
    operation_mode: "hall",
    open_age: "m3_12",
    avg_ticket: 15000,
    fixed_cost: 6000000,
    variable_rate: 35,
    current_metric: { mode: "sales", value: 0 },
  });

  const preQuestions = useMemo(() => getSurveyQuestionsByStage("pre", values), [values]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const session = data.session;
        setSessionUserId(session?.user?.id ?? null);
        setSessionEmail(session?.user?.email ?? null);
        setAuthToken(session?.access_token ?? null);
      })
      .catch(() => {
        if (!active) return;
        setSessionUserId(null);
        setSessionEmail(null);
        setAuthToken(null);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSessionUserId(session?.user?.id ?? null);
      setSessionEmail(session?.user?.email ?? null);
      setAuthToken(session?.access_token ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Auto-start tutorial when the user has no diagnosis requests yet (first-time onboarding).
  useEffect(() => {
    if (!sessionUserId) return;
    const key = `mkdoc:tutorial:diagnosis:done:${sessionUserId}`;
    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // ignore
    }

    let active = true;
    const supabase = getSupabaseBrowserClient();
    (async () => {
      try {
        const { count, error } = await supabase
          .from("diagnosis_requests")
          .select("id", { count: "exact", head: true });
        if (!active) return;
        if (error) {
          // If DB isn't ready yet, don't auto-start (avoid confusing onboarding).
          setTourEligible(true);
          return;
        }
        const isEmpty = (count ?? 0) === 0;
        setTourEligible(true);
        if (isEmpty) setTourOpen(true);
      } catch {
        if (!active) return;
        setTourEligible(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  const tutorialSteps: TourStep[] = useMemo(
    () => [
      {
        id: "place",
        selector: '[data-tour="diag-place"]',
        title: "1) 플레이스 입력(자동/수동)",
        body: "네이버 플레이스 URL 또는 “상호+주소”를 입력해 조회하세요. 자동 매칭이 안 되면 ‘수동 입력’으로 전환해도 됩니다.",
      },
      {
        id: "upload",
        selector: '[data-tour="diag-upload"]',
        title: "2) 사진 업로드",
        body: "외부/간판, 내부, 메인 메뉴를 최소 3장 업로드하면 진단 신뢰도가 확 올라갑니다.",
      },
      {
        id: "survey",
        selector: '[data-tour="diag-survey"]',
        title: "3) 무료 설문(핵심 숫자만)",
        body: "객단가/고정비/원가율 같은 핵심 숫자만 넣어도 BEP(손익분기)와 병목을 계산합니다.",
      },
      {
        id: "submit",
        selector: '[data-tour="diag-submit"]',
        title: "4) 미리보기 리포트 생성",
        body: "버튼을 누르면 /report/<id>로 이동해 미리보기(점수 + 병목 1개)를 확인합니다. 결제 후에는 풀 리포트를 생성할 수 있어요.",
      },
    ],
    [],
  );

  const totalUploadCount = exteriorFiles.length + interiorFiles.length + menuFiles.length;
  const canSubmit =
    Boolean(sessionUserId && authToken) &&
    Boolean(selectedPlace) &&
    Boolean(!manualPlaceMode || manualRoadAddress.trim().length >= 2) &&
    area.trim().length >= 2 &&
    totalUploadCount >= 3 &&
    isSurveyComplete("pre", values);

  const resolvePlace = async () => {
    setError(null);
    if (!placeInput.trim()) {
      setError("‘상호+주소’(검색어)를 입력해 주세요.");
      return;
    }
    // Naver Local Search resolves by query (store name/address), not by URL.
    // Avoid a confusing "URL 검색" that yields empty results.
    if (/^https?:\/\//i.test(placeInput.trim())) {
      const url = placeInput.trim();
      // Convenience: move URL into the optional "place link" slot.
      setManualPlaceLink(url);
      setPlaceInput("");
      setError(
        "플레이스 URL은 ‘자동 매칭’에 직접 쓰지 않습니다. URL은 아래 ‘플레이스 링크(선택)’에 넣어뒀어요. 이제 ‘상호+주소’를 입력해 조회해 주세요.",
      );
      return;
    }
    try {
      setResolving(true);
      const fetchCandidates = async (query: string) => {
        const res = await fetch("/api/mkdoc/diagnosis/place-resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const payload = (await res.json().catch(() => ({}))) as PlaceResolveResponse;
        if (res.status === 501) {
          setManualPlaceMode(true);
          setPlaceCandidates([]);
          setSelectedPlaceLink("");
          setError(
            "네이버 플레이스 자동 매칭 키가 설정되지 않았습니다. (필요: NAVER_CLIENT_ID/NAVER_CLIENT_SECRET) " +
              "`.env.local`에 추가한 뒤 dev 서버를 재시작하면 자동 매칭이 활성화됩니다. 지금은 수동 입력 모드로 전환합니다.",
          );
          return { items: [] as PlaceCandidate[], usedQuery: query, ok: false };
        }
        if (!res.ok || "error" in payload) {
          throw new Error("error" in payload ? payload.error : "플레이스 조회 실패");
        }
        const items = Array.isArray(payload.items) ? payload.items : [];
        return { items, usedQuery: query, ok: true };
      };

      const rawQuery = placeInput.trim();
      let { items, usedQuery } = await fetchCandidates(rawQuery);

      // Fallback: if no results, try dropping the last token (often a region) then the first token (store name only).
      if (items.length === 0) {
        const tokens = rawQuery.split(/\s+/).filter(Boolean);
        const q2 = tokens.length >= 2 ? tokens.slice(0, -1).join(" ") : "";
        if (q2 && q2 !== rawQuery) {
          const r2 = await fetchCandidates(q2);
          items = r2.items;
          usedQuery = r2.usedQuery;
        }
      }
      if (items.length === 0) {
        const tokens = rawQuery.split(/\s+/).filter(Boolean);
        const q3 = tokens[0] ?? "";
        if (q3 && q3 !== usedQuery) {
          const r3 = await fetchCandidates(q3);
          items = r3.items;
          usedQuery = r3.usedQuery;
        }
      }

      if (items.length === 0) {
        setPlaceCandidates([]);
        setSelectedPlaceLink("");
        setError("검색 결과가 없습니다. ‘상호+주소’를 더 구체적으로 입력하거나, 상호만/지역만으로 다시 시도해 주세요.");
        return;
      }

      if (usedQuery !== rawQuery) {
        setError(`‘${rawQuery}’로 결과가 없어 ‘${usedQuery}’로 다시 검색했습니다. 후보를 선택해 주세요.`);
      }

      setPlaceCandidates(items);
      const preferredPlaceId = extractNaverPlaceId(manualPlaceLink);
      const preferred =
        preferredPlaceId
          ? items.find((c) => extractNaverPlaceId(c.link) === preferredPlaceId)
          : null;
      setSelectedPlaceLink(preferred?.link ?? items[0]?.link ?? "");
      setManualPlaceMode(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "플레이스 조회 실패";
      setError(msg);
      setPlaceCandidates([]);
      setSelectedPlaceLink("");
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!sessionUserId || !authToken) {
      setError("로그인이 필요합니다.");
      return;
    }
    if (!selectedPlace) {
      setError("플레이스 후보를 선택해 주세요.");
      return;
    }
    if (!canSubmit) {
      setError("필수 입력을 확인해 주세요. (상권/사진/설문)");
      return;
    }

    try {
      setLoading(true);

      // 1) Create request (preview)
      const createRes = await fetch("/api/mkdoc/diagnosis/request/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          placeRawInput:
            manualPlaceLink.trim() || placeInput.trim() || undefined,
          placeResolved: selectedPlace,
          answers: {
            ...values,
            store_name: selectedPlace.title,
            area: area.trim(),
            biz_type: bizType,
          },
          uploads: {},
        }),
      });

      const createPayload = (await createRes.json().catch(() => ({}))) as CreateRequestResponse;
      if (!createRes.ok || "error" in createPayload || !createPayload.request?.id) {
        throw new Error("error" in createPayload ? createPayload.error : "진단 요청 생성 실패");
      }
      const requestId = createPayload.request.id;

      // 2) Upload images to Supabase Storage (public bucket)
      const bucket = "store-assets";
      const [exteriorUrls, interiorUrls, menuUrls] = await Promise.all([
        uploadFiles({
          userId: sessionUserId,
          requestId,
          bucket,
          category: "exterior",
          files: exteriorFiles,
        }),
        uploadFiles({
          userId: sessionUserId,
          requestId,
          bucket,
          category: "interior",
          files: interiorFiles,
        }),
        uploadFiles({
          userId: sessionUserId,
          requestId,
          bucket,
          category: "menu",
          files: menuFiles,
        }),
      ]);

      const uploads = {
        exterior: exteriorUrls,
        interior: interiorUrls,
        menu: menuUrls,
        bucket,
        total: exteriorUrls.length + interiorUrls.length + menuUrls.length,
      };

      // 3) Patch request with uploads
      await fetch(`/api/mkdoc/diagnosis/request/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ uploads }),
      });

      router.push(`/report/${requestId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "진단 제출 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionUserId) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur">
          <MkdocLogo compact />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">진단을 시작하려면 로그인</h1>
          <p className="mt-2 text-sm text-slate-600">
            진단 요청/결제/리포트를 계정에 저장하기 위해 로그인이 필요합니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/login?service=diagnosis&next=/diagnosis"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              로그인으로 이동
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <GuidedTour
        open={tourOpen}
        steps={tutorialSteps}
        onClose={() => setTourOpen(false)}
        onComplete={() => {
          if (!sessionUserId) return;
          try {
            window.localStorage.setItem(`mkdoc:tutorial:diagnosis:done:${sessionUserId}`, "1");
          } catch {
            // ignore
          }
        }}
      />

      <header className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">진단 입력</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              마케닥 요식업 마케팅 진단 (MVP)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              결제 전에는 미리보기 점수와 병목 1개만 공개합니다.
            </p>
            {sessionEmail ? (
              <p className="mt-1 text-xs text-slate-500">로그인: {sessionEmail}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            disabled={!tourEligible}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            튜토리얼
          </button>
          <Link
            href="/"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            홈
          </Link>
          <Link
            href="/keyword-search"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            키워드 서치
          </Link>
          <Link
            href="/creative"
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            광고소재 스튜디오
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
          <p>{error}</p>
          <p className="mt-2 text-[11px] text-rose-700/90">
            설정이 필요하면{" "}
            <Link href="/setup" className="font-semibold underline">
              /setup
            </Link>
            에서 한 번에 체크할 수 있습니다.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
        <section
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]"
          data-tour="diag-place"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Place</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              플레이스 입력(자동 매칭)
            </p>
            <p className="mt-1 text-xs text-slate-600">
              “상호+주소”로 후보를 조회하고 1클릭으로 확정합니다. URL은 선택(매칭 정확도↑)입니다.
            </p>
          </div>

	          <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  입력 모드
                </p>
                <button
                  type="button"
                  onClick={() => setManualPlaceMode((prev) => !prev)}
                  className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                >
                  {manualPlaceMode ? "자동 매칭 사용" : "수동 입력"}
                </button>
              </div>

              {!manualPlaceMode ? (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-800">플레이스 검색어</span>
                    <div className="flex gap-2">
                      <input
                        value={placeInput}
                        onChange={(e) => setPlaceInput(e.target.value)}
                        className="flex-1 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                        placeholder="예: 성수 맛집 / 마왕족발 성남 / OO라멘 서울 성동구 ..."
                      />
                      <button
                        type="button"
                        onClick={() => void resolvePlace()}
                        disabled={resolving}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {resolving ? "조회중..." : "조회"}
                      </button>
                    </div>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-800">플레이스 URL(선택)</span>
                    <input
                      value={manualPlaceLink}
                      onChange={(e) => setManualPlaceLink(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      placeholder="예: https://m.place.naver.com/restaurant/..."
                    />
                    <p className="text-[11px] text-slate-500">
                      URL만으로는 자동 매칭이 어렵습니다. 상호+주소로 조회 후, URL과 일치하는 후보가 있으면 자동 선택합니다.
                    </p>
                  </label>

                  {placeCandidates.length > 0 ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold text-slate-800">매장 후보(1클릭)</span>
                      <select
                        value={selectedPlaceLink}
                        onChange={(e) => setSelectedPlaceLink(e.target.value)}
                        className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      >
                        {placeCandidates.map((c) => (
                          <option key={c.link} value={c.link}>
                            {c.title} · {c.roadAddress || c.address}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-800">매장명(필수)</span>
                    <input
                      value={manualStoreName}
                      onChange={(e) => setManualStoreName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      placeholder="예: OO라멘"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-800">주소(필수)</span>
                    <input
                      value={manualRoadAddress}
                      onChange={(e) => setManualRoadAddress(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      placeholder="예: 서울 성동구 ..."
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-800">카테고리(선택)</span>
                    <input
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      placeholder="예: 일식 > 라멘"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-800">플레이스 링크(선택)</span>
                    <input
                      value={manualPlaceLink}
                      onChange={(e) => setManualPlaceLink(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      placeholder="https://place.naver.com/..."
                    />
                  </label>
                </div>
              )}

	            <div className="grid gap-3 sm:grid-cols-2">
	              <label className="block space-y-1.5">
	                <span className="text-xs font-semibold text-slate-800">상권(필수)</span>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  placeholder="예: 성수동 / 홍대입구역"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-800">업태(시드)</span>
                <select
                  value={bizType}
                  onChange={(e) => setBizType(e.target.value as BizType)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  {BIZ_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedPlace ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">선택 매장</p>
                <p className="mt-1">{selectedPlace.title}</p>
                <p className="mt-1 text-slate-500">{selectedPlace.roadAddress || selectedPlace.address}</p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Upload
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              사진 업로드(3~12장)
            </p>
            <p className="mt-1 text-xs text-slate-600">
              최소: 외부간판/내부/메인메뉴 각 1장 이상 권장
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3" data-tour="diag-upload">
              <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-800">외부/간판</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setExteriorFiles(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm"
                />
                <p className="mt-2 text-[11px] text-slate-500">{exteriorFiles.length}장</p>
              </label>
              <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-800">내부</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setInteriorFiles(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm"
                />
                <p className="mt-2 text-[11px] text-slate-500">{interiorFiles.length}장</p>
              </label>
              <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-800">메인 메뉴</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setMenuFiles(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm"
                />
                <p className="mt-2 text-[11px] text-slate-500">{menuFiles.length}장</p>
              </label>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              총 {totalUploadCount}장 업로드 선택됨 (최소 3장)
            </div>
          </div>
        </section>

        <section
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]"
          data-tour="diag-survey"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Survey</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              무료 설문({preQuestions.length}문항)
            </p>
            <p className="mt-1 text-xs text-slate-600">
              결제 전에는 미리보기 점수/병목 1개까지만 노출됩니다.
            </p>
          </div>

          <div className="grid gap-4">
            {preQuestions.map((q) => (
              <div key={q.id} className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {q.id}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{q.title}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {q.required === false ? "선택" : "필수"}
                  </span>
                </div>
                <MkdocSurveyQuestionRenderer
                  question={q}
                  value={values[q.key]}
                  onChange={(next) => setValues((prev) => ({ ...prev, [q.key]: next }))}
                />
              </div>
            ))}
          </div>

          <div className="sticky bottom-3 mt-4" data-tour="diag-submit">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || loading}
              className="w-full rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-5 py-4 text-base font-black text-white shadow-[0_25px_80px_-60px_rgba(16,185,129,0.55)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "제출/업로드 중..." : "미리보기 리포트 생성"}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              제출 후 <span className="font-mono">/report/&lt;id&gt;</span>에서 미리보기를 확인합니다.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
