import type { Locale } from "@/lib/i18n/config";

export type SiteHeaderCopy = {
  brand: string;
  openStudio: string;
  navPricing: string;
  navExamples: string;
  navTemplates: string;
  navGuide: string;
  navFaq: string;
};

export type SiteFeatureCopy = {
  title: string;
  description: string;
};

export type SiteLandingCopy = {
  heroTitle: string;
  heroSub: string;
  startStudio: string;
  seeExamples: string;
  pricingHintPrefix: string;
  pricingHintSuffix: string;
  quickLogin: string;
  signin: string;
  signup: string;
  alreadySignedIn: string;
  openStudio: string;
  signOut: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  signupAndStart: string;
  tutorial: string;
  ready: string;
  finalTitle: string;
  checkPricing: string;
  processSteps: string[];
  coreFeatures: SiteFeatureCopy[];
};

export type SiteCopySettings = {
  header: Record<Locale, SiteHeaderCopy>;
  landing: Record<Locale, SiteLandingCopy>;
};

export const SITE_COPY_SETTINGS_FILENAME = "__site_copy_settings__.json";

export const DEFAULT_SITE_COPY_SETTINGS: SiteCopySettings = {
  header: {
    ko: {
      brand: "MakeDoc Studio",
      openStudio: "스튜디오 열기",
      navPricing: "요금",
      navExamples: "예시",
      navTemplates: "템플릿",
      navGuide: "가이드",
      navFaq: "FAQ",
    },
    en: {
      brand: "MakeDoc Studio",
      openStudio: "Open Studio",
      navPricing: "Pricing",
      navExamples: "Examples",
      navTemplates: "Templates",
      navGuide: "Guide",
      navFaq: "FAQ",
    },
  },
  landing: {
    ko: {
      heroTitle: "레퍼런스 한 장으로\n팔리는 광고소재를.",
      heroSub: "분석부터 생성, 다운로드까지 한 화면에서 빠르게 완성합니다.",
      startStudio: "스튜디오 시작하기",
      seeExamples: "생성 예시 보기",
      pricingHintPrefix: "시작 단가",
      pricingHintSuffix: "이미지 1장당 크레딧 자동 차감",
      quickLogin: "Quick Login",
      signin: "로그인",
      signup: "회원가입",
      alreadySignedIn: "이미 로그인되어 있습니다. 바로 스튜디오로 이동하세요.",
      openStudio: "스튜디오 열기 ↗",
      signOut: "로그아웃",
      emailPlaceholder: "이메일",
      passwordPlaceholder: "비밀번호 (6자 이상)",
      signupAndStart: "회원가입 후 시작",
      tutorial: "이용 튜토리얼 보기",
      ready: "Ready",
      finalTitle: "지저분한 툴 체인 없이,\n한 번에 광고소재를 만드세요.",
      checkPricing: "가격 확인",
      processSteps: ["레퍼런스 분석", "3관점 프롬프트 편집", "원클릭 이미지 생성", "PNG 다운로드"],
      coreFeatures: [
        {
          title: "레퍼런스 분석",
          description: "레이아웃/후킹/타이포를 분해해 바로 쓰는 인사이트로 변환합니다.",
        },
        {
          title: "3관점 프롬프트",
          description: "기획자/마케터/디자이너 프롬프트를 한 화면에서 동시에 다룹니다.",
        },
        {
          title: "통합 크레딧",
          description: "1크레딧=100원 정책으로 모델 가격과 차감량을 직관적으로 확인합니다.",
        },
      ],
    },
    en: {
      heroTitle: "Turn one reference image\ninto high-converting ad creatives.",
      heroSub: "From analysis to generation to download, all in one screen.",
      startStudio: "Start Studio",
      seeExamples: "View Examples",
      pricingHintPrefix: "Starting at",
      pricingHintSuffix: "credit auto-deducted per generated image",
      quickLogin: "Quick Login",
      signin: "Sign in",
      signup: "Sign up",
      alreadySignedIn: "You are already signed in. Go straight to Studio.",
      openStudio: "Open Studio ↗",
      signOut: "Sign out",
      emailPlaceholder: "Email",
      passwordPlaceholder: "Password (min 6 chars)",
      signupAndStart: "Sign up and start",
      tutorial: "Open tutorial",
      ready: "Ready",
      finalTitle: "Skip messy tool chains.\nCreate ad creatives in one flow.",
      checkPricing: "View Pricing",
      processSteps: ["Reference Analysis", "3-Perspective Prompt Editing", "One-click Image Generation", "PNG Download"],
      coreFeatures: [
        {
          title: "Reference Analysis",
          description: "Break down layout, hook, and typography into immediately usable insights.",
        },
        {
          title: "3-Perspective Prompts",
          description: "Edit planner/marketer/designer prompts together in one workspace.",
        },
        {
          title: "Unified Credits",
          description: "1 credit = KRW 100, with clear model pricing and deduction visibility.",
        },
      ],
    },
  },
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string, max = 300): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

function normalizeStringArray(value: unknown, fallback: string[], maxItems = 8): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeFeatures(value: unknown, fallback: SiteFeatureCopy[]): SiteFeatureCopy[] {
  if (!Array.isArray(value)) return fallback.map((item) => ({ ...item }));
  const normalized = value
    .map((entry) => {
      const obj = asObject(entry);
      if (!obj) return null;
      const title = asString(obj.title, "");
      const description = asString(obj.description, "", 500);
      if (!title || !description) return null;
      return { title, description };
    })
    .filter(Boolean) as SiteFeatureCopy[];
  return normalized.length > 0 ? normalized.slice(0, 6) : fallback.map((item) => ({ ...item }));
}

function normalizeHeaderLocaleCopy(
  value: Record<string, unknown> | null,
  fallback: SiteHeaderCopy,
): SiteHeaderCopy {
  return {
    brand: asString(value?.brand, fallback.brand),
    openStudio: asString(value?.openStudio, fallback.openStudio),
    navPricing: asString(value?.navPricing, fallback.navPricing),
    navExamples: asString(value?.navExamples, fallback.navExamples),
    navTemplates: asString(value?.navTemplates, fallback.navTemplates),
    navGuide: asString(value?.navGuide, fallback.navGuide),
    navFaq: asString(value?.navFaq, fallback.navFaq),
  };
}

function normalizeLandingLocaleCopy(
  value: Record<string, unknown> | null,
  fallback: SiteLandingCopy,
): SiteLandingCopy {
  return {
    heroTitle: asString(value?.heroTitle, fallback.heroTitle, 500),
    heroSub: asString(value?.heroSub, fallback.heroSub, 500),
    startStudio: asString(value?.startStudio, fallback.startStudio),
    seeExamples: asString(value?.seeExamples, fallback.seeExamples),
    pricingHintPrefix: asString(value?.pricingHintPrefix, fallback.pricingHintPrefix),
    pricingHintSuffix: asString(value?.pricingHintSuffix, fallback.pricingHintSuffix),
    quickLogin: asString(value?.quickLogin, fallback.quickLogin),
    signin: asString(value?.signin, fallback.signin),
    signup: asString(value?.signup, fallback.signup),
    alreadySignedIn: asString(value?.alreadySignedIn, fallback.alreadySignedIn, 500),
    openStudio: asString(value?.openStudio, fallback.openStudio),
    signOut: asString(value?.signOut, fallback.signOut),
    emailPlaceholder: asString(value?.emailPlaceholder, fallback.emailPlaceholder),
    passwordPlaceholder: asString(value?.passwordPlaceholder, fallback.passwordPlaceholder),
    signupAndStart: asString(value?.signupAndStart, fallback.signupAndStart),
    tutorial: asString(value?.tutorial, fallback.tutorial),
    ready: asString(value?.ready, fallback.ready),
    finalTitle: asString(value?.finalTitle, fallback.finalTitle, 500),
    checkPricing: asString(value?.checkPricing, fallback.checkPricing),
    processSteps: normalizeStringArray(value?.processSteps, fallback.processSteps),
    coreFeatures: normalizeFeatures(value?.coreFeatures, fallback.coreFeatures),
  };
}

export function getDefaultSiteCopySettings(): SiteCopySettings {
  return JSON.parse(JSON.stringify(DEFAULT_SITE_COPY_SETTINGS)) as SiteCopySettings;
}

export function normalizeSiteCopySettings(input: unknown): SiteCopySettings {
  const root = asObject(input);
  const header = asObject(root?.header);
  const landing = asObject(root?.landing);

  return {
    header: {
      ko: normalizeHeaderLocaleCopy(asObject(header?.ko), DEFAULT_SITE_COPY_SETTINGS.header.ko),
      en: normalizeHeaderLocaleCopy(asObject(header?.en), DEFAULT_SITE_COPY_SETTINGS.header.en),
    },
    landing: {
      ko: normalizeLandingLocaleCopy(asObject(landing?.ko), DEFAULT_SITE_COPY_SETTINGS.landing.ko),
      en: normalizeLandingLocaleCopy(asObject(landing?.en), DEFAULT_SITE_COPY_SETTINGS.landing.en),
    },
  };
}

export function parseSiteCopySettingsInput(payload: unknown): SiteCopySettings {
  return normalizeSiteCopySettings(payload);
}
