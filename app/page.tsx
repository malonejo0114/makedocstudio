import LandingPage from "@/components/studio-ui/LandingPage";
import LegalFooter from "@/components/studio-ui/LegalFooter";
import SiteHeader from "@/components/studio-ui/SiteHeader";

export default function HomePage() {
  return (
    <div className="pb-8">
      <SiteHeader />
      <LandingPage />
      <LegalFooter />
    </div>
  );
}
