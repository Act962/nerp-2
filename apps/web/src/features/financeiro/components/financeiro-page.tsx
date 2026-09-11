"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mesAtual, type Periodo } from "@/features/financeiro/lib/periodo";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { AccountsTab } from "./accounts-tab";
import { CashflowTab } from "./cashflow-tab";
import { CategoriesTab } from "./categories-tab";
import { ContactsTab } from "./contacts-tab";
import { CostCentersTab } from "./cost-centers-tab";
import { DashboardTab } from "./dashboard-tab";
import { DreTab } from "./dre-tab";
import { DroTab } from "./dro-tab";
import { VendasTab } from "./vendas-tab";
import { EntriesTab } from "./entries-tab";
import { PeriodFilter } from "./period-filter";

/**
 * Abas que falam de período.
 *
 * O Dashboard fica DE FORA de propósito: ele é um retrato do agora — "recebido
 * no mês", "vence nos próximos 7 dias", "últimos 6 meses" — e o procedure dele
 * nem recebe datas (`z.void()`). Aplicar um período ali não seria filtrar, seria
 * redefinir o que cada cartão significa. Contas, Categorias, Centros de Custo e
 * Contatos são cadastros, sem data nenhuma.
 */
const ABAS_COM_PERIODO = new Set([
  "entries",
  "cashflow",
  "dre",
  "dro",
  "vendas",
]);

export function FinanceiroPage() {
  // Aba e período na URL: recarregar não devolve o usuário ao Dashboard de
  // setembro quando ele estava no DRE de julho, e o link pode ser mandado
  // para o contador exatamente como está na tela.
  const [aba, setAba] = useQueryState("aba", { defaultValue: "dashboard" });
  const [de, setDe] = useQueryState("de");
  const [ate, setAte] = useQueryState("ate");

  const periodo: Periodo = useMemo(() => {
    const padrao = mesAtual();
    return { from: de || padrao.from, to: ate || padrao.to };
  }, [de, ate]);

  const aplicarPeriodo = (novo: Periodo) => {
    setDe(novo.from);
    setAte(novo.to);
  };

  return (
    <Tabs value={aba} onValueChange={setAba} className="w-full">
      {/* O filtro some nas abas que não têm data, em vez de ficar visível sem
          efeito — controle que não faz nada é pior que controle ausente. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="entries">Lançamentos</TabsTrigger>
          <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="dro">DRO</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="cost-centers">Centros de Custo</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
        </TabsList>
        {ABAS_COM_PERIODO.has(aba) && (
          <div className="shrink-0">
            <PeriodFilter value={periodo} onChange={aplicarPeriodo} />
          </div>
        )}
      </div>

      <TabsContent value="dashboard" className="mt-6">
        <DashboardTab />
      </TabsContent>
      <TabsContent value="entries" className="mt-6">
        <EntriesTab periodo={periodo} />
      </TabsContent>
      <TabsContent value="cashflow" className="mt-6">
        <CashflowTab periodo={periodo} />
      </TabsContent>
      <TabsContent value="dre" className="mt-6">
        <DreTab periodo={periodo} />
      </TabsContent>
      <TabsContent value="dro" className="mt-6">
        <DroTab periodo={periodo} />
      </TabsContent>
      <TabsContent value="vendas" className="mt-6">
        <VendasTab periodo={periodo} />
      </TabsContent>
      <TabsContent value="accounts" className="mt-6">
        <AccountsTab />
      </TabsContent>
      <TabsContent value="categories" className="mt-6">
        <CategoriesTab />
      </TabsContent>
      <TabsContent value="cost-centers" className="mt-6">
        <CostCentersTab />
      </TabsContent>
      <TabsContent value="contacts" className="mt-6">
        <ContactsTab />
      </TabsContent>
    </Tabs>
  );
}
