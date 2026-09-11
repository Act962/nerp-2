import { PageHeader } from "@/components/page-header";
import { CreditosContainer } from "@/features/stars/components/creditos-container";
import { requireAuth } from "@/lib/auth-utils";

// Sem chave de permissão: saldo e extrato são da organização inteira. Comprar
// e definir preço ficam trancados a administrador no servidor.
export default async function Page() {
  await requireAuth();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Stars"
        description="O saldo que paga o Astro e as mensagens do WhatsApp, o uso do plano e o extrato de cada movimento."
      />
      <CreditosContainer />
    </div>
  );
}
