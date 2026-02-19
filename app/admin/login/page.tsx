import AdminLoginForm from "@/components/AdminLoginForm";
import MarketingGrowthBackdrop from "@/components/MarketingGrowthBackdrop";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function readParam(
  source: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = source?.[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

export default function AdminLoginPage({ searchParams }: PageProps) {
  const next = readParam(searchParams, "next") || "/admin";
  const configError = readParam(searchParams, "error") === "config";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(150deg,#020617_0%,#0f172a_45%,#164e63_100%)] p-4">
      <MarketingGrowthBackdrop />
      <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-cyan-400/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
      <AdminLoginForm next={next} configError={configError} />
    </main>
  );
}
