import { type Uf, codigoIbgeDaUf, ufDoCodigoIbge } from "../uf/uf";

/**
 * Chave de acesso da NF-e / NFC-e: 44 dígitos.
 *
 * `cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)`
 *
 * É o identificador do documento e entra no QR Code, no DANFCe e em toda
 * consulta. Montar aqui — e não no servidor — é o que permite ao PDV offline
 * imprimir um cupom cuja chave é a mesma da nota transmitida depois.
 */

export type ModeloDocumento = 55 | 65;

/**
 * Tipo de emissão (`tpEmis`). Só os valores que este projeto emite; os demais
 * (2, 3, 5) são contingências de papel/FS-DA que o NERP não usa.
 */
export const TP_EMIS = {
  NORMAL: 1,
  CONTINGENCIA_SVC_AN: 6,
  CONTINGENCIA_SVC_RS: 7,
  /** Contingência offline da NFC-e — o caso do PDV sem internet. */
  CONTINGENCIA_OFFLINE_NFCE: 9,
} as const;

export type TpEmis = (typeof TP_EMIS)[keyof typeof TP_EMIS];

export type ChaveInput = {
  uf: Uf;
  /**
   * `dhEmi` no formato do XML (`YYYY-MM-DDThh:mm:ssTZD`), já no fuso do
   * emitente. O AAMM sai dos caracteres 0-6 da própria string: converter para
   * `Date` e ler o mês em UTC jogaria uma venda das 21h do dia 31 para o mês
   * seguinte, gerando chave inválida.
   */
  dhEmi: string;
  /** CNPJ do emitente, só dígitos. */
  cnpj: string;
  modelo: ModeloDocumento;
  serie: number;
  numero: number;
  tpEmis: TpEmis;
  /** Código numérico aleatório de 8 dígitos. */
  cNF: string;
};

export class ChaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChaveError";
  }
}

/** AAMM (ano e mês com 2 dígitos cada) a partir do `dhEmi` do XML. */
export function aammDeDhEmi(dhEmi: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(dhEmi);
  if (!match) throw new ChaveError(`dhEmi inválido: ${dhEmi}`);
  return match[1].slice(2) + match[2];
}

/**
 * Monta a chave completa (43 dígitos + DV).
 *
 * Valida o que a SEFAZ rejeitaria depois: `cNF` igual ao `nNF` é a rejeição
 * 539 na prática (NT 2019.001), e é fácil de produzir sem querer se alguém
 * "gerar" o cNF a partir do número da nota.
 */
export function montarChave(input: ChaveInput): string {
  const cnpj = somenteDigitos(input.cnpj);
  if (cnpj.length !== 14)
    throw new ChaveError(`CNPJ do emitente precisa ter 14 dígitos: ${cnpj}`);

  const cNF = somenteDigitos(input.cNF);
  if (cNF.length !== 8)
    throw new ChaveError(`cNF precisa ter 8 dígitos: ${input.cNF}`);
  if (Number(cNF) === input.numero)
    throw new ChaveError(
      "cNF não pode ser igual ao nNF (rejeição da SEFAZ — NT 2019.001)",
    );

  if (input.serie < 0 || input.serie > 999)
    throw new ChaveError(`Série fora da faixa 0-999: ${input.serie}`);
  if (input.numero < 1 || input.numero > 999_999_999)
    throw new ChaveError(`Número fora da faixa 1-999999999: ${input.numero}`);

  const base =
    zeros(codigoIbgeDaUf(input.uf), 2) +
    aammDeDhEmi(input.dhEmi) +
    cnpj +
    zeros(input.modelo, 2) +
    zeros(input.serie, 3) +
    zeros(input.numero, 9) +
    String(input.tpEmis) +
    cNF;

  return base + calcularDV(base);
}

/**
 * Dígito verificador módulo 11, pesos 2..9 da direita para a esquerda.
 * Resto 0 ou 1 → DV 0 (o caso que quase todo emissor caseiro erra).
 */
export function calcularDV(chave43: string): string {
  if (!/^\d{43}$/.test(chave43))
    throw new ChaveError("O DV é calculado sobre exatamente 43 dígitos");

  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return String(dv >= 10 ? 0 : dv);
}

/** A chave tem 44 dígitos e o DV confere? */
export function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  return calcularDV(chave.slice(0, 43)) === chave[43];
}

export type ChavePartes = {
  uf: Uf | null;
  aamm: string;
  cnpj: string;
  modelo: number;
  serie: number;
  numero: number;
  tpEmis: number;
  cNF: string;
  cDV: string;
};

/**
 * Desmonta a chave. Serve para rotear a transmissão pelo autorizador da UF e
 * para conferir, na volta da SEFAZ, que o protocolo é da nota que enviamos.
 */
export function partesDaChave(chave: string): ChavePartes {
  if (!/^\d{44}$/.test(chave))
    throw new ChaveError(`Chave de acesso precisa ter 44 dígitos: ${chave}`);
  return {
    uf: ufDoCodigoIbge(Number(chave.slice(0, 2))),
    aamm: chave.slice(2, 6),
    cnpj: chave.slice(6, 20),
    modelo: Number(chave.slice(20, 22)),
    serie: Number(chave.slice(22, 25)),
    numero: Number(chave.slice(25, 34)),
    tpEmis: Number(chave.slice(34, 35)),
    cNF: chave.slice(35, 43),
    cDV: chave.slice(43),
  };
}

function somenteDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

function zeros(value: number, tamanho: number): string {
  return String(value).padStart(tamanho, "0");
}
