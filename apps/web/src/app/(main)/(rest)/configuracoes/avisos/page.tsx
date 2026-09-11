import { PageHeader } from "@/components/page-header";
import { CentralDeAvisos } from "@/features/astro/components/central-de-avisos";
import { requireAuth } from "@/lib/auth-utils";

// Sem chave de permissão, como a tela de Stars: os avisos são da organização
// inteira, e quem já entra no sistema pode saber que o estoque está acabando.
export default async function Page() {
  await requireAuth();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Avisos do Astro"
        description="O que ele viu na operação sem ninguém perguntar, e o que ele guardou desta empresa."
      />
      <CentralDeAvisos />
    </div>
  );
}
