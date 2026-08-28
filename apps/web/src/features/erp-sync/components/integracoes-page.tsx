"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Database,
  FileText,
  HardDrive,
  PackagePlus,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FiscalConfigPanel } from "@/features/fiscal-config/components/fiscal-config-panel";
import { GoogleDriveCard } from "@/features/google-drive/components/google-drive-card";
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

const nf = new Intl.NumberFormat("pt-BR");

interface ProductSyncReportView {
  at: string;
  dryRun: boolean;
  read: number;
  updated: number;
  created: number;
  createSkipped: number;
  skippedNoBarcode: number;
  skippedInvalidBarcode: number;
  duplicatesInSource: number;
  failed: number;
}

/**
 * Cadastro de produtos do ERP.
 *
 * Separado das vendas porque a decisão é outra: atualizar status é rotina e roda
 * sozinho; trazer produto que só existe no ERP é irreversível na prática e
 * precisa de alguém olhando o número antes. Daí a simulação vir primeiro.
 */
function ProductSyncSection({
  report,
  busy,
  onSimulate,
  onBackfill,
}: {
  report: ProductSyncReportView | null;
  busy: boolean;
  onSimulate: () => void;
  onBackfill: () => void;
}) {
  const stats: { label: string; value: number; hint?: string }[] = report
    ? [
        { label: "Lidos no ERP", value: report.read },
        { label: "Status atualizado", value: report.updated },
        {
          label: report.dryRun ? "Seriam criados" : "Criados",
          value: report.created,
        },
      ]
    : [];
  if (report) {
    if (report.createSkipped > 0)
      stats.push({
        label: "Não criados",
        value: report.createSkipped,
        hint: "só existem no ERP; a criação estava desligada nesta passada",
      });
    if (report.skippedNoBarcode > 0)
      stats.push({
        label: "Sem código de barras",
        value: report.skippedNoBarcode,
        hint: "sem código não há como casar nem criar com segurança",
      });
    if (report.skippedInvalidBarcode > 0)
      stats.push({
        label: "Com código interno",
        value: report.skippedInvalidBarcode,
        hint: "o ERP repete o código do produto no campo do código de barras",
      });
    if (report.duplicatesInSource > 0)
      stats.push({
        label: "Repetidos na origem",
        value: report.duplicatesInSource,
      });
    if (report.failed > 0)
      stats.push({ label: "Falhas", value: report.failed });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium text-sm">Cadastro de produtos</h3>
        <p className="text-muted-foreground text-sm">
          A passada diária atualiza o status de quem já está cadastrado aqui.
          Trazer os que só existem no ERP é uma decisão à parte — simule antes
          para ver o tamanho.
        </p>
      </div>

      {report && (
        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                report.dryRun
                  ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                  : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              }
            >
              {report.dryRun ? "Simulação — nada gravado" : "Gravado"}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(report.at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">{stat.label}</dt>
                <dd className="font-medium tabular-nums">
                  {nf.format(stat.value)}
                </dd>
                {stat.hint && (
                  <p className="text-muted-foreground text-xs">{stat.hint}</p>
                )}
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={onSimulate}
        >
          <FileText className="size-4" />
          Simular
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={onBackfill}
        >
          <PackagePlus className="size-4" />
          Trazer os que faltam
        </Button>
      </div>
    </div>
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
          Conexões externas do sistema — ERP, emissão fiscal e demais serviços.
        </p>
      </div>

      <Tabs defaultValue="erp" className="max-w-4xl">
        <TabsList>
          <TabsTrigger value="erp" className="gap-1">
            <Database className="size-4" />
            ERP
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-1">
            <FileText className="size-4" />
            Fiscal (NFCe)
          </TabsTrigger>
          <TabsTrigger value="drive" className="gap-1">
            <HardDrive className="size-4" />
            Google Drive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="erp" className="mt-4">
          <Card>
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
                          status?.configured &&
                            status.isSyncing &&
                            "animate-spin",
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

                  <Separator />

                  <ProductSyncSection
                    report={status?.configured ? status.productSync : null}
                    busy={
                      runSync.isPending ||
                      isPaused ||
                      Boolean(status?.configured && status.isSyncing)
                    }
                    onSimulate={() =>
                      runSync.mutate({
                        dryRunProducts: true,
                        createProducts: true,
                      })
                    }
                    onBackfill={() => {
                      if (
                        window.confirm(
                          "Trazer para o cadastro os produtos que só existem no ERP?\n\nIsso cria produtos de verdade e não tem desfazer em massa. Simule antes e confira o número.",
                        )
                      ) {
                        runSync.mutate({ createProducts: true });
                      }
                    }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiscal" className="mt-4">
          <FiscalConfigPanel />
        </TabsContent>

        <TabsContent value="drive" className="mt-4">
          <GoogleDriveCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
