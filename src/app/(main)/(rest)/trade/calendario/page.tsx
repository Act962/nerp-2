import { PageHeader } from "@/components/page-header";
import { CalendarioContainer } from "@/features/calendario/components/calendario-container";
import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";

// Calendário de eventos do Trade: feriados e datas comemorativas já vêm
// prontos; a coordenação publica ações, campanhas e reuniões, e o promotor
// acompanha pelo App Promotor.
export default async function TradeCalendarioPage() {
  await requireTradeAccess("trade-calendario");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendário de Ações"
        description="Feriados, datas comemorativas, ações no PDV e reuniões — com promotores escalados e checklist de execução."
      />
      <CalendarioContainer />
    </div>
  );
}
