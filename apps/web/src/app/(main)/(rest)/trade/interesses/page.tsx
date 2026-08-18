import { PageHeader } from "@/components/page-header";
import { TradeInterestsInbox } from "@/features/trade-interest/components/trade-interests-inbox";
import { requirePermission } from "@/lib/auth-utils";

// Inbox dos leads capturados no TradeGram público: interesses em pontos livres e
// filas de espera de pontos ocupados. É o canal que mantém a negociação dentro
// da plataforma.
export default async function TradeInterestsPage() {
  await requirePermission("trade-interesses");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interesses (TradeGram)"
        description="Leads que chegaram pelo mapa público: quem quer negociar um ponto livre ou entrar na fila de um ocupado."
      />
      <TradeInterestsInbox />
    </div>
  );
}
