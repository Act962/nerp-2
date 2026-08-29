"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  useApplyInventoryCount,
  useCancelInventoryCount,
  useInventoryCount,
} from "../hooks/use-inventory";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function InventoryDetail({ id }: { id: string }) {
  const { data, isPending } = useInventoryCount(id);
  const apply = useApplyInventoryCount();
  const cancel = useCancelInventoryCount();

  if (isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner />
      </div>
    );
  }
  if (!data) return null;

  const { count, items, summary } = data;
  const aberta = count.status === "OPEN";
  // Enquanto a contagem está aberta E cega, o servidor não devolve os números
  // do sistema — não há relatório a mostrar sem encerrar a cegueira.
  const oculto = summary === null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{count.name}</h2>
          {count.blind && <Badge variant="outline">cega</Badge>}
          <Badge variant={aberta ? "secondary" : "outline"}>
            {aberta
              ? "Em contagem"
              : count.status === "APPLIED"
                ? "Aplicada"
                : "Descartada"}
          </Badge>
        </div>
        {aberta && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => cancel.mutate({ id })}
              disabled={cancel.isPending || apply.isPending}
            >
              <XCircle className="size-4" />
              Descartar
            </Button>
            <Button
              onClick={() => apply.mutate({ id })}
              disabled={apply.isPending || items.length === 0}
            >
              {apply.isPending ? (
                <Spinner />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Aplicar ao estoque
            </Button>
          </div>
        )}
      </div>

      {oculto ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="font-medium">{items.length} produto(s) contado(s)</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Esta contagem é cega: as divergências só aparecem depois de
              aplicar. É isso que evita conferir a contagem contra o sistema
              enquanto ainda dá para "ajustar" o que foi contado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Contados" value={summary.counted} />
            <Metric label="Divergentes" value={summary.divergent} />
            <Metric label="Sobras" value={summary.positive} />
            <Metric label="Faltas" value={summary.negative} />
            <Metric
              label="Líquido (un.)"
              value={
                summary.netUnits > 0 ? `+${summary.netUnits}` : summary.netUnits
              }
            />
          </div>

          {summary.drifted > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span>
                {summary.drifted} produto(s) tiveram movimento depois de
                contados. O ajuste aplica a <strong>diferença observada</strong>{" "}
                sobre o saldo atual, então a venda que aconteceu no meio não é
                desfeita.
              </span>
            </div>
          )}
        </>
      )}

      <div className="rounded-lg border">
        <Table stacked>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Contado</TableHead>
              {!oculto && <TableHead className="text-right">Sistema</TableHead>}
              {!oculto && (
                <TableHead className="text-right">Divergência</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={oculto ? 2 : 4}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhum produto contado ainda.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell data-label="Produto" className="font-medium">
                    {item.productName}
                    {item.driftedSinceCount && (
                      <Badge variant="outline" className="ml-2">
                        mexeu depois
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    data-label="Contado"
                    className="text-right tabular-nums"
                  >
                    {item.countedQuantity}
                  </TableCell>
                  {!oculto && (
                    <TableCell
                      data-label="Sistema"
                      className="text-right tabular-nums text-muted-foreground"
                    >
                      {item.systemQuantity}
                    </TableCell>
                  )}
                  {!oculto && (
                    <TableCell
                      data-label="Divergência"
                      className={cn(
                        "text-right font-medium tabular-nums",
                        (item.divergence ?? 0) > 0 &&
                          "text-emerald-600 dark:text-emerald-400",
                        (item.divergence ?? 0) < 0 &&
                          "text-red-600 dark:text-red-400",
                      )}
                    >
                      {(item.divergence ?? 0) > 0 ? "+" : ""}
                      {item.divergence}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
