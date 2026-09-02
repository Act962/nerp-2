"use client";

import { useEffect, useRef } from "react";
import { ORBIT_TOOLS } from "../data/catalog";
import { clamp, smoothstep } from "../lib/cn";
import { progressForAngle, toolAngles } from "../lib/orbit";
import { scroll } from "../lib/store";
import { scrollToProgress } from "../hooks/use-scroll-timeline";

/**
 * O botão "Avançar" — só no celular.
 *
 * No desktop, percorrer a órbita é rolar: o dedo não cansa e a trajetória
 * inteira cabe em poucos gestos. No celular são dezenove estações, e cada uma
 * pede um deslize novo — a viagem que no desktop é fluida vira trabalho.
 *
 * O botão resolve isso sem tirar o scroll de ninguém: ele salta para a próxima
 * estação, e quem preferir continuar rolando com o dedo continua. Ele existe
 * "para cada ponto da órbita" no sentido que importa — em qualquer ponto ele
 * está lá, apontando para o seguinte.
 *
 * A posição de cada estação sai da mesma matemática que a cena usa
 * (`toolAngles` + `progressForAngle`), então o salto pousa exatamente onde a
 * esfera está. Nada aqui é uma segunda tabela de posições.
 */

const ANGLES = toolAngles(ORBIT_TOOLS.length);
const PARADAS = ANGLES.map((angle) => progressForAngle(angle));

/** Uma folga para o salto não cair na estação em que já estamos. */
const FOLGA = 0.004;

export function AdvanceButton() {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = ref.current;
      if (!el) return;

      /*
        Quando ele aparece.

        Só na faixa da órbita: antes dela a cortina ainda está subindo, depois
        dela a página volta a ser texto, e nos dois casos rolar já é o gesto
        certo. Some também com um produto aberto (a roleta assume o scroll) e
        com um painel do menu aberto, que cobriria o botão.
      */
      const p = scroll.smooth;
      const primeira = PARADAS[0];
      const ultima = PARADAS[PARADAS.length - 1];

      const dentro = p > primeira - 0.05 && p < ultima + 0.02;
      const livre = scroll.product.t < 0.05 && !scroll.menuOpen;
      const chegou = smoothstep(clamp((scroll.intro - 0.72) / 0.28));

      const visivel = dentro && livre ? chegou : 0;

      el.style.opacity = visivel.toFixed(3);
      const desloca = ((1 - visivel) * 12).toFixed(1);
      el.style.transform = `translate3d(-50%, ${desloca}px, 0)`;
      el.style.pointerEvents = visivel > 0.6 ? "auto" : "none";
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const avancar = () => {
    const atual = scroll.smooth;
    const proxima = PARADAS.find((parada) => parada > atual + FOLGA);
    // Na última estação, o botão entrega o fim da órbita em vez de não fazer
    // nada — um botão que não responde parece quebrado.
    scrollToProgress(proxima ?? PARADAS[PARADAS.length - 1] + 0.04);
  };

  return (
    <button
      ref={ref}
      type="button"
      className="o-advance"
      onClick={avancar}
      style={{ opacity: 0 }}
    >
      Avançar
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 5v14M6 13l6 6 6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
