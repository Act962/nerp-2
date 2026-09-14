"use client";

import { useCallback, useState } from "react";
import type { TicketParaImprimir } from "../lib/ticket-para-cupom";

const LIMITE = 10;

/**
 * Histórico do que saiu na impressora nesta sessão.
 *
 * Vive só na memória de propósito: serve ao "saiu torto, imprime de novo" de
 * quem está de pé na frente da impressora, não a um relatório. O que vale para
 * o histórico de verdade é `printedAt` no banco.
 */
export function useFilaState() {
  const [historico, setHistorico] = useState<TicketParaImprimir[]>([]);

  const registrar = useCallback((ticket: TicketParaImprimir) => {
    setHistorico((atual) =>
      [ticket, ...atual.filter((t) => t.ticketId !== ticket.ticketId)].slice(
        0,
        LIMITE,
      ),
    );
  }, []);

  return { historico, registrar };
}
