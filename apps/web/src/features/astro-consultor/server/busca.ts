import {
  type BuscaFerramentas,
  buscarFerramentas,
  type FerramentaEncontrada,
} from "@nerp/site-content";

/**
 * A busca por ferramenta, com a fala do visitante mandando.
 *
 * O modelo parafraseia, e a paráfrase troca o resultado: numa conversa real o
 * visitante disse "o encarte da semana demora dois dias" e o modelo buscou por
 * "criação de materiais promocionais" — a busca devolveu Pages e Planner em
 * vez do Catálogo Promocional. A busca estava certa; o que chegou nela é que
 * já não era a dor do cliente.
 *
 * Então rodam as duas: a fala do visitante primeiro, e o que o modelo escreveu
 * completando o que faltou. Quem sabe descrever o problema é quem o tem.
 */
export function buscarComAFalaDoVisitante(
  entrada: BuscaFerramentas,
  falaDoVisitante: string,
): FerramentaEncontrada[] {
  const pelaFala = falaDoVisitante.trim()
    ? buscarFerramentas({ ...entrada, dor: falaDoVisitante })
    : [];
  const peloModelo = entrada.dor?.trim() ? buscarFerramentas(entrada) : [];

  const vistos = new Set(pelaFala.map((item) => item.id));
  return [
    ...pelaFala,
    ...peloModelo.filter((item) => !vistos.has(item.id)),
  ].slice(0, entrada.limite ?? 6);
}
