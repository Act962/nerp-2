"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageCircle, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatWhatsapp } from "@/lib/whatsapp";

export type CardDoBoard = {
  id: string;
  nome: string;
  telefone: string | null;
  valor: number;
  temperatura: "COLD" | "WARM" | "HOT" | "VERY_HOT";
  statusFlow: "NEW" | "ACTIVE" | "WAITING" | "FINISHED";
  temCliente: boolean;
  responsavel: string | null;
  conversationId: string | null;
  naoLidas: number;
  tags: { id: string; nome: string; cor: string | null }[];
};

const CORES_DE_INTERESSE: Record<CardDoBoard["temperatura"], string> = {
  COLD: "bg-slate-400",
  WARM: "bg-amber-400",
  HOT: "bg-orange-500",
  VERY_HOT: "bg-red-500",
};

const ROTULO_DE_INTERESSE: Record<CardDoBoard["temperatura"], string> = {
  COLD: "Frio",
  WARM: "Morno",
  HOT: "Quente",
  VERY_HOT: "Muito quente",
};

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function CardDoLead({
  card,
  funnelId,
}: {
  card: CardDoBoard;
  funnelId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { tipo: "card", card } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm",
        // Enquanto arrasta, o original vira fantasma — o que o dedo segue é a
        // sobreposição, e ter os dois sólidos confunde de onde o card saiu.
        isDragging && "opacity-40",
      )}
    >
      {/* Só o cabeçalho arrasta: o corpo tem link para a conversa, e um card
          inteiro arrastável engoliria o clique. */}
      <div
        {...attributes}
        {...listeners}
        className="mb-2 flex cursor-grab items-start gap-2 active:cursor-grabbing"
      >
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            CORES_DE_INTERESSE[card.temperatura],
          )}
          title={ROTULO_DE_INTERESSE[card.temperatura]}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{card.nome}</p>
          {card.telefone ? (
            <p className="truncate text-muted-foreground text-xs">
              {formatWhatsapp(card.telefone)}
            </p>
          ) : null}
        </div>
        {card.temCliente ? (
          <ShoppingBag
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-label="Ligado a um cliente do cadastro"
          />
        ) : null}
      </div>

      {card.tags.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[10px]">
              {tag.nome}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {card.valor > 0 ? (
          <span className="font-medium text-xs">
            {dinheiro.format(card.valor)}
          </span>
        ) : (
          <span />
        )}

        {card.conversationId ? (
          <Link
            href={`/whatsapp?funil=${funnelId}&conversa=${card.conversationId}`}
            className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          >
            <MessageCircle className="size-3.5" />
            {card.naoLidas > 0 ? (
              <Badge className="px-1 py-0 text-[10px]">{card.naoLidas}</Badge>
            ) : (
              "Abrir"
            )}
          </Link>
        ) : null}
      </div>

      {card.responsavel ? (
        <p className="mt-2 truncate text-muted-foreground text-[11px]">
          {card.responsavel}
        </p>
      ) : null}
    </div>
  );
}
