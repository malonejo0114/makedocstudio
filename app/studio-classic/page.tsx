import AppHeader from "@/components/studio-ui/AppHeader";
import AuthGate from "@/components/studio-ui/AuthGate";
import StudioWorkspaceTabs from "@/components/studio-ui/StudioWorkspaceTabs";

export default function StudioClassicPage() {
  return (
    <AuthGate>
      <div>
        <AppHeader />
        <StudioWorkspaceTabs variant="classic" />
      </div>
    </AuthGate>
  );
}
