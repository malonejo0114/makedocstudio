import AppHeader from "@/components/studio-ui/AppHeader";
import AuthGate from "@/components/studio-ui/AuthGate";
import ProjectsPageClient from "@/components/studio-ui/ProjectsPageClient";

export default function ProjectsPage() {
  return (
    <AuthGate>
      <div>
        <AppHeader />
        <ProjectsPageClient />
      </div>
    </AuthGate>
  );
}
