"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { orpc } from "@/lib/orpc";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Phone } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const POLL_MS = 5000;

/**
 * Pedidos do cardápio esperando liberação, na mão de quem está no salão.
 *
 * Existe porque o gerente não fica olhando o board: quando o aviso de pagamento
 * demora ou não chega, o pedido trava e o cliente espera por alguém que não
 * está na tela. Qualquer pessoa da equipe com o app aberto resolve.
 *
 * O selo de pagamento é o que decide: **pago** é só apertar; **aguardando** é
 * decisão de quem está vendo o cliente, e por isso a cor é outra e o botão diz
 * o que está fazendo.
 */
export function PedidosALiberar({
  orgSlug,
  attendantId,
}: {
  orgSlug: string;
  attendantId: string;
}) {
  const queryClient = useQueryClient();
  const { data: tickets } = useQuery(
    orpc.kitchen.waiterPendingTickets.queryOptions({
      input: { orgSlug },
      refetchInterval: POLL_MS,
    }),
  );

  const aceitar = useMutation(
    orpc.kitchen.waiterAcceptTicket.mutationOptions({
      onSuccess: () => {
        toast.success("Pedido liberado para a cozinha!");
        queryClient.invalidateQueries({
          queryKey: orpc.kitchen.waiterPendingTickets.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.mesa.listForWaiter.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const quantidade = tickets?.length ?? 0;
  const anterior = useRef(0);

  // Vibra quando entra pedido novo: o celular está no bolso entre uma mesa e
  // outra, e ninguém fica olhando a tela à espera.
  useEffect(() => {
    if (quantidade > anterior.current && quantidade > 0) {
      navigator.vibrate?.([200, 100, 200]);
    }
    anterior.current = quantidade;
  }, [quantidade]);

  if (!tickets || tickets.length === 0) return null;

  return (
    <Card className="mx-3 border-amber-500/50 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2">
        <BellRing className="size-5 animate-pulse text-amber-600" />
        <p className="font-semibold">
          {quantidade === 1
            ? "1 pedido a liberar"
            : `${quantidade} pedidos a liberar`}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {tickets.map((ticket) => {
          const emAndamento =
            aceitar.isPending &&
            aceitar.variables?.ticketId === ticket.ticketId;

          return (
            <div
              key={ticket.ticketId}
              className="flex flex-col gap-2 rounded-lg border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {ticket.customerName ?? ticket.tableNumber}
                  </p>
                  {ticket.customerPhone && (
                    <a
                      href={`https://wa.me/55${ticket.customerPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm text-muted-foreground"
                    >
                      <Phone className="size-3.5" />
                      {ticket.customerPhone}
                    </a>
                  )}
                </div>
                {ticket.total != null && (
                  <span className="whitespace-nowrap text-lg font-bold">
                    R$ {currencyFormatter(ticket.total).trim()}
                  </span>
                )}
              </div>

              {ticket.pagamento && (
                <Badge
                  className={
                    ticket.pago
                      ? "w-fit bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                      : "w-fit bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                  }
                >
                  {ticket.pagamento}
                </Badge>
              )}

              <ul className="flex flex-col gap-1 text-sm">
                {ticket.items.map((item) => (
                  <li key={item.id}>
                    {item.dishName}
                    {item.notes && (
                      <span className="block pl-3 text-muted-foreground">
                        » {item.notes}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {ticket.saleNotes && (
                <p className="text-sm text-muted-foreground">
                  {ticket.saleNotes}
                </p>
              )}

              <Button
                size="lg"
                className="h-12 w-full"
                disabled={emAndamento}
                onClick={() =>
                  aceitar.mutate({
                    orgSlug,
                    ticketId: ticket.ticketId,
                    attendantId,
                  })
                }
              >
                <Check className="size-5" />
                {ticket.pago
                  ? "Mandar para a cozinha"
                  : "Liberar mesmo sem pagamento"}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
