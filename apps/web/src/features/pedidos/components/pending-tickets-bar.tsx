"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currencyFormatter } from "@/utils/currency-formatter";
import { BellRing, Check, Clock, Phone, X } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  useMutationAcceptTicket,
  useMutationRejectTicket,
  useQueryPendingTickets,
} from "../hooks/use-pedidos";

/**
 * Barra "Novos pedidos", acima do kanban.
 *
 * Não virou coluna do board de propósito: o board renderiza a primeira coluna
 * como a coluna grande da esquerda, então inserir uma coluna na posição 0
 * mudaria o leiaute de toda organização que ligasse o cardápio. Aqui o impacto
 * é zero para quem não usa — sem pedido pendente, o componente não desenha nada.
 */
export function PendingTicketsBar() {
  const { data: tickets } = useQueryPendingTickets();
  const aceitar = useMutationAcceptTicket();
  const recusar = useMutationRejectTicket();
  const quantidadeAnterior = useRef(0);

  const quantidade = tickets?.length ?? 0;

  // Vibra quando um pedido NOVO entra. O dono está com as mãos ocupadas e o
  // celular no balcão; olhar a tela a cada minuto não é opção.
  useEffect(() => {
    if (
      quantidade > quantidadeAnterior.current &&
      quantidadeAnterior.current >= 0
    ) {
      if (quantidade > 0) navigator.vibrate?.([200, 100, 200]);
    }
    quantidadeAnterior.current = quantidade;
  }, [quantidade]);

  if (!tickets || tickets.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2">
        <BellRing className="size-5 animate-pulse text-amber-600" />
        <p className="text-lg font-semibold">
          {quantidade === 1 ? "1 novo pedido" : `${quantidade} novos pedidos`}
        </p>
        <Badge variant="secondary">aguardando você aceitar</Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tickets.map((ticket) => {
          const emAndamento =
            (aceitar.isPending &&
              aceitar.variables?.ticketId === ticket.ticketId) ||
            (recusar.isPending &&
              recusar.variables?.ticketId === ticket.ticketId);

          return (
            <div
              key={ticket.ticketId}
              className="flex flex-col gap-3 rounded-lg border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {ticket.customerName ?? ticket.tableNumber}
                  </p>
                  {ticket.customerPhone && (
                    <a
                      href={`https://wa.me/55${ticket.customerPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                    >
                      <Phone className="size-3.5" />
                      {ticket.customerPhone}
                    </a>
                  )}
                </div>
                {ticket.total != null && (
                  <span className="whitespace-nowrap text-lg font-semibold">
                    R$ {currencyFormatter(ticket.total).trim()}
                  </span>
                )}
              </div>

              <ul className="flex flex-col gap-1 text-sm">
                {ticket.items.map((item) => (
                  <li key={item.id}>
                    <span>{item.dishName}</span>
                    {item.notes && (
                      <span className="block pl-3 text-muted-foreground">
                        » {item.notes}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {ticket.saleNotes && (
                <p className="flex items-start gap-1 text-sm text-muted-foreground">
                  <Clock className="mt-0.5 size-3.5 shrink-0" />
                  {ticket.saleNotes}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={emAndamento}
                  onClick={() => aceitar.mutate({ ticketId: ticket.ticketId })}
                >
                  <Check className="size-5" />
                  Aceitar
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={emAndamento}
                  onClick={() => recusar.mutate({ ticketId: ticket.ticketId })}
                  aria-label="Recusar pedido"
                >
                  <X className="size-5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
