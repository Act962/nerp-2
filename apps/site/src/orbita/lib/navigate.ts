"use client";

import type { Tool } from "../data/catalog";
import { ORBIT_TOOLS } from "../data/catalog";
import { progressForAngle, toolAngles } from "./orbit";
import { openProduct } from "./product-store";
import { scrollToProgress } from "../hooks/use-scroll-timeline";

/**
 * Para onde vai um item do menu de soluções.
 *
 * Duas respostas possíveis, e a diferença é do catálogo, não do menu:
 *
 * - a ferramenta tem `href` → é uma página que existe, interna ou externa, e
 *   o item é um link de verdade (o `<a>` é montado no componente);
 * - não tem → o destino é a própria órbita. A página vai até a estação
 *   daquela ferramenta e abre o modo produto, com as funcionalidades na
 *   roleta.
 *
 * O segundo caso não é um consolo pelo primeiro faltar: é a página do produto
 * dentro da experiência. Quando as páginas internas existirem, basta
 * preencher `href` no catálogo — nada aqui muda.
 */

const ANGLES = toolAngles(ORBIT_TOOLS.length);

/** O ângulo orbital de uma ferramenta, pela posição dela no catálogo. */
export function angleForTool(id: string) {
  const index = ORBIT_TOOLS.findIndex((t) => t.id === id);
  return index < 0 ? ANGLES[0] : ANGLES[index];
}

/** Leva a órbita até a ferramenta e abre o produto. */
export function goToTool(id: string) {
  const angle = angleForTool(id);
  // Posiciona de uma vez: abrir o produto para o Lenis, e uma viagem suave
  // iniciada agora ficaria congelada no meio.
  scrollToProgress(progressForAngle(angle), true);
  openProduct(id, angle);
}

/** Um item externo abre em aba nova; um interno navega na mesma. */
export function isExternal(tool: Pick<Tool, "href">) {
  return !!tool.href && /^https?:\/\//.test(tool.href);
}
