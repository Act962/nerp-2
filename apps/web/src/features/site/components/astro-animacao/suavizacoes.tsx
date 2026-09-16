"use client";

import { type AstroEasing, EASINGS, suavizar } from "@nerp/site-content";
import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { BolaDaPrevia, usePincel } from "./previa";

/**
 * As suavizações, mostradas em vez de nomeadas.
 *
 * `power2.inOut` e `back.out` não dizem nada a quem não escreve código — mas
 * uma bola que sai devagar, acelera e freia diz tudo. Todos os quadros percorrem
 * a MESMA distância no MESMO tempo: assim a única diferença entre eles é o
 * tempo, que é justamente o que a suavização decide.
 *
 * A conta é a `suavizar` do pacote, a mesma que move a cena — e não uma curva
 * em CSS parecida com ela.
 */

const CICLO = 1.2;
/** Quanto a bola anda no quadro. O resto é margem para o excesso de
 *  `back.out` e `elastic.out`, que passam do fim antes de voltar. */
const CURSO = 44;

export function Suavizacoes({
  atual,
  aoEscolher,
}: {
  atual: AstroEasing;
  aoEscolher: (e: AstroEasing) => void;
}) {
  const bolas = useRef<(HTMLSpanElement | null)[]>([]);

  const pintar = useCallback((t: number) => {
    // Vai e volta num ciclo só: sem a volta, a bola saltaria do fim para o
    // começo e o salto roubaria a atenção da curva.
    const volta = (t % (CICLO * 2)) / CICLO;
    const p = volta <= 1 ? volta : 2 - volta;

    EASINGS.forEach((easing, i) => {
      const el = bolas.current[i];
      if (!el) return;
      const avanco = (suavizar(easing, p) - 0.5) * CURSO;
      el.style.transform = `translate(-50%, -50%) translateX(${avanco}px)`;
    });
  }, []);

  usePincel(pintar);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {EASINGS.map((easing, i) => (
        <button
          key={easing}
          type="button"
          onClick={() => aoEscolher(easing)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-md border bg-[#04101f] p-1 transition-colors hover:border-primary",
            atual === easing && "border-primary",
          )}
        >
          <span className="relative block h-7 w-[76px] overflow-hidden">
            {/* O trilho: sem ele a bola parece flutuar, e o percurso — que é o
                que se está comparando — fica invisível. */}
            <span className="absolute left-1/2 top-1/2 block h-px w-[52px] -translate-x-1/2 -translate-y-1/2 bg-white/15" />
            <BolaDaPrevia
              refBola={(el) => {
                bolas.current[i] = el;
              }}
            />
          </span>
          <span className="max-w-full truncate text-[10px] leading-none text-white/70">
            {easing}
          </span>
        </button>
      ))}
    </div>
  );
}
