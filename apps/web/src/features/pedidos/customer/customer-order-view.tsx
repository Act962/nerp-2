"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCheck,
  ChefHat,
  Loader2,
  PartyPopper,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";

const POLL_MS = 3000;

interface Props {
  orderId: string;
}

export function CustomerOrderView({ orderId }: Props) {
  const { data, isLoading, isError } = useQuery(
    orpc.kitchen.publicCustomerOrder.queryOptions({
      input: { orderId },
      refetchInterval: POLL_MS,
    }),
  );

  const wasReady = useRef(false);

  // Vibração e som ao transicionar para pronto pela primeira vez. Garante que
  // só dispara uma vez (não a cada poll) — guardamos o estado anterior em ref.
  useEffect(() => {
    if (!data?.isReady) {
      wasReady.current = false;
      return;
    }
    if (wasReady.current) return;
    wasReady.current = true;
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate([400, 120, 400, 120, 400]);
    }
  }, [data?.isReady]);

  // Quando o pedido é marcado como entregue, redireciona para o cardápio
  // online da org (subdomínio do storefront) após um respiro de 3s — dá tempo
  // do cliente ler "Pedido entregue / Obrigado". Roda só no client.
  useEffect(() => {
    if (!data?.isDone || !data.orgSlug) return;
    const baseDomain =
      process.env.NEXT_PUBLIC_BASE_DOMAIN ??
      (typeof window !== "undefined" ? window.location.host : "");
    if (!baseDomain) return;
    const protocol =
      typeof window !== "undefined" ? window.location.protocol : "http:";
    const target = `${protocol}//${data.orgSlug}.${baseDomain}`;
    const id = window.setTimeout(() => {
      window.location.assign(target);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [data?.isDone, data?.orgSlug]);

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
        <TriangleAlert className="size-10 text-amber-500" />
        <p className="text-base font-semibold">Pedido não encontrado</p>
        <p className="text-sm text-muted-foreground">
          Confira o QR code com o atendente.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-1 flex-col px-6 pb-10 pt-8 text-center transition-colors duration-500",
        data.isReady && "animate-ready-flash",
      )}
    >
      <header className="mb-6">
        <p
          className={cn(
            "text-sm uppercase tracking-widest opacity-80",
            !data.isReady && "text-muted-foreground",
          )}
        >
          Acompanhe seu pedido
        </p>
        <h1 className="mt-1 text-4xl font-bold sm:text-5xl">
          Mesa {data.tableNumber}
        </h1>
      </header>

      <section
        className={cn(
          "mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 rounded-3xl border p-6 shadow-sm",
          data.isReady
            ? "border-current/30 bg-transparent"
            : "border-border bg-card",
        )}
      >
        <p className="text-2xl font-semibold sm:text-3xl">{data.dishName}</p>
        {data.notes && (
          <p
            className={cn(
              "text-sm",
              data.isReady ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {data.notes}
          </p>
        )}

        <div className="flex flex-col items-center gap-2">
          {data.isReady ? (
            <>
              <PartyPopper className="size-16" />
              <p className="text-3xl font-bold sm:text-4xl">
                Seu pedido está pronto!
              </p>
              <p className="text-base opacity-80">
                Retire no balcão ou chame o atendente.
              </p>
            </>
          ) : data.isDone ? (
            <>
              <CheckCheck className="size-12 text-muted-foreground" />
              <p className="text-xl font-semibold">Pedido entregue</p>
              <p className="text-sm text-muted-foreground">
                Obrigado pela preferência!
              </p>
            </>
          ) : (
            <>
              <ChefHat className="size-12 text-amber-500" />
              <p className="text-xl font-semibold">{data.columnName}</p>
              <p className="text-sm text-muted-foreground">
                Seu pedido está sendo preparado.
              </p>
            </>
          )}
        </div>

      </section>

      {data.attendantName && (
        <div
          className={cn(
            "mt-6 flex items-center justify-center gap-2 text-sm",
            data.isReady ? "opacity-80" : "text-muted-foreground",
          )}
        >
          <Avatar className="size-6">
            {data.attendantPhoto && (
              <AvatarImage
                src={constructUrl(data.attendantPhoto)}
                alt={data.attendantName}
              />
            )}
            <AvatarFallback className="text-[10px]">
              {data.attendantName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>Atendido por {data.attendantName}</span>
        </div>
      )}

      <footer
        className={cn(
          "mt-10 flex flex-col items-center gap-1 text-xs",
          data.isReady ? "opacity-80" : "text-muted-foreground",
        )}
      >
        <Image
          src="/logo.png"
          alt="NASA"
          width={120}
          height={40}
          className="h-8 w-auto"
          priority
        />
        <a
          href="https://www.orbita.nasaex.com"
          target="_blank"
          rel="noreferrer noopener"
          className="hover:underline"
        >
          www.orbita.nasaex.com
        </a>
      </footer>
    </div>
  );
}
