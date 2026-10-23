import type { Alvo, CampoDoAlvo, Conversao } from "./alvos";

// Linha crua do banco → campos do NERP, com o motivo de cada falha.
//
// O adaptador entrega a linha já com as chaves dos campos do NERP (`codigo`,
// `preco`…) e datas como texto ISO; aqui só se decide se o valor serve. Falha
// é por campo, não por linha inteira: o Testar mostra "preço inválido na
// linha 3" em vez de esconder a linha.

export type ValorCru = string | number | boolean | null;
export type ValorConvertido = string | number | boolean | null;

export interface LinhaConvertida {
  valores: Record<string, ValorConvertido>;
  erros: string[];
}

const VERDADEIROS = new Set(["S", "SIM", "1", "Y", "YES", "TRUE", "T"]);

function vazio(valor: ValorCru): boolean {
  return valor === null || (typeof valor === "string" && valor.trim() === "");
}

function paraTexto(valor: ValorCru): string | null {
  if (vazio(valor)) return null;
  if (typeof valor === "number") {
    // Código numérico no ERP (CODPROD 108238) vira texto sem notação científica
    // nem ".0" — é o que casa com `Product.erpCode`.
    return Number.isInteger(valor) ? valor.toFixed(0) : String(valor);
  }
  return String(valor).trim();
}

function paraNumero(valor: ValorCru): number | null | "invalido" {
  if (valor === null || vazio(valor)) return null;
  if (typeof valor === "number")
    return Number.isFinite(valor) ? valor : "invalido";
  if (typeof valor === "boolean") return "invalido";
  // Texto com vírgula decimal ("21,45") e milhar com ponto ("1.234,50").
  const texto = valor.trim();
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : "invalido";
}

// Data do ERP sem fuso (o DATE do Oracle não tem): fica como veio. Converter
// para ISO/UTC aqui deslocaria o pedido de meia-noite para as 03:00.
const DATA_SEM_FUSO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

function paraData(valor: ValorCru): string | null | "invalido" {
  if (vazio(valor)) return null;
  if (typeof valor !== "string") return "invalido";
  const texto = valor.trim();
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return "invalido";
  return DATA_SEM_FUSO.test(texto) ? texto : data.toISOString();
}

/** GTIN-8/12/13/14 com o dígito verificador certo (algoritmo GS1). */
export function ehGtinValido(texto: string): boolean {
  if (!/^\d+$/.test(texto) || ![8, 12, 13, 14].includes(texto.length)) {
    return false;
  }
  // Tudo zero passa no dígito verificador, mas não é código de barras.
  if (/^0+$/.test(texto)) return false;
  const corpo = texto.slice(0, -1);
  const soma = [...corpo]
    .reverse()
    .reduce(
      (total, digito, indice) =>
        total + Number(digito) * (indice % 2 === 0 ? 3 : 1),
      0,
    );
  return (10 - (soma % 10)) % 10 === Number(texto[texto.length - 1]);
}

function converterTexto(
  texto: string | null,
  conversao: Conversao | undefined,
): string | null {
  if (texto === null || !conversao) return texto;
  const digitos = texto.replace(/\D/g, "");
  if (conversao === "somenteDigitos") return digitos || null;
  if (conversao === "gtinValido") return ehGtinValido(digitos) ? digitos : null;
  return texto;
}

function paraBooleano(valor: ValorCru, conversao: Conversao): boolean {
  if (conversao === "vazioEhVerdadeiro") return vazio(valor);
  if (conversao === "preenchidoEhVerdadeiro") return !vazio(valor);
  return VERDADEIROS.has(
    String(valor ?? "")
      .trim()
      .toUpperCase(),
  );
}

function converterCampo(
  campo: CampoDoAlvo,
  valor: ValorCru,
  conversao: Conversao | undefined,
): { valor: ValorConvertido; erro: string | null } {
  if (campo.tipo === "booleano") {
    if (!conversao) {
      return { valor: null, erro: `${campo.rotulo}: falta a conversão.` };
    }
    return { valor: paraBooleano(valor, conversao), erro: null };
  }
  if (campo.tipo === "texto") {
    return { valor: converterTexto(paraTexto(valor), conversao), erro: null };
  }
  if (campo.tipo === "numero") {
    const numero = paraNumero(valor);
    return numero === "invalido"
      ? { valor: null, erro: `${campo.rotulo}: "${valor}" não é número.` }
      : { valor: numero, erro: null };
  }
  const data = paraData(valor);
  return data === "invalido"
    ? { valor: null, erro: `${campo.rotulo}: "${valor}" não é data.` }
    : { valor: data, erro: null };
}

/**
 * Converte só os campos mapeados (os presentes na linha). Obrigatório que veio
 * vazio é erro: o sync descartaria essa linha.
 */
export function converterLinha(
  alvo: Alvo,
  linha: Record<string, ValorCru>,
  conversoes: Partial<Record<string, Conversao>>,
): LinhaConvertida {
  const valores: Record<string, ValorConvertido> = {};
  const erros: string[] = [];

  for (const campo of alvo.campos) {
    if (!(campo.chave in linha)) continue;
    const { valor, erro } = converterCampo(
      campo,
      linha[campo.chave] ?? null,
      conversoes[campo.chave],
    );
    valores[campo.chave] = valor;
    if (erro) erros.push(erro);
    else if (campo.obrigatorio && valor === null) {
      erros.push(`${campo.rotulo}: vazio.`);
    }
  }

  return { valores, erros };
}
