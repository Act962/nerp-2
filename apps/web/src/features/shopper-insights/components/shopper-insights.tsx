"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionChart } from "@/features/trade-dashboard/components/section-chart";
import { useShopperInsights } from "../hooks/use-shopper-insights";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0.5 p-4">
        <span className="font-semibold text-2xl tabular-nums">
          {value.toLocaleString("pt-BR")}
        </span>
        <span className="text-muted-foreground text-xs leading-tight">
          {label}
        </span>
      </CardContent>
    </Card>
  );
}

function ChartBlock({
  title,
  hint,
  data,
}: {
  title: string;
  hint: string;
  data: { label: string; value: number }[];
}) {
  return (
    <section className="space-y-2 rounded-xl border bg-card/40 p-3">
      <div>
        <h2 className="font-medium text-sm">{title}</h2>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      {data.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          Sem dados ainda.
        </p>
      ) : (
        <SectionChart data={data} />
      )}
    </section>
  );
}

export function ShopperInsights() {
  const { data, isLoading } = useShopperInsights(30);

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { totals, topProducts, topIndustries, topSectors, catalogGaps } = data;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Escaneamentos (30d)" value={totals.scans} />
        <StatCard label="Clientes únicos" value={totals.uniqueShoppers} />
        <StatCard label="Favoritos" value={totals.favorites} />
        <StatCard label="Cupons resgatados" value={totals.couponRedemptions} />
        <StatCard label="Códigos não achados" value={totals.unknown} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title="Produtos mais escaneados"
          hint="Atenção do consumidor por SKU."
          data={topProducts}
        />
        <ChartBlock
          title="Indústrias com mais atenção"
          hint="Escaneamentos agregados por indústria (marca → fornecedor)."
          data={topIndustries}
        />
        <ChartBlock
          title="Seções mais buscadas"
          hint="De onde vêm os 'onde está' — atenção por seção do mapa."
          data={topSectors}
        />
        <section className="space-y-2 rounded-xl border bg-card/40 p-3">
          <div>
            <h2 className="font-medium text-sm">Lacunas de catálogo</h2>
            <p className="text-muted-foreground text-xs">
              Códigos escaneados que não existem no cadastro — demanda +
              cadastro a completar.
            </p>
          </div>
          {catalogGaps.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              Nenhum código órfão.
            </p>
          ) : (
            <div className="space-y-1">
              {catalogGaps.map((gap) => (
                <div
                  key={gap.barcode}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                >
                  <span className="font-mono">{gap.barcode}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {gap.value}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
