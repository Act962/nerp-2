import { PageHeader } from "@/components/page-header";
import { FunilContainer } from "@/features/crm/components/funil-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("whatsapp");

  return (
    // Altura fixa: o board rola na horizontal por dentro, não a página.
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Funil"
        description="Os clientes em atendimento, por etapa. Arraste para mover."
      />
      <FunilContainer />
    </div>
  );
}
