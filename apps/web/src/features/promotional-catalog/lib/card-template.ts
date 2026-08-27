import type { CardLayoutElement, CatalogConfig } from "../types";
import { makeCardElement } from "../types";

// Converte o card EMBUTIDO (`cardStyle`: standard/compact/list/minimal) numa
// lista de elementos editáveis.
//
// Por que existe: a página desenha esses templates em JSX, mas o "Montar
// etiqueta" só sabe editar `CardLayoutElement[]`. Sem esta ponte, um catálogo
// que nunca teve etiqueta montada mostra um card bonito na página e abre o
// editor em branco — que foi exatamente o relato.
//
// A conversão é uma APROXIMAÇÃO fiel na estrutura (o que aparece e em que
// ordem), não pixel a pixel: o template usa fluxo (flex/gap/line-clamp) e o
// editor usa posições absolutas em fração do card. Some o que o template só
// mostra condicionalmente (categoria, SKU, estoque) — quem quiser põe de volta
// pelo próprio editor.

/** Ordem de empilhamento: foto no fundo, textos por cima. */
const Z = { photo: 0, name: 1, price: 2, from: 3 } as const;

export function cardLayoutFromStyle(
  cardStyle: CatalogConfig["cardStyle"],
  opts?: { textColor?: string },
): CardLayoutElement[] {
  const cor = opts?.textColor ?? "#111111";
  const el = (p: Partial<CardLayoutElement>) =>
    makeCardElement({ kind: "var", color: cor, ...p });

  switch (cardStyle) {
    // Foto quadrada no topo, nome e preço embaixo — o mais usado.
    case "standard":
      return [
        el({
          variable: "photo",
          x: 0.04,
          y: 0.03,
          w: 0.92,
          h: 0.5,
          z: Z.photo,
        }),
        el({
          variable: "name",
          x: 0.06,
          y: 0.57,
          w: 0.88,
          h: 0.14,
          fontFrac: 0.07,
          fontWeight: 500,
          z: Z.name,
        }),
        el({
          variable: "priceActive",
          x: 0.06,
          y: 0.73,
          w: 0.88,
          h: 0.16,
          fontFrac: 0.12,
          fontWeight: 800,
          z: Z.price,
        }),
        el({
          variable: "priceFrom",
          x: 0.06,
          y: 0.89,
          w: 0.88,
          h: 0.08,
          fontFrac: 0.05,
          fontWeight: 400,
          z: Z.from,
        }),
      ];

    // Foto pequena à esquerda, nome e preço à direita.
    case "compact":
    case "list":
      return [
        el({
          variable: "photo",
          x: 0.03,
          y: 0.12,
          w: 0.3,
          h: 0.76,
          z: Z.photo,
        }),
        el({
          variable: "name",
          x: 0.37,
          y: 0.18,
          w: 0.6,
          h: 0.3,
          fontFrac: 0.13,
          fontWeight: 500,
          z: Z.name,
        }),
        el({
          variable: "priceActive",
          x: 0.37,
          y: 0.52,
          w: 0.6,
          h: 0.3,
          fontFrac: 0.2,
          fontWeight: 800,
          z: Z.price,
        }),
      ];

    // Só foto, nome e preço — tudo centralizado.
    default:
      return [
        el({
          variable: "photo",
          x: 0.08,
          y: 0.04,
          w: 0.84,
          h: 0.56,
          z: Z.photo,
        }),
        el({
          variable: "name",
          x: 0.06,
          y: 0.64,
          w: 0.88,
          h: 0.13,
          fontFrac: 0.07,
          fontWeight: 500,
          align: "center",
          z: Z.name,
        }),
        el({
          variable: "priceActive",
          x: 0.06,
          y: 0.79,
          w: 0.88,
          h: 0.16,
          fontFrac: 0.12,
          fontWeight: 800,
          align: "center",
          z: Z.price,
        }),
      ];
  }
}

/** Rótulo do template embutido, para a UI dizer de onde o card vem. */
export function cardStyleLabel(cardStyle: CatalogConfig["cardStyle"]): string {
  switch (cardStyle) {
    case "standard":
      return "Padrão";
    case "compact":
      return "Compacto";
    case "list":
      return "Lista";
    case "minimal":
      return "Minimalista";
    default:
      return "Padrão";
  }
}
