"use client";

import { AlertTriangle, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useErpSyncStatus, useRunErpSync } from "../hooks/use-erp-sync";

// Tempo curto de propósito. O `formatDistanceToNow` do date-fns rende frases
// como "há menos de um minuto", que numa toolbar apertada quebram em quatro
// linhas e desmontam a barra inteira.
function compactAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

// Diz de onde veio o número e quando. Sem isso um sync quebrado é invisível: o
// board continua mostrando o último valor sincronizado como se fosse de agora.
export function ErpSyncBadge({ canEdit = false }: { canEdit?: boolean }) {
  const statusQuery = useErpSyncStatus();
  const runSync = useRunErpSync();

  const status = statusQuery.data;
  // Organização sem ERP externo não tem o que mostrar — o vendido vem das
  // vendas do próprio NERP.
  if (!status?.configured) return null;

  const failed = status.status === "ERROR" || status.isStuck;
  const paused = status.status === "PAUSED";

  const label = status.isSyncing
    ? "Sincronizando"
    : paused
      ? "Pausado"
      : status.isStuck
        ? "Travado"
        : failed
          ? "Falhou"
          : status.lastSyncAt
            ? `ERP ${compactAgo(status.lastSyncAt)}`
            : "Sem sync";

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap",
              "rounded-md border px-2.5 text-xs",
              failed
                ? "border-destructive/40 text-destructive"
                : "border-input text-muted-foreground",
            )}
          >
            {failed ? (
              <AlertTriangle className="size-3.5 shrink-0" />
            ) : (
              <Database
                className={cn(
                  "size-3.5 shrink-0",
                  status.isSyncing && "animate-pulse",
                )}
              />
            )}
            {/* Em tela estreita sobra só o ícone; o texto vive no tooltip. */}
            <span className="hidden sm:inline">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-xs">
            Vendido sincronizado do ERP, não digitado à mão.
          </p>
          <p className="mt-1 text-xs">
            {status.activeSellers} vendedores ativos · {status.factRows}{" "}
            registros de venda espelhados
            {status.lastFactDate ? ` · até ${status.lastFactDate}` : ""}
          </p>
          {status.lastSyncError && (
            <p className="mt-1 text-xs break-words">{status.lastSyncError}</p>
          )}
          {status.isStuck && (
            <p className="mt-1 text-xs">
              A última sincronização começou e não terminou. Tente novamente.
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      {canEdit && !paused && (
        <Button
          variant="outline"
          size="icon-sm"
          title="Sincronizar com o ERP agora"
          disabled={status.isSyncing || runSync.isPending}
          onClick={() => runSync.mutate({})}
        >
          <RefreshCw
            className={cn(
              "size-4",
              (status.isSyncing || runSync.isPending) && "animate-spin",
            )}
          />
          <span className="sr-only">Sincronizar com o ERP agora</span>
        </Button>
      )}
    </div>
  );
}
