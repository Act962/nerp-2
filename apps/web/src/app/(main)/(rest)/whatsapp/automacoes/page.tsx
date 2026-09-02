import { PageHeader } from "@/components/page-header";
import { AutomacoesContainer } from "@/features/automacoes/components/automacoes-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("whatsapp");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Automações"
        description="Um gatilho, uma fila de passos. O que o atendimento faz sozinho."
      />
      <AutomacoesContainer />
    </div>
  );
}
