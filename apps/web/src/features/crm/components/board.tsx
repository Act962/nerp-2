"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBoard, useMoverCard } from "../hooks/use-board";
import { type CardDoBoard, CardDoLead } from "./card-do-lead";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

type Coluna = {
  id: string;
  nome: string;
  cor: string | null;
  totalDeLeads: number;
  valorTotal: number;
  cards: CardDoBoard[];
};

/**
 * O funil.
 *
 * Arrastar calcula os **vizinhos** do ponto onde o card foi solto e manda os
 * dois ids para o servidor, que decide a posição. Mandar um número calculado
 * aqui daria briga quando dois atendentes arrastassem ao mesmo tempo, cada um
 * olhando para uma tela diferente.
 */
export function Board({ funnelId }: { funnelId: string }) {
  const [busca, setBusca] = useState("");
  const { data, isPending } = useBoard({
    funnelId,
    busca: busca.trim() || undefined,
  });
  const mover = useMoverCard();
  const [arrastando, setArrastando] = useState<CardDoBoard | null>(null);

  const sensores = useSensors(
    useSensor(PointerSensor, {
      // Sem esta folga, um clique no link da conversa vira arrasto de 1px e o
      // link nunca dispara.
      activationConstraint: { distance: 6 },
    }),
  );

  const colunas: Coluna[] = data?.colunas ?? [];

  function aoComecar(evento: DragStartEvent) {
    const card = evento.active.data.current?.card as CardDoBoard | undefined;
    setArrastando(card ?? null);
  }

  function aoSoltar(evento: DragEndEvent) {
    setArrastando(null);
    const { active, over } = evento;
    if (!over) return;

    const cardId = String(active.id);

    // Soltou sobre outro card ou sobre o vazio da coluna.
    const sobreCard = over.data.current?.tipo === "card";
    const colunaDestino = sobreCard
      ? colunas.find((coluna) =>
          coluna.cards.some((card) => card.id === String(over.id)),
        )
      : colunas.find((coluna) => coluna.id === String(over.id));

    if (!colunaDestino) return;

    const origem = colunas.find((coluna) =>
      coluna.cards.some((card) => card.id === cardId),
    );

    // A lista sem o card arrastado — é entre estes que ele vai pousar.
    const restantes = colunaDestino.cards.filter((card) => card.id !== cardId);

    let posicao = restantes.length;
    if (sobreCard) {
      const indiceAlvo = restantes.findIndex(
        (card) => card.id === String(over.id),
      );
      if (indiceAlvo >= 0) {
        // Descendo dentro da mesma coluna, o card ocupa o lugar do alvo; em
        // qualquer outro caso entra acima dele.
        const descendo =
          origem?.id === colunaDestino.id &&
          origem.cards.findIndex((card) => card.id === cardId) < indiceAlvo;
        posicao = descendo ? indiceAlvo + 1 : indiceAlvo;
      }
    }

    const anterior = restantes[posicao - 1];
    const proximo = restantes[posicao];

    // Não mexeu em nada: mesma coluna, mesmos vizinhos.
    if (
      origem?.id === colunaDestino.id &&
      origem.cards[origem.cards.findIndex((c) => c.id === cardId) - 1]?.id ===
        anterior?.id
    ) {
      return;
    }

    mover.mutate({
      leadId: cardId,
      stageId: colunaDestino.id,
      anteriorId: anterior?.id,
      proximoId: proximo?.id,
    });
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando funil…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="pl-8"
        />
      </div>

      <DndContext
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={aoComecar}
        onDragEnd={aoSoltar}
      >
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
          {colunas.map((coluna) => (
            <ColunaDoBoard
              key={coluna.id}
              coluna={coluna}
              funnelId={funnelId}
            />
          ))}
        </div>

        {/* O que o dedo segue enquanto arrasta. Sem isto o card fica preso na
            coluna de origem e o arrasto parece travado. */}
        <DragOverlay>
          {arrastando ? (
            <div className="rotate-2">
              <CardDoLead card={arrastando} funnelId={funnelId} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function ColunaDoBoard({
  coluna,
  funnelId,
}: {
  coluna: Coluna;
  funnelId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: coluna.id,
    data: { tipo: "coluna" },
  });

  const escondidos = coluna.totalDeLeads - coluna.cards.length;

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: coluna.cor ?? "#94a3b8" }}
        />
        <span className="min-w-0 flex-1 truncate font-medium text-sm">
          {coluna.nome}
        </span>
        <span className="shrink-0 text-muted-foreground text-xs">
          {coluna.totalDeLeads}
        </span>
      </div>

      {coluna.valorTotal > 0 ? (
        <p className="px-3 pt-2 text-muted-foreground text-xs">
          {dinheiro.format(coluna.valorTotal)}
        </p>
      ) : null}

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-24 flex-1 space-y-2 overflow-y-auto p-2 transition-colors",
          isOver && "bg-accent/60",
        )}
      >
        <SortableContext
          items={coluna.cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {coluna.cards.map((card) => (
            <CardDoLead key={card.id} card={card} funnelId={funnelId} />
          ))}
        </SortableContext>

        {coluna.cards.length === 0 ? (
          <p className="px-1 py-6 text-center text-muted-foreground text-xs">
            Arraste um cliente para cá
          </p>
        ) : null}

        {escondidos > 0 ? (
          <p className="px-1 py-2 text-center text-muted-foreground text-xs">
            + {escondidos} não exibido{escondidos === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
