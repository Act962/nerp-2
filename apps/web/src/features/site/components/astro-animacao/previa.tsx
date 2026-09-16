"use client";

import { useEffect, useMemo } from "react";

/**
 * O que as prévias em bola têm em comum.
 *
 * São duas grades — tipos de movimento e suavizações — e as duas mostram a
 * mesma bolinha andando. O que se compartilha aqui é só o laço e o desenho da
 * bola; o que cada grade calcula é dela.
 */

/**
 * Um laço de animação com respeito a quem pediu menos movimento.
 *
 * A pintura escreve direto no `style` dos elementos, sem passar por estado do
 * React: são dez quadros a 60 fps, e um `setState` por quadro redesenharia o
 * painel inteiro sessenta vezes por segundo para mover dez bolinhas.
 */
export function usePincel(pintar: (t: number) => void) {
  const parado = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (parado) {
      pintar(0);
      return;
    }
    let inicio = 0;
    let id = 0;
    const passo = (agora: number) => {
      if (!inicio) inicio = agora;
      pintar((agora - inicio) / 1000);
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [pintar, parado]);
}

/**
 * A bolinha.
 *
 * O brilho fora do centro não é enfeite: numa bola lisa, girar e balançar são
 * invisíveis — um círculo girado é o mesmo círculo. É esta marca que transforma
 * rotação em algo que se vê.
 *
 * A centragem NÃO pode vir de `-translate-x-1/2 -translate-y-1/2`: no Tailwind 4
 * essas classes viram a propriedade CSS `translate`, que é independente de
 * `transform` e SOMA com ele — a bola era centrada duas vezes e subia meio
 * diâmetro, encostando no teto do quadro. Quem pinta já manda o
 * `translate(-50%, -50%)` dentro do próprio transform.
 */
export function BolaDaPrevia({
  refBola,
}: {
  refBola: (el: HTMLSpanElement | null) => void;
}) {
  return (
    <span
      ref={refBola}
      className="absolute left-1/2 top-1/2 block size-4 rounded-full bg-gradient-to-br from-[#5fb2ff] to-[#0b7bfe] shadow-[0_0_10px_rgba(47,192,254,0.45)]"
    >
      <span className="absolute left-[18%] top-[14%] block size-1 rounded-full bg-white/85" />
    </span>
  );
}
