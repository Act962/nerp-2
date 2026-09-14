"use client";

import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import type { MesaDoSalao } from "../hooks/use-mesas";

/**
 * Cor E palavra, nunca cor sozinha.
 *
 * O food truck opera no sol, onde a diferença entre verde e laranja some na
 * tela do celular — e mesmo na sombra, parte das pessoas não distingue as duas.
 * O rótulo é o que faz a grade continuar legível nos dois casos.
 */
const ESTILO = {
  LIVRE: {
    rotulo: "Livre",
    classe:
      "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100",
  },
  CONSUMINDO: {
    rotulo: "Consumindo",
    classe:
      "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-100",
  },
  FECHANDO: {
    rotulo: "Fechando",
    classe:
      "bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-100",
  },
} as const;

export function MesaCard({
  mesa,
  agora,
  onClick,
}: {
  mesa: MesaDoSalao;
  agora: number;
  onClick: () => void;
}) {
  const estilo = ESTILO[mesa.estado];
  const tempo = mesa.abertaDesde ? decorrido(mesa.abertaDesde, agora) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-24 flex-col items-center justify-center gap-0.5 rounded-xl border-2 p-2 text-center transition-transform active:scale-95",
        estilo.classe,
      )}
    >
      <span className="text-2xl font-extrabold leading-none">
        {mesa.number}
      </span>

      {/* A palavra do estado é FIXA. Antes ela cedia lugar ao nome do
          atendente, e a mesa ocupada passava a ser distinguível só pela cor —
          que é o que some no sol e some para quem não separa verde de laranja. */}
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
        {estilo.rotulo}
      </span>

      <span className="text-sm font-bold">
        {mesa.total > 0 ? `R$ ${currencyFormatter(mesa.total).trim()}` : "—"}
      </span>

      <span className="w-full truncate text-[10px] opacity-75">
        {[mesa.atendente ?? mesa.name, tempo].filter(Boolean).join(" · ") ||
          "\u00a0"}
      </span>
    </button>
  );
}

/** "há 38 min", "há 1 h 04". Minuto a mais não muda decisão nenhuma. */
function decorrido(desde: string, agora: number): string {
  const minutos = Math.max(
    0,
    Math.floor((agora - new Date(desde).getTime()) / 60000),
  );
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `há ${horas} h ${String(resto).padStart(2, "0")}`;
}
