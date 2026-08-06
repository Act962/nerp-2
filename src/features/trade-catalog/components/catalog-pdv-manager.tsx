"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStores } from "@/features/stores/hooks/use-stores";
import { CatalogList } from "@/features/pdv-catalog/components/catalog-list";
import { useState } from "react";
import { useCatalogPdv } from "../hooks/use-catalog-pdv";
import { CatalogPdvPriceRow } from "./catalog-pdv-price-row";
import { PricingSettingsCard } from "./pricing-settings-card";
import { RegionBenchmarkPanel } from "./region-benchmark-panel";

function PriceListTab() {
  const { stores, isLoading: isLoadingStores } = useStores({ pageSize: 100 });
  const [storeId, setStoreId] = useState<string>("");
  const { items, missingStoreCostData, isLoading } = useCatalogPdv(storeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-72 space-y-1.5">
          <label className="text-sm font-medium">Loja</label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger disabled={isLoadingStores}>
              <SelectValue placeholder="Selecione uma loja" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <PricingSettingsCard />

      {!storeId ? (
        <p className="text-sm text-muted-foreground">
          Selecione uma loja para ver os preços sugeridos.
        </p>
      ) : missingStoreCostData ? (
        <p className="text-sm text-muted-foreground">
          Essa loja ainda não tem área (m²) ou custo mensal cadastrados — sem
          esses dados não é possível calcular o custo do m² e sugerir preços.
          Preencha em Lojas e Mapas → editar loja → Métricas da loja.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Mídia</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Preço/mês</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading &&
              items.map((item) => (
                <CatalogPdvPriceRow
                  key={item.mediaTypeId}
                  storeId={storeId}
                  mediaTypeId={item.mediaTypeId}
                  code={item.code}
                  name={item.name}
                  pricingBasis={item.pricingBasis}
                  price={item.price}
                  priceSource={item.priceSource}
                  manualPriceId={item.manualPriceId}
                />
              ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function CatalogPdvManager() {
  return (
    <Tabs defaultValue="precos">
      <TabsList>
        <TabsTrigger value="precos">Preços por loja</TabsTrigger>
        <TabsTrigger value="benchmark">Benchmark regional</TabsTrigger>
        <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
      </TabsList>
      <TabsContent value="precos" className="mt-4">
        <PriceListTab />
      </TabsContent>
      <TabsContent value="benchmark" className="mt-4">
        <RegionBenchmarkPanel />
      </TabsContent>
      <TabsContent value="catalogos" className="mt-4">
        <CatalogList />
      </TabsContent>
    </Tabs>
  );
}
