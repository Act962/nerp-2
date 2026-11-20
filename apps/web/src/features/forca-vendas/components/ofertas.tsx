"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogosTab } from "@/features/promotor/components/catalogos-tab";
import { FvPagina } from "./fv-pagina";
import { BuscaDeProdutos } from "./produtos";

// Ofertas do dia: os produtos com preço promocional ou desconto vigente e os
// catálogos promocionais que o gestor publicou (os mesmos do App Vendedor).
export function TelaDeOfertas() {
  return (
    <FvPagina titulo="Ofertas do dia">
      <Tabs defaultValue="produtos">
        <TabsList className="w-full">
          <TabsTrigger value="produtos" className="flex-1">
            Produtos
          </TabsTrigger>
          <TabsTrigger value="catalogos" className="flex-1">
            Catálogos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="produtos" className="mt-3">
          <BuscaDeProdutos
            customerId={null}
            apenasOfertas
            hrefDoProduto={(id) => `/forca-de-vendas/produtos/${id}`}
          />
        </TabsContent>
        <TabsContent value="catalogos" className="mt-3">
          <CatalogosTab />
        </TabsContent>
      </Tabs>
    </FvPagina>
  );
}
