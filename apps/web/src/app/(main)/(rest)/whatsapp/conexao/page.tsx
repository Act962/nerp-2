import { PageHeader } from "@/components/page-header";
import { ConexaoContainer } from "@/features/whatsapp-chat/components/conexao-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("whatsapp");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Conexão do WhatsApp"
        description="Ligue um número da API oficial da Meta a um funil de atendimento."
      />
      <ConexaoContainer />
    </div>
  );
}
