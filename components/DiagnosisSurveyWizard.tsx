"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import MkdocLogo from "@/components/MkdocLogo";
import { evaluateDiagnosisV12, type DiagnosisAnswersV12 } from "@/lib/diagnosis";

export const DIAGNOSIS_DRAFT_KEY = "mkdoc:diagnosis_v12_draft";

const BUSINESS_TYPE_OPTIONS: Array<{ value: DiagnosisAnswersV12["businessType"]; label: string }> =
  [
    { value: "cafe", label: "카페" },
    { value: "bar", label: "술집" },
    { value: "bbq", label: "고깃집" },
    { value: "ramen", label: "라멘" },
    { value: "korean", label: "한식" },
    { value: "delivery_only", label: "배달전문" },
    { value: "franchise", label: "프차" },
    { value: "etc", label: "기타" },
  ];

const CHANNEL_OPTIONS: Array<{
  value: DiagnosisAnswersV12["mainChannels"][number];
  label: string;
}> = [
  { value: "place_search", label: "플레이스 검색" },
  { value: "walk_in", label: "길가 유입" },
  { value: "instagram", label: "인스타·SNS" },
  { value: "daangn", label: "당근" },
  { value: "referral", label: "지인추천" },
  { value: "delivery_app", label: "배달앱" },
];

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

function RatingPills({
  value,
  onChange,
  allowUnset = false,
}: {
  value: (1 | 2 | 3 | 4 | 5) | null;
  onChange: (v: (1 | 2 | 3 | 4 | 5) | null) => void;
  allowUnset?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowUnset && (
        <Pill selected={value === null} onClick={() => onChange(null)}>
          선택 안함
        </Pill>
      )}
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <Pill key={n} selected={value === n} onClick={() => onChange(n)}>
          {n}
        </Pill>
      ))}
    </div>
  );
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

type StepId = "basic" | "finance" | "marketing" | "place";

const STEPS: Array<{ id: StepId; title: string; desc: string }> = [
  {
    id: "basic",
    title: "기본 정보",
    desc: "업태/운영 형태/오픈 시점을 입력합니다.",
  },
  {
    id: "finance",
    title: "손익(BEP)",
    desc: "객단가·고정비·변동비로 손익분기 위험도를 계산합니다.",
  },
  {
    id: "marketing",
    title: "유입 & 신뢰",
    desc: "유입 경로/리뷰 상태로 병목을 분류합니다.",
  },
  {
    id: "place",
    title: "플레이스/썸네일",
    desc: "대표사진 클릭감과 후킹 요소를 체크합니다.",
  },
];

export default function DiagnosisSurveyWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [storeName, setStoreName] = useState("");
  const [answers, setAnswers] = useState<DiagnosisAnswersV12>({
    storeName: undefined,
    businessType: "cafe",
    operationMode: "hall",
    openAge: "m3_12",
    avgTicket: 15000,
    monthlyFixedCost: 6000000,
    variableRatePercent: 35,
    currentMetricMode: "sales",
    currentMonthlySales: 0,
    currentMonthlyTeams: 0,
    monthlyAdBudgetRange: "0_30",
    mainChannels: ["place_search"],
    placeThumbnailCtrSelf: 3,
    reviewsVisitRange: "0_30",
    reviewsBlogRange: "0_10",
    hasImpulseScene: false,
    axisAccuracySelf: undefined,
    axisFreshnessSelf: undefined,
    axisPopularitySelf: undefined,
  });

  const step = STEPS[stepIndex];

  const stepIsValid = useMemo(() => {
    if (step.id === "basic") {
      return Boolean(answers.businessType && answers.operationMode && answers.openAge);
    }
    if (step.id === "finance") {
      if (!answers.avgTicket || answers.avgTicket <= 0) return false;
      if (!answers.monthlyFixedCost || answers.monthlyFixedCost <= 0) return false;
      if (answers.variableRatePercent <= 0 || answers.variableRatePercent >= 95) return false;
      if (answers.currentMetricMode === "sales") {
        return (answers.currentMonthlySales ?? 0) >= 0;
      }
      return (answers.currentMonthlyTeams ?? 0) >= 0;
    }
    if (step.id === "marketing") {
      return answers.mainChannels.length > 0;
    }
    if (step.id === "place") {
      return Boolean(answers.placeThumbnailCtrSelf);
    }
    return true;
  }, [answers, step.id]);

  const goNext = () => {
    setError(null);
    if (!stepIsValid) {
      setError("필수 입력을 확인해 주세요.");
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const toggleChannel = (value: DiagnosisAnswersV12["mainChannels"][number]) => {
    setAnswers((prev) => {
      const set = new Set(prev.mainChannels);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, mainChannels: Array.from(set) };
    });
  };

  const onSubmit = async () => {
    setError(null);
    if (!stepIsValid) {
      setError("필수 입력을 확인해 주세요.");
      return;
    }

    try {
      setLoading(true);
      const normalized: DiagnosisAnswersV12 = {
        ...answers,
        storeName: storeName.trim() ? storeName.trim() : undefined,
      };
      const result = evaluateDiagnosisV12(normalized);
      const payload = { answers: normalized, result, savedAt: Date.now() };
      sessionStorage.setItem(DIAGNOSIS_DRAFT_KEY, JSON.stringify(payload));
      router.push("/diagnosis/result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "진단 생성 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">마케닥 요식업 진단</p>
            <p className="text-xs text-slate-500">3분 설문 → 점수/타입 → 처방전</p>
          </div>
        </div>
        <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
          {stepIndex + 1} / {STEPS.length}
        </div>
      </header>

      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Step {stepIndex + 1}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{step.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{step.desc}</p>
          </div>
          <div className="w-full sm:w-64">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                매장명(선택)
              </span>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="예: 홍대 OO라멘"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-5">
          {step.id === "basic" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-800">업태</span>
                <select
                  value={answers.businessType}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      businessType: e.target.value as DiagnosisAnswersV12["businessType"],
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  {BUSINESS_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-800">운영 형태</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: "hall", label: "홀 위주" },
                      { value: "delivery", label: "배달 위주" },
                      { value: "mixed", label: "혼합" },
                    ] as const
                  ).map((opt) => (
                    <Pill
                      key={opt.value}
                      selected={answers.operationMode === opt.value}
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, operationMode: opt.value }))
                      }
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold text-slate-800">오픈 시점</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "lt_90", label: "90일 이내" },
                      { value: "m3_12", label: "3~12개월" },
                      { value: "gt_12", label: "1년+" },
                    ] as const
                  ).map((opt) => (
                    <Pill
                      key={opt.value}
                      selected={answers.openAge === opt.value}
                      onClick={() => setAnswers((prev) => ({ ...prev, openAge: opt.value }))}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step.id === "finance" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-800">
                  평균 객단가(원)
                </span>
                <input
                  value={answers.avgTicket.toLocaleString("ko-KR")}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      avgTicket: currencyToNumber(e.target.value),
                    }))
                  }
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-800">
                  월 고정비 합계(원)
                </span>
                <input
                  value={answers.monthlyFixedCost.toLocaleString("ko-KR")}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      monthlyFixedCost: currencyToNumber(e.target.value),
                    }))
                  }
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-800">
                  변동비율(%)
                </span>
                <input
                  value={String(answers.variableRatePercent)}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      variableRatePercent: percentToNumber(e.target.value),
                    }))
                  }
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  placeholder="예: 35"
                />
                <p className="text-xs text-slate-500">
                  식재료 + 배달 수수료 등 변동비를 대략 입력해 주세요.
                </p>
              </label>

              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold text-slate-800">
                  현재 월 매출/팀수
                </p>
                <div className="flex flex-wrap gap-2">
                  <Pill
                    selected={answers.currentMetricMode === "sales"}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, currentMetricMode: "sales" }))
                    }
                  >
                    월 매출(원)
                  </Pill>
                  <Pill
                    selected={answers.currentMetricMode === "teams"}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, currentMetricMode: "teams" }))
                    }
                  >
                    월 방문 팀수
                  </Pill>
                </div>
                {answers.currentMetricMode === "sales" ? (
                  <input
                    value={(answers.currentMonthlySales ?? 0).toLocaleString("ko-KR")}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        currentMonthlySales: currencyToNumber(e.target.value),
                      }))
                    }
                    inputMode="numeric"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                    placeholder="예: 25,000,000"
                  />
                ) : (
                  <input
                    value={String(answers.currentMonthlyTeams ?? 0)}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        currentMonthlyTeams: currencyToNumber(e.target.value),
                      }))
                    }
                    inputMode="numeric"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                    placeholder="예: 420"
                  />
                )}
              </div>
            </div>
          )}

          {step.id === "marketing" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-800">
                  현재 월 광고 예산 구간
                </span>
                <select
                  value={answers.monthlyAdBudgetRange}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      monthlyAdBudgetRange:
                        e.target.value as DiagnosisAnswersV12["monthlyAdBudgetRange"],
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="0_30">0~30만원</option>
                  <option value="30_100">30~100만원</option>
                  <option value="100_200">100~200만원</option>
                  <option value="200_plus">200만원+</option>
                </select>
              </label>

              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold text-slate-800">주요 유입 경로(복수선택)</p>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map((opt) => (
                    <Pill
                      key={opt.value}
                      selected={answers.mainChannels.includes(opt.value)}
                      onClick={() => toggleChannel(opt.value)}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-800">
                  방문자리뷰
                </span>
                <select
                  value={answers.reviewsVisitRange}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      reviewsVisitRange:
                        e.target.value as DiagnosisAnswersV12["reviewsVisitRange"],
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="0_30">0~30</option>
                  <option value="31_100">31~100</option>
                  <option value="100_plus">100+</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-800">
                  블로그리뷰
                </span>
                <select
                  value={answers.reviewsBlogRange}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      reviewsBlogRange:
                        e.target.value as DiagnosisAnswersV12["reviewsBlogRange"],
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="0_10">0~10</option>
                  <option value="11_30">11~30</option>
                  <option value="30_plus">30+</option>
                </select>
              </label>
            </div>
          )}

          {step.id === "place" && (
            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-800">
                    플레이스 대표사진이 클릭을 부른다 (1~5)
                  </p>
                  <RatingPills
                    value={answers.placeThumbnailCtrSelf}
                    onChange={(v) =>
                      setAnswers((prev) => ({
                        ...prev,
                        placeThumbnailCtrSelf: (v ?? 3) as 1 | 2 | 3 | 4 | 5,
                      }))
                    }
                  />
                  <p className="text-xs text-slate-500">
                    1: 전혀 아님, 5: 확실히 클릭을 유도함
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-800">
                    충동 요소가 있다 (Yes/No)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Pill
                      selected={answers.hasImpulseScene === true}
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, hasImpulseScene: true }))
                      }
                    >
                      Yes
                    </Pill>
                    <Pill
                      selected={answers.hasImpulseScene === false}
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, hasImpulseScene: false }))
                      }
                    >
                      No
                    </Pill>
                  </div>
                  <p className="text-xs text-slate-500">
                    “사진 한 장만 봐도 가고 싶은 장면(메뉴/공간/퍼포먼스)”이 있는지 체크하세요.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  정밀 진단 (선택)
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  아래를 입력하면 4축 점수의 신뢰도가 올라갑니다. (미입력해도 진행 가능)
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-800">
                      정확도(정보 완성도)
                    </p>
                    <RatingPills
                      value={answers.axisAccuracySelf ?? null}
                      allowUnset
                      onChange={(v) =>
                        setAnswers((prev) => ({
                          ...prev,
                          axisAccuracySelf:
                            v == null ? undefined : (v as 1 | 2 | 3 | 4 | 5),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-800">
                      최신성(업데이트)
                    </p>
                    <RatingPills
                      value={answers.axisFreshnessSelf ?? null}
                      allowUnset
                      onChange={(v) =>
                        setAnswers((prev) => ({
                          ...prev,
                          axisFreshnessSelf:
                            v == null ? undefined : (v as 1 | 2 | 3 | 4 | 5),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-800">
                      인기도(저장/전화/길찾기)
                    </p>
                    <RatingPills
                      value={answers.axisPopularitySelf ?? null}
                      allowUnset
                      onChange={(v) =>
                        setAnswers((prev) => ({
                          ...prev,
                          axisPopularitySelf:
                            v == null ? undefined : (v as 1 | 2 | 3 | 4 | 5),
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 font-semibold hover:bg-slate-100"
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        axisAccuracySelf: undefined,
                        axisFreshnessSelf: undefined,
                        axisPopularitySelf: undefined,
                      }))
                    }
                  >
                    선택 해제
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => router.push("/diagnosis")}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            홈으로
          </button>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              disabled={loading || stepIndex === 0}
              onClick={goBack}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
            >
              이전
            </button>

            {stepIndex < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={loading}
                onClick={goNext}
                className="w-full rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 sm:w-auto"
              >
                다음
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => void onSubmit()}
                className="w-full rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 sm:w-auto"
              >
                {loading ? "진단 생성 중..." : "진단 결과 보기"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, idx) => (
          <div
            key={s.id}
            className={[
              "rounded-3xl border p-4 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.2)]",
              idx === stepIndex
                ? "border-emerald-200 bg-emerald-50"
                : "border-white/60 bg-white/60",
            ].join(" ")}
          >
            <p className="text-xs font-semibold text-slate-900">
              {idx + 1}. {s.title}
            </p>
            <p className="mt-1 text-xs text-slate-600">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
