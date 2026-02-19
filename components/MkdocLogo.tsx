type MkdocLogoProps = {
  tone?: "dark" | "light";
  compact?: boolean;
  className?: string;
};

export default function MkdocLogo({
  tone = "dark",
  compact = false,
  className = "",
}: MkdocLogoProps) {
  const titleColor = tone === "light" ? "text-white" : "text-slate-900";
  const subColor = tone === "light" ? "text-cyan-100" : "text-cyan-700";
  const iconSize = compact ? "h-10 w-10" : "h-12 w-12";
  const titleSize = compact ? "text-lg" : "text-xl";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <img src="/mkdoc-mark.svg" alt="MKDoc logo" className={`${iconSize} rounded-xl`} />
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${subColor}`}>
          MKDoc
        </p>
        <p className={`-mt-0.5 font-bold leading-tight ${titleSize} ${titleColor}`}>마케닥</p>
      </div>
    </div>
  );
}
