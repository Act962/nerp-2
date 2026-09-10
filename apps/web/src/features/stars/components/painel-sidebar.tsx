"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { hasFullAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useSaldo } from "../hooks/use-stars";
import type { NivelDeUso } from "../lib/uso";
import { Recarregar } from "./recarregar";

/**
 * O saldo de ★ no rodapé do menu, em toda página.
 *
 * A cor muda com o nível: é para ser visto de canto de olho, antes de a
 * pessoa precisar procurar. Laranja quando está acabando, vermelho quando
 * está no fim, e um botão de compra quando zerou — quem chega a zero no meio
 * de uma conversa com o Astro não deveria ter que descobrir onde se compra.
 */

const COR: Record<NivelDeUso, { icone: string; barra: string; texto: string }> =
  {
    ok: {
      icone: "text-primary",
      barra: "bg-primary",
      texto: "text-muted-foreground",
    },
    atencao: {
      icone: "text-amber-500",
      barra: "bg-amber-500",
      texto: "text-amber-600 dark:text-amber-400",
    },
    critico: {
      icone: "text-destructive",
      barra: "bg-destructive",
      texto: "text-destructive",
    },
    esgotado: {
      icone: "text-destructive",
      barra: "bg-destructive",
      texto: "text-destructive",
    },
  };

const LEGENDA: Record<NivelDeUso, string> = {
  ok: "",
  atencao: "Stars acabando",
  critico: "Quase no fim",
  esgotado: "Sem Stars",
};

export function StarsPainelSidebar() {
  const { data: saldo } = useSaldo();
  const { state } = useSidebar();
  const { member } = useCurrentMember();
  const podeComprar = hasFullAccess(member?.role);

  if (!saldo) return null;

  const cor = COR[saldo.nivel];
  const resumo = `${saldo.saldo} ★ · ${saldo.plano.nome}`;

  if (state === "collapsed") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip={resumo} asChild>
            <Link href="/configuracoes/stars">
              <Star className={cn(cor.icone)} />
              <span>{resumo}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-sidebar-accent/40 p-3 group-data-[collapsible=icon]:hidden">
      <Link
        href="/configuracoes/stars"
        className="flex items-center gap-2 hover:opacity-90"
      >
        <Star className={cn("size-5 shrink-0", cor.icone)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-sm tabular-nums">
            {saldo.saldo} ★
          </p>
          <p className={cn("truncate text-xs", cor.texto)}>
            {LEGENDA[saldo.nivel] || `Plano ${saldo.plano.nome}`}
          </p>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {saldo.percentual}%
        </span>
      </Link>

      {saldo.limite > 0 ? (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          <div
            className={cn("h-full rounded-full transition-all", cor.barra)}
            style={{ width: `${saldo.percentual}%` }}
          />
        </div>
      ) : null}

      {saldo.usoExtra > 0 ? (
        <p className="text-muted-foreground text-xs">
          +{saldo.usoExtra} ★ além do plano, pagas com Stars avulsas
        </p>
      ) : null}

      {saldo.nivel === "esgotado" ? (
        podeComprar ? (
          <Recarregar size="sm" />
        ) : (
          <p className="text-muted-foreground text-xs">
            Peça a um administrador para comprar Stars.
          </p>
        )
      ) : null}
    </div>
  );
}
