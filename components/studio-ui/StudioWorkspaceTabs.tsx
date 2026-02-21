"use client";

import { useEffect, useMemo, useState } from "react";

import GuidedTour, { type TourStep } from "@/components/GuidedTour";
import { useLocaleText } from "@/components/studio-ui/LanguageProvider";
import StudioCardNewsWorkbench from "@/components/studio-ui/StudioCardNewsWorkbench";
import StudioDirectWorkbench from "@/components/studio-ui/StudioDirectWorkbench";
import StudioWorkbench from "@/components/studio-ui/StudioWorkbench";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type StudioMode = "analyze" | "direct" | "cardnews";

type StudioWorkspaceTabsProps = {
  variant?: "classic" | "update";
};

export default function StudioWorkspaceTabs({ variant = "update" }: StudioWorkspaceTabsProps) {
  const t = useLocaleText({
    ko: {
      updateVersion: "업데이트 버전",
      updateDesc: "역할별 텍스트 스타일 제어와 최신 생성 프롬프트 개선이 적용된 워크스페이스입니다.",
      classicVersion: "기존 버전",
      classicDesc: "지금까지 사용하던 기본 제작 흐름으로 작업합니다.",
      analyze: "분석 기반 제작",
      direct: "직접 입력 제작",
      cardnews: "카드뉴스 제작",
      tutorialStart: "튜토리얼 시작",
      tutorialBanner: "분석부터 생성까지 실제 화면에서 순서대로 안내하는 스튜디오 튜토리얼을 시작해 보세요.",
    },
    en: {
      updateVersion: "Updated Version",
      updateDesc: "Workspace with improved generation prompts and role-based text-style controls.",
      classicVersion: "Classic Version",
      classicDesc: "Use the original default workflow you have used so far.",
      analyze: "Analyze-based",
      direct: "Direct Input",
      cardnews: "Card News",
      tutorialStart: "Start Tutorial",
      tutorialBanner: "Start an interactive Studio tutorial from analysis to generation on real screens.",
    },
  });
  const [mode, setMode] = useState<StudioMode>("analyze");
  const [tourOpen, setTourOpen] = useState(false);
  const [tourEligible, setTourEligible] = useState(false);
  const [tourBanner, setTourBanner] = useState(false);
  const [tourUserKey, setTourUserKey] = useState("anon");

  const tutorialSteps: TourStep[] = useMemo(
    () => [
      {
        id: "mode-analyze",
        selector: '[data-tour="studio-mode-analyze"]',
        title: "1) 분석 기반 제작",
        body: "먼저 분석 기반 제작 탭에서 레퍼런스를 넣고 구조를 파악합니다.",
      },
      {
        id: "analyze-upload",
        selector: '[data-tour="studio-analyze-upload"]',
        title: "2) 레퍼런스 업로드",
        body: "광고 레퍼런스를 올리면 레이아웃/후킹/가독성 포인트를 자동 분석합니다.",
      },
      {
        id: "analyze-run",
        selector: '[data-tour="studio-analyze-run"]',
        title: "3) 분석 실행",
        body: "분석하기 버튼을 누르면 3개 프롬프트가 자동 생성됩니다.",
      },
      {
        id: "prompt-panel",
        selector: '[data-tour="studio-prompt-panel"]',
        title: "4) 프롬프트 편집",
        body: "기획자/마케터/디자이너 프롬프트를 각각 수정해 결과 방향을 맞춥니다.",
      },
      {
        id: "generate-all",
        selector: '[data-tour="studio-generate-all"]',
        title: "5) 생성 실행",
        body: "모두 생성하기는 분석 후 활성화되며, 프롬프트별로 이미지를 순차 생성합니다.",
      },
      {
        id: "preview",
        selector: '[data-tour="studio-preview-panel"]',
        title: "6) 결과 확인",
        body: "생성 결과를 미리보기에서 확인하고 바로 다운로드할 수 있습니다.",
      },
      {
        id: "mode-direct",
        selector: '[data-tour="studio-mode-direct"]',
        title: "7) 직접 입력 제작",
        body: "이번에는 분석 없이 바로 만드는 흐름을 확인합니다.",
      },
      {
        id: "direct-prompt",
        selector: '[data-tour="studio-direct-prompt"]',
        title: "8) 직접 프롬프트 입력",
        body: "비주얼/헤드카피/CTA를 직접 입력해 즉시 생성할 수 있습니다.",
      },
      {
        id: "direct-generate",
        selector: '[data-tour="studio-direct-generate"]',
        title: "9) 바로 생성",
        body: "이 버튼으로 즉시 생성하고 원본 PNG를 내려받을 수 있습니다.",
      },
      {
        id: "mode-cardnews",
        selector: '[data-tour="studio-mode-cardnews"]',
        title: "10) 카드뉴스 제작",
        body: "카드뉴스 탭에서 슬라이드 기획을 만들고 3~8장을 순차 생성할 수 있습니다.",
      },
    ],
    [],
  );

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const userKey = data.session?.user?.id ?? "anon";
        setTourUserKey(userKey);
        const doneKey = `mkdoc:tutorial:studio:done:${userKey}`;
        const seenKey = `mkdoc:tutorial:studio:seen:${userKey}`;
        try {
          if (window.localStorage.getItem(doneKey) === "1") {
            setTourEligible(true);
            setTourBanner(false);
            return;
          }
          setTourEligible(true);
          setTourBanner(true);
          if (window.localStorage.getItem(seenKey) !== "1") {
            window.localStorage.setItem(seenKey, "1");
            setTourOpen(true);
          }
        } catch {
          setTourEligible(true);
          setTourBanner(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setTourEligible(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4 pt-1">
      <GuidedTour
        open={tourOpen}
        steps={tutorialSteps}
        onClose={() => setTourOpen(false)}
        onStepChange={(step) => {
          if (
            step.id === "mode-analyze" ||
            step.id === "analyze-upload" ||
            step.id === "analyze-run" ||
            step.id === "prompt-panel" ||
            step.id === "generate-all" ||
            step.id === "preview"
          ) {
          if (mode !== "analyze") setMode("analyze");
          return;
        }
        if (step.id === "mode-cardnews") {
          if (mode !== "cardnews") setMode("cardnews");
          return;
        }
        if (mode !== "direct") setMode("direct");
      }}
        onComplete={() => {
          try {
            window.localStorage.setItem(`mkdoc:tutorial:studio:done:${tourUserKey}`, "1");
          } catch {
            // ignore
          }
          setTourBanner(false);
        }}
      />

      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2 px-4">
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            variant === "update"
              ? "border-lime-200 bg-lime-50 text-lime-900"
              : "border-black/10 bg-white text-black/70",
          ].join(" ")}
        >
          {variant === "update" ? (
            <div className="space-y-1">
              <p className="font-semibold">{t.updateVersion}</p>
              <p>{t.updateDesc}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-semibold">{t.classicVersion}</p>
              <p>{t.classicDesc}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-black/10 bg-white p-1">
            <button
              type="button"
              data-tour="studio-mode-analyze"
              onClick={() => setMode("analyze")}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                mode === "analyze"
                  ? "bg-[#0B0B0C] text-[#D6FF4F]"
                  : "text-black/65 hover:bg-black/[0.04]",
              ].join(" ")}
            >
              {t.analyze}
            </button>
            <button
              type="button"
              data-tour="studio-mode-direct"
              onClick={() => setMode("direct")}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                mode === "direct"
                  ? "bg-[#0B0B0C] text-[#D6FF4F]"
                  : "text-black/65 hover:bg-black/[0.04]",
              ].join(" ")}
            >
              {t.direct}
            </button>
            <button
              type="button"
              data-tour="studio-mode-cardnews"
              onClick={() => setMode("cardnews")}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                mode === "cardnews"
                  ? "bg-[#0B0B0C] text-[#D6FF4F]"
                  : "text-black/65 hover:bg-black/[0.04]",
              ].join(" ")}
            >
              {t.cardnews}
            </button>
          </div>

          <button
            type="button"
            data-tour="studio-tutorial-start"
            onClick={() => setTourOpen(true)}
            disabled={!tourEligible}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70 transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {t.tutorialStart}
          </button>
        </div>

        {tourBanner ? (
          <div className="max-w-xl rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
            {t.tutorialBanner}
          </div>
        ) : null}
      </div>

      {mode === "analyze" ? (
        <StudioWorkbench />
      ) : mode === "direct" ? (
        <StudioDirectWorkbench />
      ) : (
        <StudioCardNewsWorkbench />
      )}
    </div>
  );
}
