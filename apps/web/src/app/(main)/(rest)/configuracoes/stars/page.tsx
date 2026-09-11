import { PageHeader } from "@/components/page-header";
import { CreditosContainer } from "@/features/stars/components/creditos-container";
import { requireAuth } from "@/lib/auth-utils";

// Sem chave de permissão: saldo e extrato são da organização inteira, e agora
// a tela só LÊ. Definir o preço das ações mudou para `/site/stars`, no painel
// da plataforma — preço é decisão comercial da casa, e com o campo aqui o
// próprio cliente podia zerá-lo e usar o Astro de graça.
export default async function Page() {
  await requireAuth();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Stars"
        description="O saldo que paga o Astro e as mensagens do WhatsApp, o quanto do plano já foi e o extrato de cada movimento."
      />
      <CreditosContainer />
    </div>
  );
}
