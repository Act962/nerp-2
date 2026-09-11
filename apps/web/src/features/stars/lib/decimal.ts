/**
 * ★ com fração: a conversão na fronteira, num lugar só.
 *
 * O saldo, o preço e o extrato passaram a ser `Decimal` no banco porque o
 * preço por bloco de tokens não cabe em inteiro — 1 ★ por 1.000 tokens é caro
 * demais, e 0 desliga a cobrança. O Prisma devolve esses campos como objeto
 * `Decimal`, que não soma, não compara e não vira JSON sozinho.
 *
 * Então a regra é: **Decimal morre na fronteira**. Sai do banco, passa por
 * aqui, e a partir daí é número comum — do mesmo jeito que o resto do sistema
 * trata `Decimal` de preço de produto.
 *
 * Módulo neutro, sem `server-only`: a tela de preços arredonda com a mesma
 * função que o motor de cobrança, e duas regras de arredondamento seriam duas
 * contas diferentes para o mesmo débito.
 */

/** Quantas casas uma ★ tem. Abaixo de 0,01 a conta vira ruído. */
export const CASAS_DA_ESTRELA = 2;

const FATOR = 10 ** CASAS_DA_ESTRELA;

type ComoDecimal = { toNumber(): number };

function pareceDecimal(valor: unknown): valor is ComoDecimal {
  return (
    typeof valor === "object" &&
    valor !== null &&
    typeof (valor as ComoDecimal).toNumber === "function"
  );
}

/** O valor em ★, como número. Nulo e indefinido viram zero. */
export function emEstrelas(
  valor: ComoDecimal | number | string | null | undefined,
): number {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    const lido = Number(valor);
    return Number.isFinite(lido) ? lido : 0;
  }
  if (pareceDecimal(valor)) return valor.toNumber();
  return 0;
}

/**
 * Arredonda para as casas da ★.
 *
 * Meio centésimo para cima, e o `Number.EPSILON` porque `0,1 + 0,2` em ponto
 * flutuante é `0,30000000000000004`: sem ele, um débito de 0,3 ★ gravaria
 * 0,3 numa hora e 0,29 noutra, e o extrato deixaria de fechar.
 */
export function arredondarEstrelas(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round((valor + Number.EPSILON) * FATOR) / FATOR;
}

/**
 * Lê o que a pessoa digitou no campo de preço.
 *
 * Aceita vírgula: em pt-BR ninguém digita "0.2". Devolve `null` quando o que
 * está lá não é número — o campo mostra o erro em vez de gravar zero, que
 * silenciosamente DESLIGARIA a cobrança daquela ação.
 */
export function lerEstrelasDigitadas(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (limpo === "") return null;
  const numero = Number(limpo);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return arredondarEstrelas(numero);
}

/** Como uma ★ aparece na tela: sem casas quando é inteira, com duas quando não. */
export function formatarEstrelas(valor: ComoDecimal | number): string {
  const numero = emEstrelas(valor);
  return Number.isInteger(numero)
    ? String(numero)
    : numero.toLocaleString("pt-BR", {
        minimumFractionDigits: CASAS_DA_ESTRELA,
        maximumFractionDigits: CASAS_DA_ESTRELA,
      });
}
