/**
 * As cores da vitrine.
 *
 * Módulo neutro (sem `server-only`): o painel do admin e a loja pública usam a
 * mesma conta de contraste. Duas contas diferentes seria a forma mais fácil de
 * o preview do painel mostrar um texto legível e a loja mostrar outro.
 */

/** O fundo de quem nunca escolheu cor: o neutro claro que a loja já tinha. */
export const FUNDO_PADRAO_CATALOGO = "#f5f5f5";

/** A cor de tema de quem nunca escolheu nenhuma — o mesmo default do banco. */
export const TEMA_PADRAO_CATALOGO = "#00bcd4";

export function isHexValido(valor: string | null | undefined): valor is string {
  return !!valor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(valor.trim());
}

function canais(hex: string): [number, number, number] {
  const limpo = hex.trim().replace("#", "");
  const cheio =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  return [
    Number.parseInt(cheio.slice(0, 2), 16),
    Number.parseInt(cheio.slice(2, 4), 16),
    Number.parseInt(cheio.slice(4, 6), 16),
  ];
}

/**
 * A luminância relativa da WCAG. É ela, e não a média dos canais, que decide
 * se um fundo é escuro: o verde puro pesa dez vezes mais que o azul puro para
 * o olho, e a média trataria os dois como o mesmo cinza.
 */
export function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((canal) => {
    const v = canal / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A tinta que se lê sobre este fundo. */
export function tintaSobre(hex: string): string {
  return luminancia(hex) > 0.45 ? "#111111" : "#fafafa";
}

/** O fundo é escuro a ponto de exigir texto claro? */
export function fundoEscuro(hex: string): boolean {
  return luminancia(hex) <= 0.45;
}
