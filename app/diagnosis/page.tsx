import MarketingGrowthBackdrop from "@/components/MarketingGrowthBackdrop";
import MkdocDiagnosisWizard from "@/components/MkdocDiagnosisWizard";

export default function DiagnosisPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <MarketingGrowthBackdrop />
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-300/15 blur-3xl" />

      <div className="mx-auto w-full max-w-6xl">
        <MkdocDiagnosisWizard />
      </div>
    </main>
  );
}

