"use client";

import { Bell, Megaphone, RefreshCw, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { useInicioFv, useNaoLidasFv } from "../hooks/use-forca-vendas";
import { AMBIENTES } from "../lib/ambientes";
import { formatBRL } from "../lib/formatar";
import { AvisoDialog } from "./aviso-dialog";

export function InicioForcaVendas() {
  const { data, isPending, refetch, isFetching } = useInicioFv();
  const { data: naoLidas } = useNaoLidasFv();
  const [avisoAberto, setAvisoAberto] = useState(false);

  if (isPending || !data) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-3 gap-3">
          {AMBIENTES.map((ambiente) => (
            <Skeleton key={ambiente.chave} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const destaque = data.avisoDestaque;
  // Urgente não espera clique: abre sozinho e só fecha com "Li e entendi".
  const urgente = destaque?.prioridade === "URGENTE";
  const progresso = data.meta
    ? Math.min(100, (data.vendidoMes / data.meta) * 100)
    : null;
  const badges: Record<string, number> = {
    mensagens: naoLidas?.total ?? 0,
    avisos: data.avisosPendentes,
    pedidos: data.pedidosAguardando,
  };
  const inicial = data.nome.trim().slice(0, 1).toUpperCase() || "V";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-full border bg-muted">
            {data.imagem ? (
              // biome-ignore lint/performance/noImgElement: avatar de URL do R2
              <img
                src={data.imagem}
                alt={data.nome}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
                {inicial}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              Olá, {data.nome.split(" ")[0]}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {data.organizacao.logo ? (
                // biome-ignore lint/performance/noImgElement: logo da org vinda do R2
                <img
                  src={constructUrl(data.organizacao.logo)}
                  alt=""
                  className="size-4 rounded-full object-cover"
                />
              ) : null}
              {data.organizacao.nome}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Atualizar"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("size-5", isFetching && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/forca-de-vendas/avisos" aria-label="Avisos">
              <Bell className="size-5" />
              {data.avisosPendentes > 0 ? (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
              ) : null}
            </Link>
          </Button>
          {data.ehGestor ? (
            <Button variant="ghost" size="icon" asChild>
              <Link
                href="/vendas/forca-de-vendas"
                aria-label="Gestão da Força de Vendas"
              >
                <Settings2 className="size-5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
        <div>
          <p className="text-xs opacity-80">
            {data.meta ? "Meta do mês" : "Vendido no mês"}
          </p>
          <p className="text-xl font-bold tabular-nums">
            {progresso !== null
              ? `${Math.round(progresso)}%`
              : formatBRL(data.vendidoMes)}
          </p>
          <p className="text-xs tabular-nums opacity-80">
            {data.meta
              ? `${formatBRL(data.vendidoMes)} de ${formatBRL(data.meta)}`
              : `${data.pedidosMes} pedidos`}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-80">Saldo flex</p>
          <p className="text-xl font-bold tabular-nums">
            {formatBRL(data.saldoFlex)}
          </p>
          <p className="text-xs tabular-nums opacity-80">
            Hoje {formatBRL(data.vendidoHoje)}
          </p>
        </div>
        {progresso !== null ? (
          // Barra própria: a do shadcn pinta o indicador de `primary`, a cor do
          // próprio cartão, e sumiria aqui.
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-primary-foreground/25">
            <div
              className="h-full rounded-full bg-primary-foreground"
              style={{ width: `${progresso}%` }}
            />
          </div>
        ) : null}
      </section>

      {destaque ? (
        <button
          type="button"
          onClick={() => setAvisoAberto(true)}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3 text-left",
            destaque.prioridade === "NORMAL"
              ? "bg-card"
              : "border-amber-300 bg-amber-50 text-amber-950",
          )}
        >
          <Megaphone className="mt-0.5 size-5 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {destaque.titulo}
            </span>
            <span className="line-clamp-2 text-sm opacity-80">
              {destaque.corpo}
            </span>
          </span>
        </button>
      ) : null}

      <nav className="grid grid-cols-3 gap-3" aria-label="Ambientes">
        {AMBIENTES.map((ambiente) => {
          const Icone = ambiente.icone;
          const badge = badges[ambiente.chave] ?? 0;
          return (
            <Link
              key={ambiente.chave}
              href={ambiente.href}
              className="relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card px-2 py-3 text-center transition-colors hover:bg-accent"
            >
              {badge > 0 ? (
                <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white tabular-nums">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
              {ambiente.emBreve ? (
                <span className="absolute top-2 right-2 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                  Em breve
                </span>
              ) : null}
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icone className="size-5" />
              </span>
              <span className="text-xs leading-tight font-medium">
                {ambiente.titulo}
              </span>
            </Link>
          );
        })}
      </nav>

      {destaque ? (
        <AvisoDialog
          aviso={destaque}
          aberto={avisoAberto || (urgente && destaque.pendente)}
          bloqueante={urgente}
          onFechar={() => setAvisoAberto(false)}
        />
      ) : null}
    </div>
  );
}
