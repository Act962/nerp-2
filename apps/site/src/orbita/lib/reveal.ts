/**
 * Motor de revelação dos overlays.
 *
 * Todo texto e card do site é uma função do progresso orbital: entra, ganha
 * foco, e se afasta. Em vez de N ScrollTriggers (um por elemento, cada um com
 * seu próprio cálculo), existe um único loop que percorre um registro plano e
 * escreve direto no style. É o que mantém 40+ elementos animando sem custo.
 */

import { window01 } from "./cn";

export type RevealOptions = {
  /** Janela de progresso: começa a entrar / entrou / começa a sair / saiu. */
  inStart: number;
  inEnd: number;
  outStart: number;
  outEnd: number;
  /** Deslocamento vertical em px na entrada (negativo = vem de baixo). */
  y?: number;
  /** Deslocamento horizontal em px na entrada. */
  x?: number;
  /** Escala inicial. */
  scale?: number;
  /** Blur máximo em px quando fora de foco. */
  blur?: number;
  /** Atraso relativo dentro da janela (0→1) para escalonar itens de uma lista. */
  stagger?: number;
};

type Entry = RevealOptions & { el: HTMLElement; last: number };

const entries = new Set<Entry>();

export function registerReveal(el: HTMLElement, options: RevealOptions) {
  const entry: Entry = { ...options, el, last: -1 };
  entries.add(entry);
  return () => {
    entries.delete(entry);
  };
}

/**
 * @param attenuation multiplica a opacidade de todos os blocos. É por aqui que
 * o modo produto apaga a narrativa da órbita: os títulos de categoria e o
 * trilho de progresso não competem com o painel do produto, sem que cada um
 * precise conhecer o estado do outro.
 */
export function updateReveals(progress: number, attenuation = 1) {
  for (const e of entries) {
    // O stagger atrasa só a entrada. Se ele deslocasse a janela inteira, o
    // último item de uma lista continuaria visível seções adiante.
    const shift = (e.stagger ?? 0) * 0.014;
    const w = window01(
      progress,
      e.inStart + shift,
      e.inEnd + shift,
      e.outStart,
      e.outEnd,
    );

    const value = w * attenuation;
    if (Math.abs(value - e.last) < 0.0015) continue;
    e.last = value;

    const eased = w * w * (3 - 2 * w) * attenuation;
    const inv = 1 - eased;
    const y = (e.y ?? 26) * inv;
    const x = (e.x ?? 0) * inv;
    const scale = 1 - (1 - (e.scale ?? 0.96)) * inv;
    const blur = (e.blur ?? 6) * inv;

    const style = e.el.style;
    style.opacity = eased.toFixed(3);
    style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    style.filter = blur > 0.35 ? `blur(${blur.toFixed(2)}px)` : "none";
    style.pointerEvents = eased > 0.62 ? "auto" : "none";
    style.visibility = eased < 0.004 ? "hidden" : "visible";
  }
}

/** Estado final estático, para prefers-reduced-motion e fallback. */
export function settleReveals() {
  for (const e of entries) {
    const style = e.el.style;
    style.opacity = "1";
    style.transform = "none";
    style.filter = "none";
    style.pointerEvents = "auto";
    style.visibility = "visible";
  }
}
