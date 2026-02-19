import PricingPageClient from "@/components/studio-ui/PricingPageClient";
import LegalFooter from "@/components/studio-ui/LegalFooter";
import SiteHeader from "@/components/studio-ui/SiteHeader";

export default function PricingPage() {
  return (
    <div>
      <SiteHeader />
      <PricingPageClient />
      <LegalFooter />
    </div>
  );
}
