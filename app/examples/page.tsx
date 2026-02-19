import ExamplesPageClient from "@/components/studio-ui/ExamplesPageClient";
import LegalFooter from "@/components/studio-ui/LegalFooter";
import SiteHeader from "@/components/studio-ui/SiteHeader";

export default function ExamplesPage() {
  return (
    <div>
      <SiteHeader />
      <ExamplesPageClient />
      <LegalFooter />
    </div>
  );
}
