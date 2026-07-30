"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import {
  OrgDashboardView,
  type OrgWidgetSummary,
  type OrgWidgetValueEntry,
} from "./org-dashboard-view";

// Prévia pública (sem login). Não abre picker, não edita, não mostra
// link/gerenciador — é visão exclusiva de LEITURA para telão de sala ou
// relatório enviado por link.

const POLL_INTERVAL_MS = 5 * 60_000;

export function PublicOrgDashboard({ shareToken }: { shareToken: string }) {
  const {
    data: widgetsData,
    isLoading: isLoadingWidgets,
    isError,
  } = useQuery({
    ...orpc.orgDashboard.publicGet.queryOptions({
      input: { shareToken },
      refetchInterval: POLL_INTERVAL_MS,
    }),
    // Token inválido = 404 definitivo — retentar 3× só empurra o "Link
    // inválido" pra 10s depois. Uma tentativa basta.
    retry: false,
  });

  const { data: valuesData, isLoading: isLoadingValues } = useQuery({
    ...orpc.orgDashboard.publicResolveValues.queryOptions({
      input: { shareToken },
      refetchInterval: POLL_INTERVAL_MS,
      enabled: !!widgetsData,
    }),
    retry: false,
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="font-semibold text-lg">Link inválido</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Este link foi revogado ou nunca existiu.
        </p>
      </div>
    );
  }

  if (isLoadingWidgets || !widgetsData) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {["a", "b", "c", "d"].map((key) => (
            <Skeleton key={key} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const widgets = (widgetsData.widgets ?? []) as OrgWidgetSummary[];
  const values = (valuesData?.values ?? []) as OrgWidgetValueEntry[];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div>
        <h1 className="font-semibold text-2xl">{widgetsData.title}</h1>
        <p className="text-muted-foreground text-sm">
          Prévia pública — atualizada a cada 5 min.
        </p>
      </div>
      <OrgDashboardView
        widgets={widgets}
        values={values}
        isLoading={isLoadingValues && values.length === 0}
        emptyState={
          <div className="rounded-md border border-dashed py-14 text-center text-muted-foreground text-sm">
            O administrador ainda não expôs nenhum widget publicamente.
          </div>
        }
      />
    </div>
  );
}
