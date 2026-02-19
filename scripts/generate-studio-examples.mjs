import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "public", "studio-examples");
const WIDTH = 1080;
const HEIGHT = 1350;

const EXAMPLES = [
  {
    file: "lumifizz-premium.png",
    brand: "LUMIFIZZ",
    kicker: "제로 슈가 스파클링",
    headline1: "밤에도 빛나는",
    headline2: "프리미엄 청량감",
    subhead: "탄산은 선명하게, 당은 가볍게",
    cta: "오늘만 30% 할인",
    template: "beverage",
  },
  {
    file: "solcareskin-serum.png",
    brand: "SOLCARE SKIN",
    kicker: "비타 글로우 세럼",
    headline1: "칙칙함은 덜고,",
    headline2: "광채는 깊게.",
    subhead: "7일 집중 케어 루틴",
    cta: "첫 구매 1+1",
    template: "beauty",
  },
  {
    file: "urbanbrew-coldbrew.png",
    brand: "URBAN BREW",
    kicker: "시그니처 콜드브루",
    headline1: "도시의 아침을",
    headline2: "한 잔으로 깨우다",
    subhead: "깊은 향, 깔끔한 피니시",
    cta: "매장 픽업 20% OFF",
    template: "coffee",
  },
  {
    file: "aerofit-active.png",
    brand: "AEROFIT",
    kicker: "에어로 액티브웨어",
    headline1: "움직임은 가볍게,",
    headline2: "퍼포먼스는 강하게",
    subhead: "신축성 + 통기성 하이브리드",
    cta: "런칭 특가 25%",
    template: "sports",
  },
  {
    file: "nightgrid-speaker.png",
    brand: "NIGHTGRID",
    kicker: "프리미엄 블루투스 스피커",
    headline1: "저음은 더 깊게,",
    headline2: "디자인은 더 미니멀",
    subhead: "무드라이팅 + 24시간 재생",
    cta: "사전예약 오픈",
    template: "tech",
  },
  {
    file: "dermia-barrier-cream.png",
    brand: "DERMIA",
    kicker: "장벽 수분크림",
    headline1: "당김 없이,",
    headline2: "하루 종일 촉촉하게",
    subhead: "민감 피부 진정 루틴",
    cta: "첫 방문 혜택",
    template: "beauty",
  },
  {
    file: "lowbite-snackbar.png",
    brand: "LOWBITE",
    kicker: "저당 견과바",
    headline1: "간식은 가볍게,",
    headline2: "포만감은 길게",
    subhead: "10팩 묶음 세트 특가",
    cta: "묶음 할인 보기",
    template: "sports",
  },
  {
    file: "bareun-clinic-consulting.png",
    brand: "바른피부클리닉",
    kicker: "맞춤 1:1 상담",
    headline1: "상담은 편하게,",
    headline2: "안내는 정확하게",
    subhead: "첫 방문 상담 오픈",
    cta: "지금 예약",
    template: "clinic",
  },
];

function esc(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function commonDefs(extra = "") {
  return `
  <defs>
    <filter id="textShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
    <filter id="textGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="softBlur">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    ${extra}
  </defs>`;
}

function headlineBlock(x, y, h1, h2, color = "#F5F5F0") {
  return `
  <text x="${x}" y="${y}" fill="${color}" font-size="96" font-weight="900" letter-spacing="-1.2"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" filter="url(#textShadow)">${esc(h1)}</text>
  <text x="${x}" y="${y + 120}" fill="${color}" font-size="96" font-weight="900" letter-spacing="-1.2"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" filter="url(#textShadow)">${esc(h2)}</text>`;
}

function brandPill(brand, kicker, light = false) {
  const fg = light ? "#111214" : "#D6FF4F";
  const sub = light ? "rgba(17,18,20,0.85)" : "rgba(245,245,240,0.82)";
  const bg = light ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.08)";
  const stroke = light ? "rgba(17,18,20,0.14)" : "rgba(255,255,255,0.18)";
  return `
  <rect x="80" y="76" width="560" height="58" rx="29" fill="${bg}" stroke="${stroke}"/>
  <text x="112" y="114" fill="${fg}" font-size="30" letter-spacing="5" font-weight="700"
    font-family="'Space Grotesk','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(brand)}</text>
  <rect x="80" y="152" width="450" height="52" rx="26" fill="${bg}" stroke="${stroke}"/>
  <text x="112" y="186" fill="${sub}" font-size="27" font-weight="600"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(kicker)}</text>`;
}

function ctaPill(cta, x, y, color = "#D6FF4F", textColor = "#0B0B0C") {
  return `
  <rect x="${x}" y="${y}" width="420" height="108" rx="54" fill="${color}" filter="url(#textGlow)" opacity="0.84"/>
  <text x="${x + 210}" y="${y + 69}" text-anchor="middle" fill="${textColor}" font-size="49" font-weight="900"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(cta)}</text>`;
}

function buildBeverage(example) {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${commonDefs(`
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07090E"/>
      <stop offset="100%" stop-color="#1B2A1E"/>
    </linearGradient>
    <linearGradient id="can" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F5F5F0"/>
      <stop offset="50%" stop-color="#CED5C8"/>
      <stop offset="100%" stop-color="#8E9B86"/>
    </linearGradient>
  `)}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="830" cy="420" r="280" fill="rgba(214,255,79,0.2)" filter="url(#softBlur)"/>
  <circle cx="300" cy="260" r="220" fill="rgba(110,255,220,0.12)" filter="url(#softBlur)"/>

  <path d="M0 920 C180 860, 360 980, 560 930 C760 878, 900 810, 1080 860 L1080 1350 L0 1350 Z" fill="rgba(6,8,12,0.52)"/>
  <path d="M0 980 C170 920, 350 1030, 560 990 C760 948, 920 880, 1080 934 L1080 1350 L0 1350 Z" fill="rgba(214,255,79,0.18)"/>

  <ellipse cx="800" cy="990" rx="170" ry="42" fill="rgba(0,0,0,0.35)"/>
  <rect x="705" y="610" width="190" height="380" rx="86" fill="url(#can)" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
  <rect x="730" y="648" width="140" height="228" rx="32" fill="rgba(11,11,12,0.72)"/>
  <text x="800" y="748" text-anchor="middle" fill="#D6FF4F" font-size="36" font-weight="800"
    font-family="'Space Grotesk','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">LUMI</text>
  <text x="800" y="802" text-anchor="middle" fill="#F5F5F0" font-size="30" font-weight="600"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">ZERO SUGAR</text>

  ${brandPill(example.brand, example.kicker)}
  ${headlineBlock(82, 340, example.headline1, example.headline2)}
  <text x="86" y="650" fill="rgba(245,245,240,0.92)" font-size="45" font-weight="500"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(example.subhead)}</text>
  ${ctaPill(example.cta, 84, 944)}
</svg>`;
}

function buildBeauty(example) {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${commonDefs(`
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F7F7F2"/>
      <stop offset="100%" stop-color="#DDE2EF"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="#F6FAFF"/>
      <stop offset="100%" stop-color="#C9D5EA"/>
    </linearGradient>
  `)}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="250" cy="290" r="260" fill="rgba(214,255,79,0.16)" filter="url(#softBlur)"/>
  <circle cx="940" cy="250" r="240" fill="rgba(160,216,255,0.2)" filter="url(#softBlur)"/>

  <path d="M0 760 C190 700, 380 820, 560 782 C730 746, 900 680, 1080 726 L1080 1350 L0 1350 Z" fill="rgba(210,220,236,0.72)"/>
  <path d="M0 840 C190 772, 390 900, 560 862 C760 820, 920 752, 1080 806 L1080 1350 L0 1350 Z" fill="rgba(185,204,233,0.66)"/>

  <ellipse cx="750" cy="1000" rx="190" ry="38" fill="rgba(70,88,122,0.25)"/>
  <rect x="650" y="590" width="200" height="390" rx="42" fill="url(#glass)" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>
  <rect x="718" y="490" width="64" height="120" rx="20" fill="#9BAFD3"/>
  <rect x="702" y="460" width="96" height="42" rx="14" fill="#202737"/>
  <text x="750" y="748" text-anchor="middle" fill="#1E2433" font-size="31" font-weight="700"
    font-family="'Space Grotesk','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">SOLCARE</text>
  <text x="750" y="792" text-anchor="middle" fill="#414A63" font-size="26" font-weight="500"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">VITA GLOW</text>

  ${brandPill(example.brand, example.kicker, true)}
  ${headlineBlock(84, 340, example.headline1, example.headline2, "#14161D")}
  <text x="86" y="650" fill="rgba(28,34,45,0.86)" font-size="44" font-weight="500"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(example.subhead)}</text>
  ${ctaPill(example.cta, 84, 948, "#D6FF4F", "#0B0B0C")}
</svg>`;
}

function buildCoffee(example) {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${commonDefs(`
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#21140D"/>
      <stop offset="100%" stop-color="#4A2E1D"/>
    </linearGradient>
    <linearGradient id="cup" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F7EEE4"/>
      <stop offset="100%" stop-color="#DFCCB8"/>
    </linearGradient>
  `)}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="rgba(0,0,0,0.24)"/>
  <circle cx="190" cy="190" r="190" fill="rgba(255,212,142,0.2)" filter="url(#softBlur)"/>
  <circle cx="920" cy="280" r="260" fill="rgba(255,194,140,0.16)" filter="url(#softBlur)"/>

  <rect x="0" y="860" width="${WIDTH}" height="490" fill="rgba(18,12,8,0.62)"/>
  <ellipse cx="620" cy="980" rx="420" ry="90" fill="rgba(12,8,7,0.5)"/>

  <ellipse cx="620" cy="920" rx="180" ry="52" fill="#EFE2D2"/>
  <rect x="445" y="920" width="350" height="188" rx="28" fill="url(#cup)" stroke="rgba(255,255,255,0.65)"/>
  <ellipse cx="620" cy="922" rx="154" ry="40" fill="#3E2618"/>
  <path d="M796 968 C840 964, 858 986, 858 1018 C858 1050, 836 1074, 795 1072" fill="none" stroke="#DDCCBA" stroke-width="18"/>
  <path d="M560 826 C540 788, 582 770, 570 740" stroke="rgba(255,255,255,0.65)" stroke-width="8" fill="none"/>
  <path d="M626 812 C612 778, 652 758, 640 724" stroke="rgba(255,255,255,0.58)" stroke-width="8" fill="none"/>

  ${brandPill(example.brand, example.kicker)}
  ${headlineBlock(84, 330, example.headline1, example.headline2)}
  <text x="86" y="640" fill="rgba(245,245,240,0.9)" font-size="44" font-weight="500"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(example.subhead)}</text>
  ${ctaPill(example.cta, 84, 1122, "#D6FF4F", "#0B0B0C")}
</svg>`;
}

function buildSports(example) {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${commonDefs(`
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0E16"/>
      <stop offset="100%" stop-color="#22293B"/>
    </linearGradient>
    <linearGradient id="shoe" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F6F8FC"/>
      <stop offset="100%" stop-color="#A8B4CC"/>
    </linearGradient>
  `)}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <path d="M0 120 L1080 0 L1080 180 L0 300 Z" fill="rgba(142,229,255,0.14)"/>
  <path d="M0 300 L1080 180 L1080 340 L0 460 Z" fill="rgba(214,255,79,0.11)"/>
  <path d="M0 520 L1080 400 L1080 560 L0 680 Z" fill="rgba(11,11,12,0.26)"/>
  <circle cx="860" cy="220" r="220" fill="rgba(125,180,255,0.2)" filter="url(#softBlur)"/>

  <g transform="translate(520 760) rotate(-14)">
    <ellipse cx="30" cy="180" rx="270" ry="58" fill="rgba(0,0,0,0.4)"/>
    <path d="M-220 78 C-110 -6, 74 -24, 258 46 C286 58, 296 78, 292 106 C282 156, 246 180, 188 186 L-140 188 C-190 184, -228 156, -234 114 C-236 96, -232 88, -220 78 Z"
      fill="url(#shoe)" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
    <path d="M-160 90 L110 90" stroke="rgba(40,50,72,0.55)" stroke-width="4"/>
    <path d="M-180 122 L120 122" stroke="rgba(40,50,72,0.45)" stroke-width="4"/>
    <circle cx="-68" cy="95" r="4" fill="#111827"/>
    <circle cx="-28" cy="96" r="4" fill="#111827"/>
    <circle cx="12" cy="97" r="4" fill="#111827"/>
    <circle cx="52" cy="98" r="4" fill="#111827"/>
    <rect x="-66" y="58" width="100" height="20" rx="10" fill="#D6FF4F"/>
  </g>

  ${brandPill(example.brand, example.kicker)}
  ${headlineBlock(84, 334, example.headline1, example.headline2)}
  <text x="86" y="646" fill="rgba(245,245,240,0.9)" font-size="43" font-weight="500"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(example.subhead)}</text>
  ${ctaPill(example.cta, 84, 1118, "#D6FF4F", "#0B0B0C")}
</svg>`;
}

function buildTech(example) {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${commonDefs(`
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070911"/>
      <stop offset="100%" stop-color="#131733"/>
    </linearGradient>
    <linearGradient id="speaker" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#212845"/>
      <stop offset="100%" stop-color="#080A13"/>
    </linearGradient>
  `)}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="820" cy="250" r="260" fill="rgba(125,180,255,0.18)" filter="url(#softBlur)"/>
  <circle cx="220" cy="280" r="220" fill="rgba(214,255,79,0.1)" filter="url(#softBlur)"/>
  <g opacity="0.38">
    <rect x="0" y="1020" width="1080" height="10" fill="#3347A0"/>
    <rect x="0" y="1060" width="1080" height="8" fill="#24367C"/>
    <rect x="0" y="1100" width="1080" height="8" fill="#1C2B67"/>
  </g>
  <g transform="translate(540 860)">
    <rect x="-220" y="-280" width="440" height="560" rx="68" fill="url(#speaker)" stroke="rgba(160,188,255,0.34)" stroke-width="2"/>
    <circle cx="0" cy="-120" r="88" fill="#11162B" stroke="rgba(124,173,255,0.5)" stroke-width="2"/>
    <circle cx="0" cy="-120" r="42" fill="#273056"/>
    <circle cx="0" cy="128" r="118" fill="#0D1224" stroke="rgba(124,173,255,0.56)" stroke-width="2"/>
    <circle cx="0" cy="128" r="56" fill="#2F3A68"/>
    <circle cx="0" cy="128" r="142" fill="none" stroke="rgba(214,255,79,0.28)" stroke-width="9"/>
  </g>

  ${brandPill(example.brand, example.kicker)}
  ${headlineBlock(84, 334, example.headline1, example.headline2)}
  <text x="86" y="646" fill="rgba(245,245,240,0.9)" font-size="42" font-weight="500"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(example.subhead)}</text>
  ${ctaPill(example.cta, 84, 1118, "#D6FF4F", "#0B0B0C")}
</svg>`;
}

function buildClinic(example) {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${commonDefs(`
    <linearGradient id="bg" x1="0" y1="0" x2="0.95" y2="1">
      <stop offset="0%" stop-color="#F5F7FB"/>
      <stop offset="100%" stop-color="#DCE7F5"/>
    </linearGradient>
  `)}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="210" cy="200" r="220" fill="rgba(214,255,79,0.12)" filter="url(#softBlur)"/>
  <circle cx="900" cy="240" r="250" fill="rgba(111,198,255,0.16)" filter="url(#softBlur)"/>
  <rect x="0" y="860" width="${WIDTH}" height="490" fill="rgba(255,255,255,0.55)"/>
  <rect x="650" y="520" width="260" height="440" rx="42" fill="rgba(255,255,255,0.8)" stroke="rgba(120,140,165,0.34)" />
  <rect x="706" y="590" width="150" height="210" rx="30" fill="rgba(214,255,79,0.3)" />
  <rect x="680" y="550" width="205" height="42" rx="21" fill="rgba(35,46,64,0.85)" />
  <text x="782" y="577" text-anchor="middle" fill="#F5F5F0" font-size="24" font-weight="700"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">DERM CARE</text>

  ${brandPill(example.brand, example.kicker, true)}
  ${headlineBlock(84, 330, example.headline1, example.headline2, "#182133")}
  <text x="86" y="640" fill="rgba(28,34,45,0.85)" font-size="42" font-weight="500"
    font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif">${esc(example.subhead)}</text>
  ${ctaPill(example.cta, 84, 1118, "#D6FF4F", "#0B0B0C")}
</svg>`;
}

function buildSvg(example) {
  if (example.template === "beverage") return buildBeverage(example);
  if (example.template === "beauty") return buildBeauty(example);
  if (example.template === "coffee") return buildCoffee(example);
  if (example.template === "sports") return buildSports(example);
  if (example.template === "clinic") return buildClinic(example);
  return buildTech(example);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const example of EXAMPLES) {
    const svg = buildSvg(example);
    const outPath = path.join(OUT_DIR, example.file);
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, quality: 100 })
      .toFile(outPath);
    console.log(`generated: ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
