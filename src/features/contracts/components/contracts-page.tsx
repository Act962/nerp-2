"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ContractStatus } from "@/generated/prisma/enums";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import {
  useCancelContract,
  useContracts,
  useExpireContracts,
} from "../hooks/use-contracts";
import { NewContractDialog } from "./new-contract-dialog";

const STATUS_LABEL: Record<ContractStatus, string> = {
  ATIVO: "Ativo",
  EXPIRADO: "Expirado",
  CANCELADO: "Cancelado",
  RENOVADO: "Renovado",
  SUSPENSO: "Suspenso",
};

function statusVariant(
  status: ContractStatus | null,
): "default" | "secondary" | "outline" {
  if (status === "ATIVO") return "default";
  if (status === "CANCELADO" || status === "EXPIRADO") return "outline";
  return "secondary";
}

function money(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function day(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function ContractsPage() {
  const { data, isPending } = useContracts();
  const cancel = useCancelContract();
  const expire = useExpireContracts();
  const [open, setOpen] = useState(false);

  const contracts = data?.contracts ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => expire.mutate(undefined)}
          disabled={expire.isPending}
        >
          <RefreshCwIcon className="size-4" />
          Expirar vencidos
        </Button>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" />
          Novo contrato
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Espaço</TableHead>
              <TableHead>Indústria</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Cobrança</TableHead>
              <TableHead>Recebíveis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhum contrato ainda. Clique em "Novo contrato".
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.spaceCode ?? c.spaceName ?? "—"}
                  </TableCell>
                  <TableCell>{c.supplierName ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {day(c.startDate)} – {day(c.endDate)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {money(c.amount)}
                    {c.billing === "MENSAL" ? "/mês" : ""}
                  </TableCell>
                  <TableCell>
                    {c.billing === "MENSAL"
                      ? "Mensal"
                      : c.billing === "UNICO"
                        ? "Único"
                        : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {c.entriesCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.contractStatus)}>
                      {c.contractStatus ? STATUS_LABEL[c.contractStatus] : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {c.contractStatus === "ATIVO" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancel.mutate({ negotiationId: c.id })}
                        disabled={cancel.isPending}
                      >
                        Rescindir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NewContractDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
