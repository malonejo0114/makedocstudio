"use client";

import { useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import {
  clearStoredStudioVersionChoice,
  getStoredStudioVersionChoice,
  getStudioVersionRoute,
  setStoredStudioVersionChoice,
  type StudioVersionChoice,
} from "@/lib/studio/versionChoice.client";

const UPDATE_READY_FEATURES = [
  "현재 화면 편집값(prompt override)으로 즉시 생성",
  "헤드/서브/CTA 역할별 텍스트 스타일 지정",
  "레퍼런스 분석 기반 3프롬프트 + 직접 입력 생성",
  "모델별 단가/크레딧 차감 + 프로젝트 히스토리 저장",
  "튜토리얼 가이드 및 추천 레퍼런스 템플릿",
];

export default function StudioVersionEntryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState<StudioVersionChoice | null>(null);

  useEffect(() => {
    const reset = searchParams.get("reset") === "1";
    if (reset) {
      clearStoredStudioVersionChoice();
      setReady(true);
      return;
    }

    const stored = getStoredStudioVersionChoice();
    if (stored) {
      router.replace(getStudioVersionRoute(stored));
      return;
    }

    setReady(true);
  }, [router, searchParams]);

  function selectVersion(version: StudioVersionChoice) {
    setSaving(version);
    setStoredStudioVersionChoice(version);
    router.push(getStudioVersionRoute(version));
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        <div className="rounded-[28px] border border-black/10 bg-white p-8 text-sm text-black/60">
          작업공간 선택 정보를 확인하는 중입니다...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-8">
      <section className="rounded-[32px] border border-black/10 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Workspace Select</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0B0B0C]">처음 사용할 스튜디오 버전을 선택해 주세요</h1>
        <p className="mt-2 text-sm text-black/60">
          첫 로그인에서 한 번 선택하면 다음부터 자동 진입합니다. 계정 페이지에서 언제든 다시 선택할 수 있습니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[28px] border border-black/10 bg-white p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Classic</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#0B0B0C]">기존 버전</h2>
          <p className="mt-2 text-sm text-black/65">
            지금까지 사용하던 기본 스튜디오 흐름으로 바로 진입합니다.
          </p>
          <button
            type="button"
            onClick={() => selectVersion("classic")}
            disabled={saving !== null}
            className="mt-5 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving === "classic" ? "이동 중..." : "기존 버전으로 시작"}
          </button>
        </article>

        <article className="rounded-[28px] border border-[#D6FF4F]/60 bg-[#0B0B0C] p-6 text-[#F5F5F0]">
          <p className="text-xs uppercase tracking-[0.18em] text-[#D6FF4F]/85">Update</p>
          <h2 className="mt-2 text-2xl font-semibold">업데이트 버전</h2>
          <p className="mt-2 text-sm text-white/75">최신 생성 품질 개선과 텍스트 스타일 제어 기능이 포함됩니다.</p>
          <ul className="mt-4 space-y-1.5 text-sm text-white/85">
            {UPDATE_READY_FEATURES.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => selectVersion("update")}
            disabled={saving !== null}
            className="mt-5 rounded-full bg-[#D6FF4F] px-4 py-2 text-sm font-semibold text-[#0B0B0C] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving === "update" ? "이동 중..." : "업데이트 버전으로 시작"}
          </button>
        </article>
      </section>
    </main>
  );
}
