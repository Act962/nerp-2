import type { CrmTemperature } from "@/generated/prisma/enums";

/**
 * A condição do nó `FILTER`.
 *
 * Deliberadamente pequena: campo, operador, valor. O Órbita aceita expressão
 * livre com `{{variável}}`, o que é poderoso e é também a forma mais rápida de
 * um operador montar uma condição que nunca bate e não descobrir por quê.
 * Aqui o conjunto é fechado e a tela consegue oferecer os valores possíveis.
 */

export const CAMPOS = [
  "temperatura",
  "etapa",
  "responsavel",
  "cliente",
  "texto_da_mensagem",
  "valor",
] as const;

export type Campo = (typeof CAMPOS)[number];

export const OPERADORES = [
  "igual",
  "diferente",
  "contem",
  "existe",
  "nao_existe",
  "maior_que",
  "menor_que",
] as const;

export type Operador = (typeof OPERADORES)[number];

export type Condicao = {
  campo: Campo;
  operador: Operador;
  valor?: string;
};

/** O que o motor sabe sobre o lead no momento em que o filtro é avaliado. */
export type ContextoDaCondicao = {
  temperatura: CrmTemperature;
  stageId: string;
  responsibleId: string | null;
  customerId: string | null;
  /** Texto da mensagem que disparou, quando o gatilho foi de mensagem. */
  textoDaMensagem: string | null;
  /** Valor potencial do negócio, em reais. */
  valor: number;
};

export function avaliar(
  condicao: Condicao,
  contexto: ContextoDaCondicao,
): boolean {
  const bruto = valorDoCampo(condicao.campo, contexto);
  const esperado = (condicao.valor ?? "").trim();

  switch (condicao.operador) {
    case "existe":
      return preenchido(bruto);
    case "nao_existe":
      return !preenchido(bruto);
    case "igual":
      return texto(bruto) === esperado.toLowerCase();
    case "diferente":
      return texto(bruto) !== esperado.toLowerCase();
    case "contem":
      // Contém com valor vazio seria verdadeiro para tudo — o que parece
      // "filtro ligado" e deixa passar todo mundo.
      return (
        esperado.length > 0 && texto(bruto).includes(esperado.toLowerCase())
      );
    case "maior_que":
      return numero(bruto) > Number(esperado);
    case "menor_que":
      return numero(bruto) < Number(esperado);
    default:
      return false;
  }
}

function valorDoCampo(
  campo: Campo,
  contexto: ContextoDaCondicao,
): string | number | null {
  switch (campo) {
    case "temperatura":
      return contexto.temperatura;
    case "etapa":
      return contexto.stageId;
    case "responsavel":
      return contexto.responsibleId;
    case "cliente":
      return contexto.customerId;
    case "texto_da_mensagem":
      return contexto.textoDaMensagem;
    case "valor":
      return contexto.valor;
    default:
      return null;
  }
}

function preenchido(valor: string | number | null): boolean {
  if (valor === null) return false;
  if (typeof valor === "number") return valor !== 0;
  return valor.trim().length > 0;
}

function texto(valor: string | number | null): string {
  return String(valor ?? "").toLowerCase();
}

function numero(valor: string | number | null): number {
  const convertido = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}
