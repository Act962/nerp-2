"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Database,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useErpConnection,
  useErpSyncStatus,
  usePauseErpConnection,
  useRemoveErpConnection,
  useRunErpSync,
} from "../hooks/use-erp-sync";
import { WinthorConnectionForm } from "./winthor-connection-form";

function StatusBadge({
  status,
}: {
  status: "ACTIVE" | "PAUSED" | "ERROR" | string;
}) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: {
      label: "Ativa",
      className: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
    },
    PAUSED: {
      label: "Pausada",
      className: "border-muted text-muted-foreground",
    },
    ERROR: {
      label: "Com erro",
      className: "border-destructive/40 text-destructive",
    },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

export function IntegracoesPage() {
  const connectionQuery = useErpConnection();
  const statusQuery = useErpSyncStatus();
  const runSync = useRunErpSync();
  const pause = usePauseErpConnection();
  const remove = useRemoveErpConnection();

  const connection = connectionQuery.data;
  const status = statusQuery.data;
  const configured = connection?.configured === true;
  const isPaused =
    connection?.configured === true && connection.status === "PAUSED";

  const lastSync =
    status?.configured && status.lastSyncAt
      ? formatDistanceToNow(new Date(status.lastSyncAt), {
          locale: ptBR,
          addSuffix: true,
        })
      : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-sm text-muted-foreground">
          Conecte o ERP do cliente para alimentar o ranking e os indicadores com
          venda real — em vez de digitar à mão.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                <Database className="size-5" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Winthor (TOTVS) · Oracle
                  {configured && <StatusBadge status={connection.status} />}
                </CardTitle>
                <CardDescription>
                  Leitura direta do banco do ERP (somente SELECT). As
                  credenciais são cifradas antes de salvar.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Linha de status quando já configurado */}
          {configured && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {lastSync
                  ? `Sincronizado ${lastSync}`
                  : "Ainda não sincronizado"}
              </span>
              {status?.configured && (
                <span className="text-muted-foreground">
                  · {status.activeSellers} vendedores · {status.factRows}{" "}
                  registros
                </span>
              )}
              {status?.configured && status.lastSyncError && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="size-3.5" />
                  {status.lastSyncError}
                </span>
              )}
            </div>
          )}

          <WinthorConnectionForm />

          {configured && (
            <>
              <Separator />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={
                    runSync.isPending ||
                    isPaused ||
                    (status?.configured && status.isSyncing)
                  }
                  onClick={() => runSync.mutate({})}
                >
                  <RefreshCw
                    className={cn(
                      "size-4",
                      status?.configured && status.isSyncing && "animate-spin",
                    )}
                  />
                  Sincronizar agora
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={pause.isPending}
                  onClick={() => pause.mutate({ paused: !isPaused })}
                >
                  {isPaused ? (
                    <Play className="size-4" />
                  ) : (
                    <Pause className="size-4" />
                  )}
                  {isPaused ? "Retomar" : "Pausar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2 text-destructive hover:text-destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remover a conexão? As credenciais serão apagadas. O histórico já sincronizado é mantido.",
                      )
                    ) {
                      remove.mutate({});
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  Remover
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
