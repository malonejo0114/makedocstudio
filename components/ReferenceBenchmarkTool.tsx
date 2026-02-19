"use client";

import { useMemo, useState } from "react";

type StrategyCell = {
  benchmark_feature: string;
  why: string;
  action_plan: string;
};

type BenchmarkAnalysis = {
  smart_fact_finding: {
    headline: string;
    sub_text: string;
    cta: string;
    numbers_or_claims: string[];
  };
  decoding: {
    psychological_triggers: string[];
    layout_intent: string;
  };
  strategy_table: {
    visual_guide: StrategyCell;
    main_headline: StrategyCell;
    sub_text: StrategyCell;
    cta_button: StrategyCell;
  };
  nano_input: {
    image_specs: {
      ratio: string;
      pixels: string;
    };
    visual_guide_en: string;
    main_headline: string;
    sub_text: string;
    cta_button: string;
  };
};

export type BenchmarkDraft = {
  id: string;
  file: File;
  previewUrl: string;
  selected: boolean;
  visualGuide: string;
  headline: string;
  subText: string;
  cta: string;
  extraRequest: string;
};

type WorkItem = {
  id: string;
  file: File;
  previewUrl: string;
  selectedForGenerate: boolean;
  analyzing: boolean;
  error: string | null;
  analysis: BenchmarkAnalysis | null;
  editableVisualGuide: string;
  editableHeadline: string;
  editableSubText: string;
  editableCta: string;
};

type ReferenceBenchmarkToolProps = {
  width: number;
  height: number;
  onProceedToGenerate: (drafts: BenchmarkDraft[]) => void;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function toRatio(width: number, height: number): string {
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function makeId(file: File, index: number): string {
  return `${Date.now()}-${index}-${file.name}-${file.size}`;
}

export default function ReferenceBenchmarkTool({
  width,
  height,
  onProceedToGenerate,
}: ReferenceBenchmarkToolProps) {
  const [productName, setProductName] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [usp, setUsp] = useState("");
  const [problem, setProblem] = useState("");
  const [extraRequest, setExtraRequest] = useState("");

  const [items, setItems] = useState<WorkItem[]>([]);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => items.filter((item) => item.selectedForGenerate).length,
    [items],
  );

  const updateItem = (id: string, patch: Partial<WorkItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const onAddFiles = (list: FileList | null) => {
    if (!list || list.length === 0) {
      return;
    }
    const nextItems = Array.from(list).map((file, index) => ({
      id: makeId(file, index),
      file,
      previewUrl: URL.createObjectURL(file),
      selectedForGenerate: true,
      analyzing: false,
      error: null,
      analysis: null,
      editableVisualGuide: "",
      editableHeadline: "",
      editableSubText: "",
      editableCta: "",
    }));
    setItems((prev) => [...nextItems, ...prev]);
  };

  const onRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const analyzeOne = async (item: WorkItem) => {
    updateItem(item.id, { analyzing: true, error: null });
    try {
      const formData = new FormData();
      formData.append("referenceImage", item.file);
      formData.append("productName", productName);
      formData.append("targetCustomer", targetCustomer);
      formData.append("usp", usp);
      formData.append("problem", problem);
      formData.append("imageRatio", toRatio(width, height));
      formData.append("width", String(width));
      formData.append("height", String(height));

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "분석 실패");
      }

      const analysis = payload?.analysis as BenchmarkAnalysis;
      updateItem(item.id, {
        analyzing: false,
        analysis,
        editableVisualGuide: analysis?.nano_input?.visual_guide_en || "",
        editableHeadline: analysis?.nano_input?.main_headline || "",
        editableSubText: analysis?.nano_input?.sub_text || "",
        editableCta: analysis?.nano_input?.cta_button || "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "분석 실패";
      updateItem(item.id, { analyzing: false, error: message });
    }
  };

  const onAnalyzeSelected = async () => {
    setGlobalMessage(null);
    const targets = items.filter((item) => item.selectedForGenerate);
    if (targets.length === 0) {
      setGlobalMessage("분석할 레퍼런스를 먼저 체크해 주세요.");
      return;
    }
    for (const item of targets) {
      // 안정성 우선으로 분석은 직렬 처리
      // eslint-disable-next-line no-await-in-loop
      await analyzeOne(item);
    }
    setGlobalMessage(`선택 ${targets.length}개 분석 완료`);
  };

  const onProceed = () => {
    const drafts: BenchmarkDraft[] = items
      .filter((item) => item.selectedForGenerate && item.analysis !== null)
      .map((item) => ({
        id: item.id,
        file: item.file,
        previewUrl: item.previewUrl,
        selected: item.selectedForGenerate,
        visualGuide: item.editableVisualGuide,
        headline: item.editableHeadline,
        subText: item.editableSubText,
        cta: item.editableCta,
        extraRequest,
      }));

    if (drafts.length === 0) {
      setGlobalMessage("넘어갈 항목이 없습니다. 분석 완료된 레퍼런스를 체크해 주세요.");
      return;
    }

    onProceedToGenerate(drafts);
    setGlobalMessage(`생성 탭으로 이동: ${drafts.length}개 전달됨`);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">레퍼런스 분석 탭</p>
          <p className="text-xs text-slate-600">
            다중 레퍼런스 분석 후 항목별 수정하고 생성 탭으로 넘깁니다.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          체크 {selectedCount}개
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">상품명</span>
          <input
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">타겟 고객</span>
          <input
            value={targetCustomer}
            onChange={(event) => setTargetCustomer(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">핵심 소구점 (USP)</span>
          <input
            value={usp}
            onChange={(event) => setUsp(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">해결 문제</span>
          <input
            value={problem}
            onChange={(event) => setProblem(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-slate-700">
          레퍼런스 다중 업로드 (여러 장 선택 가능)
        </span>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(event) => onAddFiles(event.target.files)}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-slate-700">
          이미지 생성 시 추가 요청(선택)
        </span>
        <textarea
          rows={3}
          value={extraRequest}
          onChange={(event) => setExtraRequest(event.target.value)}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="원하는 연출/톤/강조 포인트가 있으면 입력"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setItems((prev) =>
              prev.map((item) => ({ ...item, selectedForGenerate: true })),
            );
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={() => {
            setItems((prev) =>
              prev.map((item) => ({ ...item, selectedForGenerate: false })),
            );
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          전체 해제
        </button>
        <button
          type="button"
          onClick={() => void onAnalyzeSelected()}
          className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800"
        >
          선택 항목 분석 실행
        </button>
        <button
          type="button"
          onClick={onProceed}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          이미지 생성하기(다음 탭)
        </button>
      </div>

      {globalMessage && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
          {globalMessage}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          레퍼런스 이미지를 업로드하면 분석 카드가 생성됩니다.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.selectedForGenerate}
                    onChange={(event) =>
                      updateItem(item.id, { selectedForGenerate: event.target.checked })
                    }
                  />
                  <p className="text-sm font-semibold text-slate-800">{item.file.name}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {item.analysis ? "분석 완료" : item.analyzing ? "분석 중" : "대기"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void analyzeOne(item)}
                    disabled={item.analyzing}
                    className="rounded-md border border-cyan-300 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-60"
                  >
                    {item.analyzing ? "분석 중..." : "개별 분석"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="rounded-md border border-rose-300 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[180px,1fr]">
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="h-44 w-full rounded-lg border border-slate-200 bg-white object-cover"
                />

                <div className="space-y-3">
                  {item.analysis ? (
                    <>
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="min-w-full text-left text-xs text-slate-700">
                          <thead className="bg-slate-100 text-[11px] font-semibold text-slate-700">
                            <tr>
                              <th className="px-2 py-2">요소</th>
                              <th className="px-2 py-2">벤치마킹 특징</th>
                              <th className="px-2 py-2">성공 원리</th>
                              <th className="px-2 py-2">내 상품 적용</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              [
                                {
                                  label: "Visual Guide",
                                  cell: item.analysis.strategy_table.visual_guide,
                                },
                                {
                                  label: "Main Headline",
                                  cell: item.analysis.strategy_table.main_headline,
                                },
                                {
                                  label: "Sub Text",
                                  cell: item.analysis.strategy_table.sub_text,
                                },
                                {
                                  label: "CTA Button",
                                  cell: item.analysis.strategy_table.cta_button,
                                },
                              ] as Array<{ label: string; cell: StrategyCell }>
                            ).map((row) => (
                              <tr key={row.label} className="border-t border-slate-100 align-top">
                                <td className="px-2 py-2 font-semibold text-slate-800">
                                  {row.label}
                                </td>
                                <td className="px-2 py-2">{row.cell.benchmark_feature}</td>
                                <td className="px-2 py-2">{row.cell.why}</td>
                                <td className="px-2 py-2">{row.cell.action_plan}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="space-y-1 md:col-span-2">
                          <span className="block text-[11px] font-semibold text-slate-700">
                            (1) VISUAL GUIDE (수정 가능)
                          </span>
                          <textarea
                            rows={3}
                            value={item.editableVisualGuide}
                            onChange={(event) =>
                              updateItem(item.id, { editableVisualGuide: event.target.value })
                            }
                            className="block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-[11px] font-semibold text-slate-700">
                            (2) MAIN HEADLINE
                          </span>
                          <input
                            value={item.editableHeadline}
                            onChange={(event) =>
                              updateItem(item.id, { editableHeadline: event.target.value })
                            }
                            className="block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-[11px] font-semibold text-slate-700">
                            (3) SUB TEXT
                          </span>
                          <input
                            value={item.editableSubText}
                            onChange={(event) =>
                              updateItem(item.id, { editableSubText: event.target.value })
                            }
                            className="block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </label>
                        <label className="space-y-1 md:col-span-2">
                          <span className="block text-[11px] font-semibold text-slate-700">
                            (4) CTA BUTTON
                          </span>
                          <input
                            value={item.editableCta}
                            onChange={(event) =>
                              updateItem(item.id, { editableCta: event.target.value })
                            }
                            className="block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
                      아직 분석 결과가 없습니다.
                    </div>
                  )}

                  {item.error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700">
                      {item.error}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
