"use client";

import { ExternalLink, Percent } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tintaSobre } from "@/features/storefront/lib/cores";
import type { OfertaDaVitrine } from "@/features/storefront/server/ofertas";
import { cn } from "@/lib/utils";

/**
 * O botão "Ofertas": um catálogo abre direto; vários viram uma lista.
 *
 * Abre em aba nova de propósito — o catálogo promocional é outra página, e o
 * cliente não pode perder o pedido que estava montando na vitrine.
 */
export function BotaoDeOfertas({
  ofertas,
  tema,
  compacto = false,
}: {
  ofertas: OfertaDaVitrine[];
  tema: string;
  compacto?: boolean;
}) {
  if (ofertas.length === 0) return null;

  const aparencia = compacto
    ? "flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold"
    : "flex h-10 items-center gap-2 rounded-md border-2 px-4 font-semibold text-sm transition-colors hover:bg-current/10";
  const conteudo = (
    <>
      <Percent className="size-5 sm:size-4" style={{ color: tema }} />
      Ofertas
    </>
  );
  const estilo = compacto ? undefined : { borderColor: tema };

  if (ofertas.length === 1) {
    return (
      <a
        href={`/promocao/${ofertas[0].shareToken}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(aparencia)}
        style={estilo}
      >
        {conteudo}
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(aparencia)} style={estilo}>
          {conteudo}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel
          className="rounded-sm text-xs"
          style={{ backgroundColor: tema, color: tintaSobre(tema) }}
        >
          Nossas ofertas
        </DropdownMenuLabel>
        {ofertas.map((oferta) => (
          <DropdownMenuItem key={oferta.shareToken} asChild>
            <a
              href={`/promocao/${oferta.shareToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2"
            >
              {oferta.nome}
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
