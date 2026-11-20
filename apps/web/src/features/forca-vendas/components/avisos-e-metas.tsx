"use client";

import { Megaphone, Sparkles, Star, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAvisosFv, useInicioFv } from "../hooks/use-forca-vendas";
import { formatarDataHora, formatBRL } from "../lib/formatar";
import { type AvisoDoVendedor, AvisoDialog } from "./aviso-dialog";
import { FvPagina, Linha, Secao, Vazio } from "./fv-pagina";

const PRIORIDADE: Record<string, string> = {
  URGENTE: "Urgente",
  IMPORTANTE: "Importante",
  NORMAL: "Aviso",
};

export function TelaDeAvisos() {
  const { data: avisos, isPending } = useAvisosFv();
  const [aberto, setAberto] = useState<AvisoDoVendedor | null>(null);
  return (
    <FvPagina titulo="Avisos">
      {isPending ? (
        <Skeleton className="h-40" />
      ) : !avisos || avisos.length === 0 ? (
        <Vazio>Nenhum aviso do gestor por enquanto.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {avisos.map((aviso) => (
            <li key={aviso.id}>
              <button
                type="button"
                onClick={() => setAberto(aviso)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left hover:bg-accent",
                  aviso.pendente && "border-primary",
                )}
              >
                <Megaphone className="mt-0.5 size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{aviso.titulo}</span>
                    {aviso.prioridade !== "NORMAL" ? (
                      <Badge
                        variant={
                          aviso.prioridade === "URGENTE"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {PRIORIDADE[aviso.prioridade]}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {aviso.corpo}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatarDataHora(aviso.inicioEm)}
                    {aviso.pendente
                      ? aviso.exigeConfirmacao
                        ? " · falta confirmar"
                        : " · novo"
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberto ? (
        <AvisoDialog
          aviso={aberto}
          aberto
          bloqueante={false}
          onFechar={() => setAberto(null)}
        />
      ) : null}
    </FvPagina>
  );
}

export function TelaDeMetas() {
  const { data, isPending } = useInicioFv();
  if (isPending || !data) {
    return (
      <FvPagina titulo="Metas">
        <Skeleton className="h-40" />
      </FvPagina>
    );
  }
  const progresso = data.meta
    ? Math.min(100, (data.vendidoMes / data.meta) * 100)
    : null;
  return (
    <FvPagina titulo="Metas">
      <Secao titulo="Mês atual">
        {data.meta ? (
          <>
            <p className="text-3xl font-bold tabular-nums">
              {Math.round(progresso ?? 0)}%
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <Linha rotulo="Meta" valor={formatBRL(data.meta)} />
            <Linha
              rotulo="Falta"
              valor={formatBRL(Math.max(0, data.meta - data.vendidoMes))}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem meta vinculada a você no Ranking de Equipes deste mês.
          </p>
        )}
        <Linha rotulo="Vendido no mês" valor={formatBRL(data.vendidoMes)} />
        <Linha rotulo="Pedidos no mês" valor={data.pedidosMes} />
        <Linha rotulo="Vendido hoje" valor={formatBRL(data.vendidoHoje)} />
        <Linha rotulo="Clientes na carteira" valor={data.clientesNaCarteira} />
      </Secao>
      <Button variant="outline" asChild>
        <Link href="/ranking">
          <Trophy className="size-4" />
          Ver o ranking da equipe
        </Link>
      </Button>
      <p className="text-xs text-muted-foreground">
        Meta por produto, marca e fornecedor, comissão e positivação chegam numa
        próxima fase.
      </p>
    </FvPagina>
  );
}

const EM_BREVE = {
  campanhas: {
    titulo: "Campanhas",
    icone: Target,
    texto:
      "Disparos para a sua carteira pelo WhatsApp oficial, com aniversário, pós-pedido e cliente que sumiu automáticos. Chega na próxima fase do módulo.",
  },
  astro: {
    titulo: "Astro",
    icone: Sparkles,
    texto:
      "Pergunte por texto ou voz, monte o pedido pela foto da lista do cliente e receba o mix sugerido. Chega na próxima fase do módulo.",
  },
  "star-friends": {
    titulo: "Star Friends",
    icone: Star,
    texto:
      "O programa de fidelidade do Órbita na ficha do cliente: nível, estrelas e resgate de prêmios. Chega numa próxima fase.",
  },
} as const;

export function TelaEmBreve({ chave }: { chave: keyof typeof EM_BREVE }) {
  const info = EM_BREVE[chave];
  const Icone = info.icone;
  return (
    <FvPagina titulo={info.titulo}>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icone className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">{info.texto}</p>
      </div>
    </FvPagina>
  );
}
