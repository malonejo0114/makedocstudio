export default function MarketingGrowthBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Subtle moving grid with a radial mask */}
      <div className="mkdoc-bg-grid absolute inset-0 opacity-35" />

      {/* Floating geometric accents */}
      <div className="mkdoc-bg-float mkdoc-bg-float-a absolute -left-10 top-24 h-48 w-48 rounded-[40px] bg-cyan-300/12 blur-2xl" />
      <div className="mkdoc-bg-float mkdoc-bg-float-b absolute right-[-5rem] top-10 h-64 w-64 rounded-full bg-sky-300/10 blur-3xl" />
      <div className="mkdoc-bg-float mkdoc-bg-float-c absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-[60px] bg-emerald-300/10 blur-3xl" />
      <div className="mkdoc-bg-float mkdoc-bg-float-d absolute bottom-20 right-10 h-36 w-36 rotate-12 rounded-3xl bg-white/6 blur-xl" />

      {/* Growth chart line + bars (animated but lightweight) */}
      <svg
        className="mkdoc-bg-chart absolute left-0 top-0 h-full w-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="mkdocChartStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgb(34 211 238)" stopOpacity="0.0" />
            <stop offset="0.25" stopColor="rgb(34 211 238)" stopOpacity="0.35" />
            <stop offset="0.6" stopColor="rgb(14 165 233)" stopOpacity="0.55" />
            <stop offset="1" stopColor="rgb(16 185 129)" stopOpacity="0.35" />
          </linearGradient>
          <radialGradient id="mkdocNodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="white" stopOpacity="0.55" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Bars */}
        <g opacity="0.28">
          {[
            { x: 120, h: 120, d: "0.0s" },
            { x: 190, h: 170, d: "0.25s" },
            { x: 260, h: 140, d: "0.5s" },
            { x: 330, h: 220, d: "0.15s" },
            { x: 400, h: 190, d: "0.35s" },
            { x: 470, h: 260, d: "0.6s" },
            { x: 540, h: 210, d: "0.3s" },
            { x: 610, h: 300, d: "0.5s" },
            { x: 680, h: 260, d: "0.2s" },
            { x: 750, h: 340, d: "0.55s" },
            { x: 820, h: 310, d: "0.25s" },
            { x: 890, h: 380, d: "0.45s" },
          ].map((bar) => (
            <rect
              key={bar.x}
              x={bar.x}
              y={700 - bar.h}
              width="28"
              height={bar.h}
              rx="10"
              fill="rgb(148 163 184)"
              className="mkdoc-bg-bar"
              style={{ animationDelay: bar.d }}
            />
          ))}
        </g>

        {/* Main line */}
        <path
          d="M90 650 C 220 520, 280 610, 360 540 C 460 450, 540 600, 640 470 C 740 340, 820 430, 940 300 C 1010 220, 1090 270, 1140 170"
          fill="none"
          stroke="url(#mkdocChartStroke)"
          strokeWidth="3.5"
          className="mkdoc-bg-line"
        />

        {/* Nodes */}
        <g className="mkdoc-bg-nodes">
          {[
            { cx: 90, cy: 650, d: "0.0s" },
            { cx: 360, cy: 540, d: "0.4s" },
            { cx: 640, cy: 470, d: "0.8s" },
            { cx: 940, cy: 300, d: "1.2s" },
            { cx: 1140, cy: 170, d: "1.6s" },
          ].map((node) => (
            <g key={`${node.cx}-${node.cy}`} style={{ animationDelay: node.d }}>
              <circle
                cx={node.cx}
                cy={node.cy}
                r="18"
                fill="url(#mkdocNodeGlow)"
                className="mkdoc-bg-pulse"
              />
              <circle
                cx={node.cx}
                cy={node.cy}
                r="4.5"
                fill="white"
                opacity="0.65"
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

