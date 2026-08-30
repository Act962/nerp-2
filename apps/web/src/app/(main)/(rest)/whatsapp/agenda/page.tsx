import { PageHeader } from "@/components/page-header";
import { AgendasContainer } from "@/features/agenda/components/agendas-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("whatsapp");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Agenda"
        description="Link público de marcação: o cliente escolhe o horário e entra no funil."
      />
      <AgendasContainer />
    </div>
  );
}
