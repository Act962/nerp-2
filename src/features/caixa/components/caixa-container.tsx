"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { cn } from "@/lib/utils";
import { memberCan } from "@/lib/permissions";
import { CaixaStatusBadge } from "./caixa-status-badge";
import { CashMovementDialog } from "./cash-movement-dialog";
import { CloseCaixaDialog } from "./close-caixa-dialog";
import { OpenCaixaDialog } from "./open-caixa-dialog";
import {
  formatBRL,
  useCaixaCurrent,
  useCaixaSessions,
} from "../hooks/use-caixa";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function CaixaContainer() {
  const { session, isLoading } = useCaixaCurrent();
  const { member } = useCurrentMember();
  const { sessions, isLoading: loadingHistory } = useCaixaSessions();

  const canOpen = memberCan(member, "caixa-abrir");
  const canClose = memberCan(member, "caixa-fechar");
  const canSangria = memberCan(member, "caixa-sangria");
  const canSuprimento = memberCan(member, "caixa-suprimento");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Caixa</h1>
        <CaixaStatusBadge open={!!session} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : session ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Sessão aberta às {formatDateTime(session.openedAt)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <SummaryRow
                label="Fundo de abertura"
                value={formatBRL(session.openingBalance)}
              />
              <SummaryRow
                label="Vendas (total)"
                value={formatBRL(session.salesTotal)}
              />
              <SummaryRow
                label="Vendas em dinheiro"
                value={formatBRL(session.salesCash)}
              />
              <SummaryRow
                label="Suprimentos"
                value={formatBRL(session.suprimentos)}
              />
              <SummaryRow
                label="Sangrias"
                value={formatBRL(session.sangrias)}
              />
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="font-medium">Esperado em dinheiro</span>
                <span className="font-semibold tabular-nums">
                  {formatBRL(session.expectedCash)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canSuprimento && <CashMovementDialog kind="SUPRIMENTO" />}
              {canSangria && <CashMovementDialog kind="SANGRIA" />}
              {canClose && <CloseCaixaDialog />}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhum caixa aberto</EmptyTitle>
            <EmptyDescription>
              {canOpen
                ? "Abra o caixa para começar a vender."
                : "Peça a um responsável com permissão para abrir o caixa."}
            </EmptyDescription>
          </EmptyHeader>
          {canOpen && (
            <div className="flex justify-center">
              <OpenCaixaDialog />
            </div>
          )}
        </Empty>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Histórico de sessões</h2>
        {loadingHistory ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma sessão registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Fechamento</TableHead>
                  <TableHead className="text-right">Fundo</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.operatorName}
                    </TableCell>
                    <TableCell>{formatDateTime(item.openedAt)}</TableCell>
                    <TableCell>
                      {item.closedAt ? formatDateTime(item.closedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(item.openingBalance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.expectedBalance === null
                        ? "—"
                        : formatBRL(item.expectedBalance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.countedBalance === null
                        ? "—"
                        : formatBRL(item.countedBalance)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        item.difference !== null &&
                          item.difference !== 0 &&
                          "text-destructive",
                      )}
                    >
                      {item.difference === null
                        ? "—"
                        : formatBRL(item.difference)}
                    </TableCell>
                    <TableCell>
                      <CaixaStatusBadge open={item.status === "OPEN"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
