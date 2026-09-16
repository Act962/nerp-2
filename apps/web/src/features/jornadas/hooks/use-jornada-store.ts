"use client";

import { create } from "zustand";
import { jornadaPorId } from "../catalogo";
import type { Jornada } from "../catalogo/tipos";
import {
  type EstadoDaJornada,
  type EventoDaJornada,
  reduzir,
} from "../engine/maquina";
import {
  gravarSessao,
  type JornadaEmAndamento,
  lerSessao,
  novaSessao,
  storageDaSessao,
} from "../lib/sessao";

/**
 * O estado da jornada em andamento, fora da árvore do React.
 *
 * Zustand e não contexto porque três lugares distantes falam com ele: o
 * convite flutuante, a lista dentro do painel do Astro e o motor montado no
 * leiaute. Um provider teria de envolver os três.
 *
 * Cada despacho grava a sessão no `sessionStorage` de forma SÍNCRONA. Não é
 * detalhe: o passo de clique termina com uma navegação, e um `useEffect` que
 * gravasse depois perderia a corrida para o `router.push`.
 */

interface LojaDaJornada {
  estado: EstadoDaJornada;
  jornada: Jornada | null;
  despachar: (evento: EventoDaJornada) => void;
  comecar: (input: {
    jornadaId: string;
    organizationId: string;
    iniciadaEm: string;
  }) => void;
  hidratar: () => void;
}

function sessaoDe(estado: EstadoDaJornada): JornadaEmAndamento | null {
  return "sessao" in estado ? estado.sessao : null;
}

export const useJornadaStore = create<LojaDaJornada>((set, get) => ({
  estado: { fase: "ociosa" },
  jornada: null,

  despachar: (evento) => {
    const { estado, jornada } = get();
    const proximo = reduzir(estado, evento, jornada);
    if (proximo === estado) return;

    const sessao = sessaoDe(proximo);
    gravarSessao(storageDaSessao(), sessao);

    set({
      estado: proximo,
      jornada:
        sessao && sessao.jornadaId !== jornada?.id
          ? jornadaPorId(sessao.jornadaId)
          : proximo.fase === "ociosa"
            ? null
            : jornada,
    });
  },

  comecar: ({ jornadaId, organizationId, iniciadaEm }) => {
    const jornada = jornadaPorId(jornadaId);
    if (!jornada) return;
    const sessao = novaSessao({ jornadaId, organizationId, iniciadaEm });
    gravarSessao(storageDaSessao(), sessao);
    set({ estado: { fase: "procurandoAlvo", sessao }, jornada });
  },

  /** Retoma o que ficou pela metade — outra tela, ou um F5 no meio do caminho. */
  hidratar: () => {
    if (get().estado.fase !== "ociosa") return;
    const sessao = lerSessao(storageDaSessao());
    if (!sessao) return;
    const jornada = jornadaPorId(sessao.jornadaId);
    if (!jornada || sessao.passo >= jornada.passos.length) {
      // Jornada que não existe mais (renomeada, removida numa entrega nova):
      // limpar é melhor do que deixar um balão órfão perseguindo a pessoa.
      gravarSessao(storageDaSessao(), null);
      return;
    }
    set({
      estado: { fase: "procurandoAlvo", sessao },
      jornada,
    });
  },
}));
