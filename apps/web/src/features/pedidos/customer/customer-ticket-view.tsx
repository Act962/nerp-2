"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCheck,
  ChefHat,
  Clock,
  Hourglass,
  Loader2,
  PartyPopper,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const POLL_MS = 3000;

/**
 * Acompanhamento do PEDIDO INTEIRO no celular do cliente.
 *
 * A tela por item (`customer-order-view.tsx`) continua existindo: há QR já
 * impresso apontando para ela, e quebrar um papel que já está na mão do cliente
 * não é uma opção. Esta é a que o cupom novo aponta.
 */
export function CustomerTicketView({ ticketId }: { ticketId: string }) {
  const { data, isLoading, isError } = useQuery(
    orpc.kitchen.publicTicketOrder.queryOptions({
      input: { ticketId },
      refetchInterval: POLL_MS,
    }),
  );

  const jaAvisou = useRef(false);
  const [agora, setAgora] = useState(() => Date.now());

  // Um tique por segundo só enquanto há o que contar.
  useEffect(() => {
    if (!data || data.isDone) return;
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [data]);

  useEffect(() => {
    if (!data?.isReady) {
      jaAvisou.current = false;
      return;
    }
    if (jaAvisou.current) return;
    jaAvisou.current = true;
    navigator.vibrate?.([400, 120, 400, 120, 400]);
  }, [data?.isReady]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <span>Carregando pedido…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <TriangleAlert className="size-10 text-muted-foreground" />
        <p className="text-lg font-medium">Pedido não encontrado</p>
        <p className="text-muted-foreground">
          Confira o QR code do seu cupom ou chame o atendente.
        </p>
      </div>
    );
  }

  const restante = tempoRestante(data.startedAt, data.estimatedMinutes, agora);

  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-6 px-5 py-8",
        data.isReady && "animate-ready-flash",
      )}
    >
      <header className="text-center">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          {data.orgName}
        </p>
        <h1 className="text-3xl font-bold">{data.tableNumber}</h1>
      </header>

      <section className="flex flex-col items-center gap-3 text-center">
        {data.isDone ? (
          <>
            <CheckCheck className="size-16 text-emerald-500" />
            <p className="text-2xl font-semibold">Pedido entregue</p>
            <p className="text-muted-foreground">Bom apetite!</p>
          </>
        ) : data.isReady ? (
          <>
            <PartyPopper className="size-16 text-emerald-500" />
            <p className="text-3xl font-bold">Seu pedido está pronto!</p>
            <p className="text-muted-foreground">Pode vir buscar.</p>
          </>
        ) : data.isWaitingAcceptance ? (
          <>
            <Hourglass className="size-16 animate-pulse text-amber-500" />
            <p className="text-2xl font-semibold">Aguardando confirmação</p>
            <p className="text-muted-foreground">
              A loja está conferindo seu pedido.
            </p>
          </>
        ) : (
          <>
            <ChefHat className="size-16 animate-pulse text-amber-500" />
            <p className="text-2xl font-semibold">Em preparo</p>
            {restante && (
              <p className="flex items-center gap-2 text-lg text-muted-foreground">
                <Clock className="size-5" />
                {restante}
              </p>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border p-4">
        {data.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{item.dishName}</p>
              {item.notes && (
                <p className="text-sm text-muted-foreground">» {item.notes}</p>
              )}
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: item.columnColor }}
            >
              {item.columnName}
            </span>
          </div>
        ))}

        {data.total != null && (
          <div className="mt-2 flex items-center justify-between border-t pt-3 text-lg font-semibold">
            <span>Total</span>
            <span>R$ {currencyFormatter(data.total).trim()}</span>
          </div>
        )}
      </section>

      {data.attendantName && (
        <footer className="flex items-center justify-center gap-3 text-muted-foreground">
          <Avatar className="size-9">
            {data.attendantPhoto && (
              <AvatarImage src={constructUrl(data.attendantPhoto)} alt="" />
            )}
            <AvatarFallback>{data.attendantName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <span>Atendimento: {data.attendantName}</span>
        </footer>
      )}
    </div>
  );
}

/**
 * Quanto falta, em texto humano.
 *
 * Passou do tempo estimado? Não vira número negativo nem "atrasado": o cliente
 * que lê "-3 min" na fila não fica mais calmo, fica mais irritado.
 */
function tempoRestante(
  startedAt: string | null,
  estimatedMinutes: number | null,
  agora: number,
): string | null {
  if (!startedAt || !estimatedMinutes) return null;

  const fim = new Date(startedAt).getTime() + estimatedMinutes * 60_000;
  const faltam = Math.ceil((fim - agora) / 60_000);

  if (faltam <= 0) return "Saindo a qualquer momento";
  if (faltam === 1) return "Cerca de 1 minuto";
  return `Cerca de ${faltam} minutos`;
}
