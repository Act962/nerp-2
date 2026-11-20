"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_PEDIDO } from "../lib/formatar";

/**
 * Moldura das telas internas do módulo: botão de voltar, título e uma ação à
 * direita. Mesma largura do App Promotor (`max-w-xl`), feita para uma mão só.
 */
export function FvPagina({
  titulo,
  voltarPara = "/forca-de-vendas",
  acao,
  children,
}: {
  titulo: string;
  voltarPara?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link href={voltarPara} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {titulo}
        </h1>
        {acao}
      </div>
      {children}
    </div>
  );
}

// Cores do status de venda do ERP (`utils/status-sales-config`); o verde é
// explícito porque o token `success` não existe no `globals.css`.
const TOM: Record<string, string> = {
  neutro: "bg-secondary text-secondary-foreground",
  aviso: "bg-amber-100 text-amber-800",
  ok: "bg-primary text-primary-foreground",
  fim: "bg-emerald-600 text-white",
  erro: "bg-destructive text-destructive-foreground",
};

export function StatusPedidoBadge({ status }: { status: string }) {
  const info = STATUS_PEDIDO[status] ?? { rotulo: status, tom: "neutro" };
  return (
    <Badge variant="secondary" className={cn("border-0", TOM[info.tom])}>
      {info.rotulo}
    </Badge>
  );
}

/** Linha "rótulo ··· valor" usada nas fichas. */
export function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: React.ReactNode;
  destaque?: "erro" | "ok";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          "text-right font-medium tabular-nums",
          destaque === "erro" && "text-destructive",
          destaque === "ok" && "text-emerald-600",
        )}
      >
        {valor}
      </span>
    </div>
  );
}

export function Secao({
  titulo,
  children,
  acao,
}: {
  titulo: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
