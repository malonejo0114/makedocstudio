import AppHeader from "@/components/studio-ui/AppHeader";
import AuthGate from "@/components/studio-ui/AuthGate";
import ProjectDetailClient from "@/components/studio-ui/ProjectDetailClient";

type PageProps = {
  params: {
    id: string;
  };
};

export default function ProjectDetailPage({ params }: PageProps) {
  return (
    <AuthGate>
      <div>
        <AppHeader />
        <ProjectDetailClient projectId={params.id} />
      </div>
    </AuthGate>
  );
}
