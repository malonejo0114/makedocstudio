import AccountPageClient from "@/components/studio-ui/AccountPageClient";
import AppHeader from "@/components/studio-ui/AppHeader";
import AuthGate from "@/components/studio-ui/AuthGate";

export default function AccountPage() {
  return (
    <AuthGate>
      <div>
        <AppHeader />
        <AccountPageClient />
      </div>
    </AuthGate>
  );
}
