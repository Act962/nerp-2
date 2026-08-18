import { PageHeader } from "@/components/page-header";
import { AddCollaboratorButton } from "@/features/collaborators/components/add-collaborator-button";
import { CollaboratorsList } from "@/features/collaborators/components/collaborators-list";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("colaboradores");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Colaboradores"
        description="Cadastre quem atende seus pedidos com nome, função e foto."
      >
        <AddCollaboratorButton />
      </PageHeader>
      <CollaboratorsList />
    </div>
  );
}
