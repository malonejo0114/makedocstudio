import type { Metadata } from "next";
import { Noto_Sans_KR, Space_Grotesk } from "next/font/google";

import { LanguageProvider } from "@/components/studio-ui/LanguageProvider";
import { getRequestLocale } from "@/lib/i18n/server";
import { getRuntimeSeoSettings } from "@/lib/seo/settings";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

function tryParseUrl(value: string): URL | null {
  try {
    if (!value) return null;
    return new URL(value);
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getRuntimeSeoSettings();
  const metadataBase = tryParseUrl(seo.canonicalBaseUrl);
  const ogImage = seo.ogImageUrl.trim();

  return {
    title: seo.defaultTitle,
    description: seo.description,
    robots: seo.robots,
    metadataBase: metadataBase ?? undefined,
    alternates: metadataBase ? { canonical: "/" } : undefined,
    openGraph: {
      title: seo.defaultTitle,
      description: seo.description,
      siteName: seo.siteName,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = getRequestLocale();
  const seo = await getRuntimeSeoSettings();

  return (
    <html lang={initialLocale} className={`${spaceGrotesk.variable} ${notoSansKr.variable}`}>
      <head>
        {seo.googleSiteVerification ? (
          <meta name="google-site-verification" content={seo.googleSiteVerification} />
        ) : null}
        {seo.naverSiteVerification ? (
          <meta name="naver-site-verification" content={seo.naverSiteVerification} />
        ) : null}
        {seo.additionalMetaTags.map((tag, idx) =>
          tag.type === "property" ? (
            <meta key={`seo-meta-property-${tag.key}-${idx}`} property={tag.key} content={tag.content} />
          ) : (
            <meta key={`seo-meta-name-${tag.key}-${idx}`} name={tag.key} content={tag.content} />
          ),
        )}
        {seo.headScriptUrls.map((url, idx) => (
          <script key={`seo-head-script-url-${idx}`} src={url} />
        ))}
        {seo.headInlineScript ? (
          <script
            id="seo-head-inline"
            dangerouslySetInnerHTML={{ __html: seo.headInlineScript }}
          />
        ) : null}
      </head>
      <body>
        {seo.bodyStartScriptUrls.map((url, idx) => (
          <script key={`seo-body-start-script-url-${idx}`} src={url} />
        ))}
        {seo.bodyStartInlineScript ? (
          <script
            id="seo-body-start-inline"
            dangerouslySetInnerHTML={{ __html: seo.bodyStartInlineScript }}
          />
        ) : null}
        <LanguageProvider initialLocale={initialLocale}>{children}</LanguageProvider>
        {seo.bodyEndScriptUrls.map((url, idx) => (
          <script key={`seo-body-end-script-url-${idx}`} src={url} />
        ))}
        {seo.bodyEndInlineScript ? (
          <script
            id="seo-body-end-inline"
            dangerouslySetInnerHTML={{ __html: seo.bodyEndInlineScript }}
          />
        ) : null}
      </body>
    </html>
  );
}
