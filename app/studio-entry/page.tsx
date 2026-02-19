import AppHeader from "@/components/studio-ui/AppHeader";
import AuthGate from "@/components/studio-ui/AuthGate";
import StudioVersionEntryClient from "@/components/studio-ui/StudioVersionEntryClient";

export default function StudioEntryPage() {
  return (
    <AuthGate>
      <div>
        <AppHeader />
        <StudioVersionEntryClient />
      </div>
    </AuthGate>
  );
}
