"use client";

import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { CatalogOrdersBoard } from "./catalog-orders/catalog-orders-board";
import { KitchenBoard } from "./pedidos-board";

const TABS = ["catalogo", "cozinha"] as const;

export function PedidosTabs() {
  const [tab, setTab] = useQueryState(
    "aba",
    parseAsStringLiteral(TABS).withDefault("catalogo"),
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const nextTab = TABS.find((candidate) => candidate === value);
        if (nextTab) setTab(nextTab);
      }}
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="catalogo">Catálogo online</TabsTrigger>
        <TabsTrigger value="cozinha" data-jornada="pedidos-aba-cozinha">
          Cozinha
        </TabsTrigger>
      </TabsList>
      <TabsContent value="catalogo" className="flex flex-col gap-6">
        <PageHeader
          title="Pedidos do catálogo"
          description="Pedidos do Catálogo Online, de todos os modos de operação."
        />
        <CatalogOrdersBoard />
      </TabsContent>
      <TabsContent value="cozinha">
        <KitchenBoard />
      </TabsContent>
    </Tabs>
  );
}
