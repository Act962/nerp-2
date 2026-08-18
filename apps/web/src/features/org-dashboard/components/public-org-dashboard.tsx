"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { Building } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  OrgDashboardView,
  type OrgPanelSummary,
  type OrgWidgetSummary,
  type OrgWidgetValueEntry,
} from "./org-dashboard-view";
import type { BoardSummary } from "./board-tabs";

const POLL_INTERVAL_MS = 5 * 60_000;

function PublicOrgLogo({
  logo,
  name,
}: {
  logo: string | null | undefined;
  name: string;
}) {
  const url = logo ? constructUrl(logo) : "";
  const [broken, setBroken] = useState(false);
  if (!url || broken)
    return <Building className="size-5 text-muted-foreground" />;
  return (
    <Image
      src={url}
      alt={name}
      width={28}
      height={28}
      className="rounded-md"
      onError={() => setBroken(true)}
    />
  );
}

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
  const panels = ((widgetsData as Record<string, unknown>).panels ??
    []) as OrgPanelSummary[];
  const boards = ((widgetsData as Record<string, unknown>).boards ??
    []) as BoardSummary[];
  const orgName = (widgetsData as Record<string, unknown>).orgName as
    | string
    | undefined;
  const orgLogo = (widgetsData as Record<string, unknown>).orgLogo as
    | string
    | null
    | undefined;
  const values = (valuesData?.values ?? []) as OrgWidgetValueEntry[];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Image
          src="/orbita-hub.svg"
          alt="Orbita"
          width={100}
          height={28}
          className="h-7 w-auto"
        />
        <PublicOrgLogo logo={orgLogo} name={orgName ?? "Org"} />
      </div>
      <OrgDashboardView
        widgets={widgets}
        panels={panels}
        boards={boards}
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
