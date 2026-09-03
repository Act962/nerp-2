import type { BlockStyle } from "./blocks";

/**
 * Traduz a aparência de um bloco em VARIÁVEIS CSS.
 *
 * Variável, e não classe utilitária nem `style` em cada elemento: o CSS da
 * página continua dono do desenho e só passa a ler `var(--b-x, <o de sempre>)`.
 * Com isso um bloco sem estilo desenha idêntico ao que desenhava, e um campo
 * novo aqui não obriga a mexer no CSS de todos os blocos.
 *
 * O que não foi preenchido NÃO vira variável — devolver `""` faria o `var()`
 * resolver para vazio em vez de cair no padrão, que é justamente o contrário do
 * que se quer.
 */

const FAMILIES: Record<string, string> = {
  padrao: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  titulo: "'Segoe UI', Inter, -apple-system, Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

/** 0–100 do painel → segundos de um ciclo de flutuação. */
function floatDuration(smoothness: number): string {
  // 2,5s no nervoso, 8s no bem suave. Abaixo de ~2s o movimento vira tremor.
  return `${(2.5 + (smoothness / 100) * 5.5).toFixed(2)}s`;
}

export function blockStyleVars(style: BlockStyle | undefined): {
  vars: Record<string, string>;
  classes: string[];
} {
  const vars: Record<string, string> = {};
  const classes: string[] = [];
  if (!style) return { vars, classes };

  if (style.background) {
    vars["--b-bg"] = style.backgroundTo
      ? `linear-gradient(135deg, ${style.background} 0%, ${style.backgroundTo} 100%)`
      : style.background;
    classes.push("sp-b--bg");
  }

  // Uma classe POR PROPRIEDADE preenchida, e não uma por slot.
  //
  // A regra do CSS só existe quando a classe existe. Sem isso, um seletor
  // genérico como `.sp-band h2 { color: var(--b-title-color, inherit) }` venceria
  // por ordem de arquivo a cor própria de cada bloco e apagaria, por exemplo, o
  // azul do título do vídeo lado a lado — mesmo com ninguém tendo escolhido cor
  // nenhuma. Com a classe, quem não configurou nada continua exatamente como
  // estava.
  for (const slot of ["title", "text", "items"] as const) {
    const t = style[slot];
    if (!t) continue;
    if (t.color) {
      vars[`--b-${slot}-color`] = t.color;
      classes.push(`sp-b--${slot}-color`);
    }
    if (t.size) {
      vars[`--b-${slot}-size`] = `${t.size}rem`;
      classes.push(`sp-b--${slot}-size`);
    }
    if (t.family) {
      vars[`--b-${slot}-family`] = FAMILIES[t.family];
      classes.push(`sp-b--${slot}-family`);
    }
    if (t.weight) {
      vars[`--b-${slot}-weight`] = t.weight;
      classes.push(`sp-b--${slot}-weight`);
    }
  }

  if (style.button) {
    const b = style.button;
    if (b.background) {
      vars["--b-btn-bg"] = b.backgroundTo
        ? `linear-gradient(135deg, ${b.background} 0%, ${b.backgroundTo} 100%)`
        : b.background;
      classes.push("sp-b--btn");
    }
    if (b.color) {
      vars["--b-btn-color"] = b.color;
      classes.push("sp-b--btn-color");
    }
  }

  if (style.effect?.enabled) {
    classes.push(`sp-fx sp-fx--${style.effect.kind}`);
    // A intensidade sai como fração para a animação escalar sem `calc` no CSS.
    vars["--b-fx"] = (style.effect.intensity / 100).toFixed(2);
  }

  const img = style.image;
  if (img?.float) {
    classes.push("sp-float");
    vars["--b-float-dur"] = floatDuration(img.smoothness);
  }
  if (img?.shadow) {
    classes.push("sp-float-shadow");
    vars["--b-shadow"] = (img.shadowStrength / 100).toFixed(2);
  }

  return { vars, classes };
}
