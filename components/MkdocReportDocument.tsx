"use client";

import { useMemo } from "react";

import { getProductMeta } from "@/lib/mkdoc/rules";

type AxisId = "demand" | "cost" | "placeCvr" | "hook" | "unitEconomics";

export type MkdocKeywordMetricRow = {
  keyword: string;
  pc_volume: number;
  m_volume: number;
  pc_ctr: number | null;
  m_ctr: number | null;
  comp_idx: string | null;
  est_bid_p3: number | null;
  cluster: string | null;
  intent: string | null;
  priority: number | null;
};

export type MkdocReportDocumentProps = {
  reportDate: string; // ISO string
  storeName: string;
  area?: string | null;
  category?: string | null;
  placeLink?: string | null;

  answers?: Record<string, unknown>;

  totalScore: number;
  axes: Record<AxisId, number>;
  mainType: { code: string; name: string; oneLiner?: string | null };
  subTags: Array<{ code?: string; label?: string }>;
  metrics: {
    contribution_margin: number;
    bep_monthly_teams: number;
    bep_daily_teams: number;
    current_daily_teams: number;
    gap_daily_teams: number;
    gap_ratio: number;
    max_cpa_est: number;
  };

  keywordRows: MkdocKeywordMetricRow[];
  uploadThumbs?: string[];

  recommendations: { primary: string[]; optional: string[] };
  consultLink?: string | null;
};

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function currencyLike(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function formatDateKR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function axisLabel(axis: AxisId): string {
  switch (axis) {
    case "demand":
      return "수요";
    case "cost":
      return "광고비";
    case "placeCvr":
      return "전환";
    case "hook":
      return "후킹";
    case "unitEconomics":
      return "손익";
  }
}

function formatBudgetBand(v: unknown): string {
  const key = String(v ?? "");
  switch (key) {
    case "0":
      return "0원";
    case "1_30":
      return "1~30만원";
    case "30_100":
      return "30~100만원";
    case "100_200":
      return "100~200만원";
    case "200_plus":
      return "200만원 이상";
    default:
      return "-";
  }
}

function formatOpenAge(v: unknown): string {
  const key = String(v ?? "");
  switch (key) {
    case "lt_90":
      return "90일 이내";
    case "m3_12":
      return "3~12개월";
    case "gt_12":
      return "1년 이상";
    default:
      return "-";
  }
}

function formatOperationMode(v: unknown): string {
  const key = String(v ?? "");
  switch (key) {
    case "hall":
      return "홀 위주";
    case "delivery":
      return "배달 위주";
    case "mixed":
      return "혼합";
    default:
      return "-";
  }
}

function formatReviewsRange(v: unknown): string {
  const key = String(v ?? "");
  switch (key) {
    case "0_30":
      return "0~30";
    case "31_100":
      return "31~100";
    case "100_plus":
      return "100+";
    case "0_10":
      return "0~10";
    case "11_30":
      return "11~30";
    case "30_plus":
      return "30+";
    default:
      return "-";
  }
}

function formatChannels(v: unknown): string {
  const arr = Array.isArray(v) ? v : [];
  const labels = arr.map((x) => {
    switch (String(x)) {
      case "naver_place":
        return "플레이스";
      case "naver_search":
        return "네이버검색";
      case "delivery_app":
        return "배달앱";
      case "instagram":
        return "인스타";
      case "threads":
        return "스레드";
      case "carrot":
        return "당근";
      case "offline_repeat":
        return "단골/입소문";
      default:
        return String(x);
    }
  });
  const deduped = Array.from(new Set(labels.filter(Boolean)));
  return deduped.length ? deduped.join(", ") : "-";
}

function scoreBand(value: number): "good" | "mid" | "bad" {
  const v = clamp100(value);
  if (v >= 70) return "good";
  if (v >= 45) return "mid";
  return "bad";
}

function docChipClass(band: "good" | "mid" | "bad"): string {
  if (band === "good") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (band === "mid") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function topAxes(axes: Record<AxisId, number>, n: number): Array<{ id: AxisId; value: number }> {
  const ids: AxisId[] = ["demand", "cost", "placeCvr", "hook", "unitEconomics"];
  return ids
    .map((id) => ({ id, value: Number(axes[id] ?? 0) }))
    .sort((a, b) => a.value - b.value)
    .slice(0, n);
}

function typeActionTop3(typeCode: string): string[] {
  switch (typeCode) {
    case "T04":
      return [
        "BEP(손익분기) 기준으로 ‘하루 목표팀/매출’을 먼저 고정합니다.",
        "원가율 높은 메뉴는 ‘세트/추가옵션’으로 구조를 바꿔 공헌이익을 올립니다.",
        "광고는 1개 채널만 최소로 테스트(불필요한 확장 금지)합니다.",
      ];
    case "T02":
      return [
        "플레이스 첫 화면(미리보기 5장)부터 ‘대표사진 5장 템플릿’으로 재구성합니다.",
        "상세설명 첫 문단을 ‘장점+숫자+대상’ 구조로 다시 씁니다.",
        "길찾기/전화/예약 등 행동 버튼을 늘려 ‘클릭→행동’ 전환을 잡습니다.",
      ];
    case "T06":
      return [
        "리뷰 요청 동선을 매장 운영 흐름 안에 넣어 ‘정상 고객 기반’으로 쌓습니다.",
        "리뷰 답글 루틴을 만들어 ‘신뢰+최신성’을 동시에 올립니다.",
        "사진 포함 리뷰 비율을 올려 선택 비용을 줄입니다.",
      ];
    case "T15":
      return [
        "핵심키워드 대신 ‘롱테일/상황키워드’로 분산해 입찰 압력을 낮춥니다.",
        "광고 전에 전환(플레이스 첫 화면/리뷰)을 먼저 올려 CPA를 낮춥니다.",
        "2주 단위로 소재/키워드를 A/B 테스트하고, 이긴 것만 예산을 올립니다.",
      ];
    case "T16":
      return [
        "검색 수요가 약하면 ‘충동 유발 장면(후킹)’을 먼저 설계합니다.",
        "지역 기반 유입(당근/플레이스)을 최소 비용으로 테스트합니다.",
        "체험단/UGC로 ‘외부 콘텐츠’ 자산을 확보해 노출을 만듭니다.",
      ];
    case "T03":
      return [
        "시그니처 장면(메뉴/세트/퍼포먼스/공간) 1개를 먼저 고정합니다.",
        "대표사진 ‘기준 컷’(빛/각도/거리/구성)을 정해서 반복 생산합니다.",
        "그 다음에야 광고/리뷰를 붙여 효율을 만듭니다.",
      ];
    case "T10":
      return [
        "오픈 90일은 ‘저장/리뷰/업데이트 빈도’가 승부입니다.",
        "사진/공지/이벤트를 촘촘히 업데이트해 최신성 점수를 올립니다.",
        "첫 달은 ‘콘텐츠→전환→리뷰’ 루프를 만든 뒤 광고를 증폭합니다.",
      ];
    default:
      return [
        "가장 낮은 점수 축(병목)부터 먼저 고치면 비용이 줄어듭니다.",
        "2주 단위로 하나씩(전환→신뢰→노출) 순서를 지켜 개선합니다.",
        "데이터를 기록(노출/클릭/전화/길찾기)해서 다음 액션이 쌓이게 합니다.",
      ];
  }
}

function type14DayPlan(typeCode: string): { d1_3: string[]; d4_7: string[]; d8_14: string[] } {
  switch (typeCode) {
    case "T02":
      return {
        d1_3: ["대표사진 5장 구성 교체", "상세설명 1문단 재작성", "찾아오는 길/주차/예약 버튼 점검"],
        d4_7: ["리뷰 상단 5개 품질 올리기(사진 포함)", "공지/이벤트 1개 발행", "경쟁사 썸네일 10개 캡처해서 비교"],
        d8_14: ["플레이스 광고/당근 광고 중 1개만 소액 테스트", "CTR/전화/길찾기 변화 기록", "이긴 소재 1개로 반복 제작"],
      };
    case "T04":
      return {
        d1_3: ["BEP 재계산(일 목표 팀수 고정)", "마진 좋은 메뉴/옵션 1개 설계", "광고 상한 CPA 계산"],
        d4_7: ["가격/세트 구성 테스트(2안)", "검색형 키워드 10개 선정", "최소 예산으로 1채널만 테스트"],
        d8_14: ["수익이 남는 조합만 남기고 나머지 중단", "리뷰/공지 루틴으로 신뢰 확보", "2주차 리포트로 다음 실행 결정"],
      };
    case "T06":
      return {
        d1_3: ["리뷰 요청 멘트/QR/혜택 세팅", "답글 템플릿 3개 만들기", "사진 리뷰 기준(메인메뉴 1장) 고정"],
        d4_7: ["영수증 리뷰/체험단 중 1개 실행 설계", "리뷰 상단 5개 퀄리티 점검", "플레이스 첫 화면 이미지 교정"],
        d8_14: ["리뷰 증가 속도와 전환(전화/길찾기) 상관 확인", "좋은 리뷰 주제 반복", "광고는 필요할 때만 최소로"],
      };
    default:
      return {
        d1_3: ["병목 축 1개를 확정", "첫 화면(사진/문구) 1차 교정", "기록 지표 3개 고정(노출/클릭/전환)"],
        d4_7: ["콘텐츠 2회 발행(공지/사진)", "리뷰/신뢰 장치 1개 세팅", "키워드 20개로 우선순위 정리"],
        d8_14: ["1채널 소액 테스트", "이긴 소재만 반복", "2주차 기준으로 다음 단계 결정"],
      };
  }
}

function chooseChannelStrategy(input: {
  axes: Record<AxisId, number>;
  budgetBand: unknown;
}): { headline: string; bullets: string[] } {
  const demandBand = scoreBand(input.axes.demand);
  const costBand = scoreBand(input.axes.cost);
  const placeBand = scoreBand(input.axes.placeCvr);

  const budget = formatBudgetBand(input.budgetBand);

  if (demandBand === "bad") {
    return {
      headline: `검색 수요가 약한 편입니다(예산: ${budget}).`,
      bullets: [
        "검색광고는 ‘방어’ 수준으로 최소 운영하고, 지역 기반 유입(당근/플레이스)을 먼저 만듭니다.",
        "후킹(장면) + UGC(체험단/리뷰)로 ‘수요를 만드는’ 쪽이 효율이 좋습니다.",
        "2주 단위로 ‘썸네일/카피’만 바꿔서 반응을 확인합니다.",
      ],
    };
  }

  if (costBand === "bad") {
    return {
      headline: `입찰/경쟁이 과열인 편입니다(예산: ${budget}).`,
      bullets: [
        "핵심키워드 대신 롱테일/상황키워드로 분산해 비용을 낮춥니다.",
        "광고 전에 플레이스 전환(첫 화면/리뷰)을 올려 CPA를 줄입니다.",
        "광고는 1채널만 운영하고, 나머지는 콘텐츠/리뷰로 지면을 채웁니다.",
      ],
    };
  }

  if (placeBand === "bad") {
    return {
      headline: `전환(클릭→전화/길찾기)이 병목입니다(예산: ${budget}).`,
      bullets: [
        "대표사진 5장 구성과 첫 문단만 고쳐도 전환이 가장 빨리 움직입니다.",
        "전환 구조가 잡히면 플레이스 광고로 ‘필요 팀수’만큼만 증폭합니다.",
        "리뷰/공지 업데이트로 ‘신뢰+최신성’을 유지합니다.",
      ],
    };
  }

  return {
    headline: `기본 구조가 나쁘지 않습니다(예산: ${budget}).`,
    bullets: [
      "채널 1개를 주력으로 잡고 2주 단위로 A/B 테스트(소재/키워드)합니다.",
      "리뷰/공지 루틴으로 신뢰/최신성을 유지하면서, 성과 좋은 소재만 반복합니다.",
      "월말에는 노출→클릭→전화/길찾기 전환율로 다음 달 예산을 재배치합니다.",
    ],
  };
}

function kpiCardItem(label: string, value: string, hint?: string) {
  return { label, value, hint };
}

function sectionTitle(title: string, subtitle?: string) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">{title}</p>
      {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: number }) {
  const band = scoreBand(value);
  return (
    <span className={["inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", docChipClass(band)].join(" ")}>
      <span>{label}</span>
      <span className="font-black">{Math.round(value)}</span>
    </span>
  );
}

function formatProductMeta(code: string): { title: string; subtitle: string } {
  const meta = getProductMeta(code);
  if (!meta) return { title: code, subtitle: "상세 정보 없음" };

  if (typeof meta.price === "number" && Number.isFinite(meta.price)) {
    return { title: meta.name, subtitle: `${meta.price.toLocaleString("ko-KR")}원` };
  }
  if (typeof meta.management_fee === "number" && Number.isFinite(meta.management_fee)) {
    const base = `월 관리비 ${meta.management_fee.toLocaleString("ko-KR")}원`;
    const note = meta.cpc_note ? ` (${meta.cpc_note})` : "";
    return { title: meta.name, subtitle: `${base}${note}` };
  }
  return { title: meta.name, subtitle: "가격: 문의" };
}

function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("ko-KR");
}

export default function MkdocReportDocument(props: MkdocReportDocumentProps) {
  const axisBottlenecks = useMemo(() => topAxes(props.axes, 2), [props.axes]);

  const keywordsTop20 = useMemo(() => {
    const rows = Array.isArray(props.keywordRows) ? props.keywordRows : [];
    return rows
      .slice()
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, 20);
  }, [props.keywordRows]);

  const clustersTop = useMemo(() => {
    const map = new Map<string, MkdocKeywordMetricRow[]>();
    for (const row of props.keywordRows ?? []) {
      const key = String(row.cluster ?? "기타");
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([cluster, rows]) => ({
        cluster,
        rows: rows.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 8),
      }))
      .sort((a, b) => b.rows.length - a.rows.length)
      .slice(0, 6);
  }, [props.keywordRows]);

  const actionTop3 = useMemo(() => typeActionTop3(props.mainType.code), [props.mainType.code]);
  const plan14 = useMemo(() => type14DayPlan(props.mainType.code), [props.mainType.code]);

  const channelStrategy = useMemo(
    () => chooseChannelStrategy({ axes: props.axes, budgetBand: props.answers?.budget_band }),
    [props.axes, props.answers],
  );

  const pages = useMemo(() => {
    const pages10 = [
      { id: "cover", title: "표지" },
      { id: "summary", title: "1분 요약" },
      { id: "dashboard", title: "점수 대시보드" },
      { id: "unit", title: "손익(BEP) & 최대 CPA" },
      { id: "keyword", title: "키워드 그물망(우선순위)" },
      { id: "place", title: "플레이스 처방전" },
      { id: "thumb", title: "썸네일/사진 처방" },
      { id: "review", title: "리뷰/UGC 운영" },
      { id: "strategy", title: "채널 전략" },
      { id: "plan", title: "14일 플랜 & 추천" },
    ] as const;
    return pages10;
  }, []);

  const pageCount = pages.length;

  const pageShellClass =
    "mkdoc-print-page rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)] md:p-10";

  const headerLine = (pageNo: number) => (
    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
      <span>MKDoc 마케닥</span>
      <span>
        Page {pageNo} / {pageCount}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page 1: Cover */}
      <section className={pageShellClass}>
        {headerLine(1)}
        <div className="mt-6 grid gap-6 md:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 md:text-4xl">요식업 마케팅 정밀 진단 리포트</h2>
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900">{props.storeName}</p>
              <p className="text-sm text-slate-600">
                {props.area ? props.area : ""}
                {props.category ? ` · ${props.category}` : ""}
              </p>
              <p className="text-xs font-semibold text-slate-500">발행일: {formatDateKR(props.reportDate)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold text-slate-600">핵심 흐름</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">근거(수치) → 병목 → 30일 처방전</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                입력된 설문 + (가능 시) 네이버 SearchAd 키워드 데이터 기반으로 “무엇부터 고치면 비용이 줄어드는지”를
                결정합니다.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">TOTAL SCORE</p>
              <p className="mt-3 text-6xl font-black">{Math.round(props.totalScore)}</p>
              <p className="mt-1 text-xs font-semibold text-cyan-50/70">/ 100</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <MetricChip label="수요" value={props.axes.demand} />
                <MetricChip label="광고비" value={props.axes.cost} />
                <MetricChip label="전환" value={props.axes.placeCvr} />
                <MetricChip label="후킹" value={props.axes.hook} />
                <MetricChip label="손익" value={props.axes.unitEconomics} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-600">메인 병목 타입</p>
              <p className="mt-2 text-lg font-black text-emerald-700">{props.mainType.name}</p>
              <p className="mt-1 text-sm text-slate-700">{props.mainType.oneLiner ?? ""}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(props.subTags ?? []).slice(0, 6).map((t) => (
                  <span
                    key={t.code ?? t.label}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    #{t.label ?? t.code}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Page 2: Exec Summary */}
      <section className={pageShellClass}>
        {headerLine(2)}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            {sectionTitle("EXECUTIVE SUMMARY", "결론부터: 이번 달 우선순위 TOP3")}
            <ol className="mt-3 space-y-2 text-sm text-slate-800">
              {actionTop3.map((t, idx) => (
                <li key={t} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <span className="mr-2 text-xs font-black text-slate-500">{idx + 1}</span>
                  <span className="font-semibold text-slate-900">{t}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-4">
            {sectionTitle("BOTTLENECKS", "점수 기반 병목 TOP2(낮을수록 우선 개선)")}
            <div className="grid gap-2">
              {axisBottlenecks.map((b) => (
                <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{axisLabel(b.id)}</p>
                    <p className="text-sm font-black text-slate-900">{Math.round(b.value)}/100</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {b.id === "unitEconomics"
                      ? "손익이 불안정하면 마케팅이 버티기 게임이 됩니다."
                      : b.id === "placeCvr"
                        ? "첫 화면(대표사진/문구) 전환이 낮으면 광고 효율이 바로 깨집니다."
                        : b.id === "demand"
                          ? "수요가 약하면 검색광고보다 ‘충동/콘텐츠’가 먼저입니다."
                          : b.id === "cost"
                            ? "입찰이 높으면 롱테일/전환 개선으로 비용을 낮춰야 합니다."
                            : "후킹이 약하면 ‘가고 싶은 장면’부터 만들어야 합니다."}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <p className="text-sm font-semibold">데이터/추정 라벨</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                키워드/입찰가는 SearchAd 데이터 기반(가능 시), 나머지는 설문 입력 기반의 추정치입니다. 입력값이
                정확할수록 리포트 정확도도 올라갑니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Page 3: Dashboard */}
      <section className={pageShellClass}>
        {headerLine(3)}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-4">
            {sectionTitle("DASHBOARD", "5축 점수와 ‘왜 그런지’ 한 줄 근거")}
            <div className="space-y-3">
              {(["demand", "cost", "placeCvr", "hook", "unitEconomics"] as AxisId[]).map((axis) => (
                <div key={axis} className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{axisLabel(axis)}</p>
                    <p className="text-sm font-black text-slate-900">{Math.round(props.axes[axis] ?? 0)}/100</p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#06b6d4_0%,#10b981_100%)]"
                      style={{ width: `${clamp100(props.axes[axis] ?? 0)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {axis === "demand"
                      ? "키워드 검색량(상위 키워드) 기준으로 수요를 점수화합니다."
                      : axis === "cost"
                        ? "3위 입찰 추정치가 높을수록 비용 부담이 커집니다."
                        : axis === "placeCvr"
                          ? "대표사진/첫 화면 전환 체감(1~5점) 기반으로 점수화합니다."
                          : axis === "hook"
                            ? "‘한 장면만 봐도 가고 싶은가’로 후킹 강도를 봅니다."
                            : "BEP 갭이 클수록 손익 리스크가 커집니다."}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {sectionTitle("INPUT SNAPSHOT", "설문 입력값 요약(리포트 근거)")}
            <div className="grid gap-3">
              {[
                kpiCardItem("운영형태", formatOperationMode(props.answers?.operation_mode)),
                kpiCardItem("오픈 시점", formatOpenAge(props.answers?.open_age)),
                kpiCardItem("예산(30일)", formatBudgetBand(props.answers?.budget_band)),
                kpiCardItem("유입 채널", formatChannels(props.answers?.channels)),
                kpiCardItem("방문자리뷰", formatReviewsRange(props.answers?.reviews_visit_range)),
                kpiCardItem("블로그리뷰", formatReviewsRange(props.answers?.reviews_blog_range)),
                kpiCardItem("후킹 장면", safeText(props.answers?.has_impulse_scene) === "yes" ? "있다" : "없다/모름"),
              ].map((k) => (
                <div key={k.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600">{k.label}</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{k.value}</p>
                  {k.hint ? <p className="mt-1 text-xs text-slate-600">{k.hint}</p> : null}
                </div>
              ))}
            </div>

            {props.placeLink ? (
              <a
                href={props.placeLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                플레이스 링크 열기
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Page 4: Unit economics */}
      <section className={pageShellClass}>
        {headerLine(4)}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            {sectionTitle("UNIT ECONOMICS", "BEP(손익분기) 기준으로 ‘광고가 감당 가능한지’ 먼저 확인합니다.")}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-900">
              <p className="text-sm font-semibold">손익 스냅샷</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
                <li>팀당 공헌이익: {currencyLike(props.metrics.contribution_margin)}</li>
                <li>월 BEP 팀수: {Math.round(props.metrics.bep_monthly_teams).toLocaleString("ko-KR")}팀</li>
                <li>일 BEP 팀수: {Math.round(props.metrics.bep_daily_teams)}팀</li>
                <li>현재 일 평균: {Math.round(props.metrics.current_daily_teams)}팀</li>
                <li>갭(추가 필요): {Math.round(props.metrics.gap_daily_teams)}팀/일</li>
                <li>최대 CPA(상한 추정): {currencyLike(props.metrics.max_cpa_est)}</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
              <p className="text-sm font-semibold">해석</p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                광고/프로모션을 하더라도 <span className="font-black">팀당 공헌이익</span>보다 CPA가 높아지면
                손익이 무너집니다. 따라서 “전환(첫 화면/리뷰) 개선”과 “롱테일 키워드”로 CPA를 낮추는 쪽이
                우선입니다.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {sectionTitle("REVENUE EQUATION", "유입 × 전환 × 재방문 × 객단가")}
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Formula</p>
              <p className="mt-2 text-2xl font-black text-slate-900">유입 × 전환 × 재방문 × 객단가</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                지금은 “{axisLabel(axisBottlenecks[0]?.id ?? "placeCvr" as AxisId)}” 축이 가장 약한 편입니다.
                이 항을 먼저 올리면, 같은 노출/같은 광고비에서도 성과가 빨리 움직입니다.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">이번 달 체크 지표(권장 3개)</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
                <li>노출/조회(플레이스 인사이트 또는 광고 노출)</li>
                <li>클릭(상세보기, 전화/길찾기/예약 등)</li>
                <li>방문/팀수(일 단위로 1줄 기록)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Page 5: Keyword net */}
      <section className={pageShellClass}>
        {headerLine(5)}
        <div className="mt-6 space-y-5">
          {sectionTitle("KEYWORD MESH", "우선 키워드 20개(수요/CTR/입찰)")}

          {keywordsTop20.length ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-3 font-semibold">키워드</th>
                      <th className="px-3 py-3 font-semibold">수요</th>
                      <th className="px-3 py-3 font-semibold">CTR</th>
                      <th className="px-3 py-3 font-semibold">3위 입찰</th>
                      <th className="px-3 py-3 font-semibold">클러스터</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywordsTop20.map((r) => (
                      <tr key={r.keyword} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-900">{r.keyword}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {compactNumber((r.pc_volume ?? 0) + (r.m_volume ?? 0))}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {r.pc_ctr == null && r.m_ctr == null
                            ? "-"
                            : `${(((r.pc_ctr ?? 0) + (r.m_ctr ?? 0)) / 2).toFixed(2)}%`}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{currencyLike(r.est_bid_p3)}</td>
                        <td className="px-3 py-2 text-slate-600">{r.cluster ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              키워드 데이터가 없습니다. (SearchAd 키 설정 또는 API 실패)
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            {clustersTop.map((c) => (
              <div key={c.cluster} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-900">{c.cluster}</p>
                <ul className="mt-3 space-y-2 text-xs text-slate-700">
                  {c.rows.slice(0, 5).map((r) => (
                    <li key={r.keyword} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <span className="font-semibold text-slate-900">{r.keyword}</span>
                      <span className="text-slate-600">{compactNumber((r.pc_volume ?? 0) + (r.m_volume ?? 0))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <p className="text-sm font-semibold">해석 가이드</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900/90">
              <li>수요가 충분하고 입찰이 합리적이면 “검색형 유입(광고)”이 잘 먹힙니다.</li>
              <li>입찰이 과열이면 “롱테일 + 전환 개선(플레이스/리뷰)”로 먼저 비용을 낮추는 게 안전합니다.</li>
              <li>수요가 낮으면 “충동/콘텐츠(후킹)”로 수요를 만들고 지역 유입을 테스트합니다.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Page 6: Place RX */}
      <section className={pageShellClass}>
        {headerLine(6)}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            {sectionTitle("PLACE PRESCRIPTION", "정확도·신뢰도·최신성·인기도 체크리스트")}

            <div className="space-y-3">
              {[
                {
                  title: "정확도(정보/업종/메뉴/가격)",
                  items: [
                    "업종/카테고리 일치",
                    "메뉴/가격 최신화(누락 금지)",
                    "대표키워드 3~5개 정리",
                    "찾아오는 길(랜드마크/주차/골목 진입) 구체화",
                  ],
                },
                {
                  title: "신뢰도(리뷰/응답/일관성)",
                  items: ["리뷰 답글 루틴(주 2회)", "사진 리뷰 비율 늘리기", "악성 리뷰 대응 템플릿(감정 금지)"],
                },
                {
                  title: "최신성(공지/사진/메뉴 업데이트)",
                  items: ["새소식/공지 월 2회", "대표사진/메뉴 사진 월 1회 점검", "시즌/이벤트 반영"],
                },
                {
                  title: "인기도(저장/외부유입/행동)",
                  items: ["SNS/블로그 링크 연결", "저장 유도 CTA(쿠폰/이벤트)", "길찾기/전화/예약 버튼 노출 최적화"],
                },
              ].map((box) => (
                <div key={box.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-bold text-slate-900">{box.title}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {box.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {sectionTitle("72H QUICK FIX", "72시간 내 전환을 움직이는 ‘빠른 처방’")}
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-800">
                <li>대표사진 5장 구성: “메뉴 3 + 내부 1 + 외부/간판 1”로 고정</li>
                <li>상세설명 첫 문단: “장점 + 숫자 + 대상”으로 3줄 요약</li>
                <li>전화/길찾기/예약 버튼과 운영시간/브레이크타임/주차를 명확히</li>
              </ol>
            </div>

              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
                <p className="text-sm font-semibold">문장 템플릿(첫 문단)</p>
                <p className="mt-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
                  “{props.storeName}은(는) <span className="font-semibold">(대상)</span>을 위해{" "}
                  <span className="font-semibold">(장점)</span>을{" "}
                  <span className="font-semibold">(숫자 근거)</span>로 제공합니다. 지금{" "}
                  <span className="font-semibold">(대표메뉴/혜택)</span>을 확인하세요.”
                </p>
              </div>
          </div>
        </div>
      </section>

      {/* Page 7: Thumbnail/Photo */}
      <section className={pageShellClass}>
        {headerLine(7)}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            {sectionTitle("THUMBNAIL & PHOTO", "대표사진 5장 구성 템플릿(전환용)")}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-800">
                <li>메인 1장: “시그니처 메뉴” 클로즈업(가장 먹고 싶게)</li>
                <li>메뉴 2장: 세트/상차림/구성(가격/양 체감)</li>
                <li>내부 1장: 좌석/분위기(‘가도 되겠다’ 안정감)</li>
                <li>외부/간판 1장: 찾기 쉬움(골목/주차/입구 포함)</li>
              </ol>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-slate-900">카피 템플릿(썸네일 상단)</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
                <li>“{safeText(props.answers?.area) || "OO"}에서 <b>OO</b> 찾는다면 여기”</li>
                <li>“{safeText(props.storeName)} 대표 메뉴 <b>OO</b> (숫자 근거 1개)”</li>
                <li>“지금 예약/방문 시 <b>OO</b> 혜택(있다면)”</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            {sectionTitle("UPLOADED IMAGES", "업로드 이미지(리포트 근거)")}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(props.uploadThumbs ?? []).length ? (
                (props.uploadThumbs ?? []).slice(0, 9).map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt="upload"
                    className="aspect-square w-full rounded-2xl border border-slate-200 object-cover"
                  />
                ))
              ) : (
                <div className="col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                  업로드 이미지가 없습니다.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
              <p className="text-sm font-semibold">사진 체크(초간단)</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900/90">
                <li>메뉴 사진은 “빛(자연광) + 근접 + 한 장면”이 이깁니다.</li>
                <li>내부/외부는 “처음 가는 사람이 불안해하는 정보(입구/주차/좌석)”가 핵심입니다.</li>
                <li>같은 톤으로 5장을 맞추면 ‘가게가 정돈돼 보이는’ 효과가 큽니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Page 8: Review / UGC */}
      <section className={pageShellClass}>
        {headerLine(8)}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            {sectionTitle("REVIEW & UGC", "리뷰(사회적 증거) 루프를 만들면 같은 노출에서도 전환이 빨라집니다.")}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-bold text-slate-900">리뷰 요청 동선</p>
              <p className="mt-2 text-sm text-slate-700">
                현재:{" "}
                <span className="font-black text-slate-900">
                  {safeText(props.answers?.review_request_loop) === "yes" ? "있음" : safeText(props.answers?.review_request_loop) === "no" ? "없음" : "-"}
                </span>
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
                <li>계산/퇴장 동선에 “QR + 한 문장 요청 멘트”를 고정합니다.</li>
                <li>포토리뷰 기준(메인 메뉴 1장 필수)을 안내하면 품질이 올라갑니다.</li>
                <li>무리한 보상보다 “정상 운영”으로 지속 가능한 구조를 권장합니다.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-bold text-slate-900">복붙 템플릿(리뷰 요청)</p>
              <p className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                “오늘 방문 어떠셨나요? 사진 1장만 올려주셔도 큰 도움이 됩니다. 다음 손님들이 선택할 때 정말 참고가 돼요 🙏”
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {sectionTitle("RISK & REPLY", "부정 리뷰 리스크를 줄이고, 답글로 신뢰/최신성을 같이 올립니다.")}

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
              <p className="text-sm font-semibold">부정 리뷰 이슈(최근 30일)</p>
              {Array.isArray(props.answers?.negative_review_issues) && (props.answers?.negative_review_issues as any[]).length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(props.answers?.negative_review_issues as any[]).slice(0, 8).map((x) => (
                    <span key={String(x)} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                      #{String(x)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-amber-900/90">-</p>
              )}
              <p className="mt-3 text-xs leading-5 text-amber-900/90">
                이슈가 있다면 “사과 → 사실확인 → 재발방지 → 재방문 제안” 순서로 대응하면 감정 싸움을 줄일 수 있습니다.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-bold text-slate-900">복붙 템플릿(부정 리뷰 답글)</p>
              <p className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                “소중한 후기 감사합니다. 불편을 드려 정말 죄송합니다. 말씀 주신 부분은 바로 확인해 개선하겠습니다. 다음 방문 때는 더 나은 경험을 드릴 수 있도록 준비하겠습니다.”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Page 9: Channel strategy */}
      <section className={pageShellClass}>
        {headerLine(9)}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            {sectionTitle("CHANNEL STRATEGY", channelStrategy.headline)}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-800">
                {channelStrategy.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            {sectionTitle("CHANNEL SNAPSHOT", "현재 운영/측정 상태(설문 기반)")}
            <div className="grid gap-3">
              {[
                kpiCardItem("예산(30일)", formatBudgetBand(props.answers?.budget_band)),
                kpiCardItem("유입 채널", formatChannels(props.answers?.channels)),
                kpiCardItem(
                  "광고 경험",
                  safeText(props.answers?.has_ad_experience) === "yes" ? "있음" : safeText(props.answers?.has_ad_experience) === "no" ? "없음" : "-",
                ),
                kpiCardItem(
                  "측정 방식",
                  Array.isArray(props.answers?.measurement_methods)
                    ? (props.answers?.measurement_methods as any[]).map((x) => String(x)).filter(Boolean).slice(0, 4).join(", ") || "-"
                    : "-",
                ),
                kpiCardItem("늘리고 싶은 KPI", safeText(props.answers?.kpi_to_increase) || "-"),
              ].map((k) => (
                <div key={k.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600">{k.label}</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{k.value}</p>
                  {k.hint ? <p className="mt-1 text-xs text-slate-600">{k.hint}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Page 10: Plan + recommendations */}
      <section className={pageShellClass}>
        {headerLine(10)}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            {sectionTitle("14-DAY PLAN", "Day 1~14 실행 체크리스트")}
            <div className="space-y-3">
              {[
                { title: "Day 1~3", items: plan14.d1_3 },
                { title: "Day 4~7", items: plan14.d4_7 },
                { title: "Day 8~14", items: plan14.d8_14 },
              ].map((p) => (
                <div key={p.title} className="rounded-3xl border border-slate-200 bg-white p-6">
                  <p className="text-sm font-bold text-slate-900">{p.title}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {p.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {sectionTitle("RECOMMENDATIONS", "지금 당장 1~2개만 강하게")}
            <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/90">Primary</p>
              <p className="mt-2 text-lg font-black">우선 추천</p>
              <ul className="mt-3 space-y-2 text-sm">
                {(props.recommendations.primary ?? []).map((code) => {
                  const meta = formatProductMeta(code);
                  return (
                    <li key={code} className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">
                      <p className="text-sm font-black">{meta.title}</p>
                      <p className="mt-1 text-[11px] font-semibold text-cyan-50/75">{meta.subtitle}</p>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">추가 옵션(선택)</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(props.recommendations.optional ?? []).map((code) => {
                  const meta = formatProductMeta(code);
                  return (
                    <div key={code} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">{meta.subtitle}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
              <p className="text-sm font-semibold">30분 무료상담</p>
              <p className="mt-1 text-sm text-emerald-900/90">
                리포트를 기반으로 1순위 액션을 같이 결정합니다.
              </p>
              <a
                href={props.consultLink ?? "https://example.com/placeholder"}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800"
              >
                상담 예약하기
              </a>
              <p className="mt-2 text-[11px] text-emerald-900/70">
                (링크는 placeholder입니다. 운영 캘린더 링크로 교체하세요.)
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
