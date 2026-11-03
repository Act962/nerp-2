import type { TipoDoNerp } from "../domain/alvos";

/**
 * Conferência do lado do NERP: dos códigos que vieram do ERP, quais já existem
 * aqui. É o que dá confiança no Testar — "o código bate com o cadastro".
 */
export interface ConferenciaNoNerpPort {
  /** null quando o tipo ainda não tem vínculo por código no NERP. */
  codigosExistentes(
    tipo: TipoDoNerp,
    codigos: string[],
  ): Promise<Set<string> | null>;
}
