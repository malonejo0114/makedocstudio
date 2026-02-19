import SiteHeader from "@/components/studio-ui/SiteHeader";
import LegalFooter from "@/components/studio-ui/LegalFooter";
import LoginPageClient from "@/components/studio-ui/LoginPageClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function readParam(
  source: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = source?.[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export default function LoginPage({ searchParams }: PageProps) {
  const nextPath = readParam(searchParams, "next") || "/studio-entry";

  return (
    <div>
      <SiteHeader showStudioCta={false} />
      <LoginPageClient nextPath={nextPath} />
      <LegalFooter compact />
    </div>
  );
}
