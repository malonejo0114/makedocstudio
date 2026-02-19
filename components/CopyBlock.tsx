"use client";

import { useState } from "react";

export default function CopyBlock({
  title,
  text,
  language = "text",
  defaultOpen = false,
}: {
  title: string;
  text: string;
  language?: string;
  defaultOpen?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1100);
    } catch {
      setCopied(false);
    }
  };

  return (
    <details
      className="rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            펼쳐서 복사할 수 있습니다. (긴 텍스트는 스크롤)
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            void copy();
          }}
          className="shrink-0 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </summary>
      <div className="border-t border-slate-200 px-5 py-4">
        <pre className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          <code className={`language-${language}`}>{text}</code>
        </pre>
      </div>
    </details>
  );
}

