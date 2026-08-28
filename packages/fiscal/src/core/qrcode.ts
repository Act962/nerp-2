import { sha1Hex } from "./sha1";

/**
 * QR Code do DANFE NFC-e.
 *
 * Duas versões convivem hoje:
 *
 * - **v2** (Manual de Padrões 5.0) — autenticidade por hash SHA-1 sobre os
 *   campos + CSC, o segredo compartilhado com a SEFAZ da UF.
 * - **v3** (NT 2025.001, Manual 6.00 de março/2025) — o CSC sai de cena. Online
 *   o QR vira só `chave|3|tpAmb`; em contingência a autenticidade passa a ser
 *   uma **assinatura RSA-SHA1 dos próprios campos do QR**, feita com o mesmo
 *   certificado que assina a NFC-e.
 *
 * A consequência prática da v3 é o desenho inteiro da contingência offline:
 * o dispositivo precisa conseguir ASSINAR, não basta ter o CSC. Por isso a
 * assinatura entra aqui como função injetada (`assinar`) — o servidor liga a
 * sua implementação com node-forge, o app Tauri liga um comando Rust que guarda
 * a chave no keyring do SO. Este módulo nunca vê material criptográfico.
 *
 * Rejeições relacionadas: 445 (assinatura informada onde não devia), 474
 * (faltou assinatura), 496/855 (assinatura não confere), 464 (hash não confere).
 */

export type QrVersao = 2 | 3;

/** Ambiente da SEFAZ: 1 = produção, 2 = homologação. */
export type TpAmb = 1 | 2;

/** Tipo do documento do destinatário no QR v3. Vazio = não identificado. */
export type TpIdDest = 1 | 2 | 3 | "";

export class QrCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrCodeError";
  }
}

export type QrCodeResult = {
  /** Conteúdo depois do `?p=` — é sobre ele que a SEFAZ valida. */
  payload: string;
  /** URL completa que vai no `<qrCode>` e é impressa no cupom. */
  url: string;
};

type Comum = {
  /** URL de consulta do QR da UF (com ou sem `?p=`). */
  urlConsulta: string;
  chNFe: string;
  tpAmb: TpAmb;
};

export type QrOnlineInput = Comum & {
  versao: QrVersao;
  /** Identificador do CSC. Só usado na v2 — a v3 online dispensa. */
  cscId?: string;
  /** CSC. Só usado na v2. */
  csc?: string;
};

export type QrContingenciaV2Input = Comum & {
  versao: 2;
  /** `dhEmi` do XML — só o dia é usado, e sai direto da string. */
  dhEmi: string;
  vNF: number | string;
  /** `DigestValue` da assinatura, em base64, exatamente como está no XML. */
  digVal: string;
  cscId: string;
  csc: string;
};

export type QrContingenciaV3Input = Comum & {
  versao: 3;
  dhEmi: string;
  vNF: number | string;
  /** 1 = CNPJ, 2 = CPF, 3 = estrangeiro, "" = consumidor não identificado. */
  tpIdDest: TpIdDest;
  /** Documento do destinatário. Vazio para estrangeiro ou não identificado. */
  cDest: string;
  /** Assina os campos do QR e devolve a assinatura em base64 (RSA-SHA1). */
  assinar: (payload: string) => string;
};

/** QR da NFC-e emitida online (`tpEmis` diferente de 9). */
export function qrCodeOnline(input: QrOnlineInput): QrCodeResult {
  const { chNFe, tpAmb, versao } = input;
  exigeChave(chNFe);

  if (versao === 3) {
    // A v3 online não leva CSC nem hash: a SEFAZ já tem a nota autorizada, e o
    // QR só precisa apontar para ela.
    return montar(input.urlConsulta, `${chNFe}|3|${tpAmb}`);
  }

  const { cscId, csc } = exigeCsc(input.cscId, input.csc);
  const seq = `${chNFe}|2|${tpAmb}|${cscId}`;
  return montar(input.urlConsulta, `${seq}|${sha1Hex(seq + csc)}`);
}

/** QR da NFC-e em contingência offline (`tpEmis=9`), layout v2. */
export function qrCodeContingenciaV2(
  input: QrContingenciaV2Input,
): QrCodeResult {
  exigeChave(input.chNFe);
  const { cscId, csc } = exigeCsc(input.cscId, input.csc);
  if (!input.digVal)
    throw new QrCodeError(
      "digVal é obrigatório na contingência: o QR impresso precisa referenciar a mesma assinatura que será transmitida",
    );

  const seq = [
    input.chNFe,
    "2",
    input.tpAmb,
    diaDeDhEmi(input.dhEmi),
    formatarValor(input.vNF),
    paraHex(input.digVal),
    cscId,
  ].join("|");

  return montar(input.urlConsulta, `${seq}|${sha1Hex(seq + csc)}`);
}

/** QR da NFC-e em contingência offline (`tpEmis=9`), layout v3 (NT 2025.001). */
export function qrCodeContingenciaV3(
  input: QrContingenciaV3Input,
): QrCodeResult {
  exigeChave(input.chNFe);

  // Estrangeiro e não identificado não levam documento — só o separador.
  const cDest =
    input.tpIdDest === 3 || input.tpIdDest === "" ? "" : input.cDest;

  const assinavel = [
    input.chNFe,
    "3",
    input.tpAmb,
    diaDeDhEmi(input.dhEmi),
    formatarValor(input.vNF),
    input.tpIdDest,
    cDest,
  ].join("|");

  const assinatura = input.assinar(assinavel);
  if (!assinatura)
    throw new QrCodeError(
      "Assinatura vazia: a v3 em contingência é recusada sem ela (rejeição 474)",
    );

  return montar(input.urlConsulta, `${assinavel}|${assinatura}`);
}

/**
 * Bloco `<infNFeSupl>`, que entra depois de `</infNFe>` e antes de
 * `<Signature>`.
 */
export function infNFeSupl(qrCode: string, urlChave: string): string {
  return `<infNFeSupl><qrCode>${escaparXml(qrCode)}</qrCode><urlChave>${escaparXml(urlChave)}</urlChave></infNFeSupl>`;
}

/**
 * Dia do mês (2 dígitos) direto da string `dhEmi`.
 *
 * Mesmo motivo do AAMM da chave: converter para `Date` e ler o dia em UTC
 * moveria uma venda das 21h para o dia seguinte, e o QR impresso deixaria de
 * bater com o transmitido.
 */
export function diaDeDhEmi(dhEmi: string): string {
  const match = /^\d{4}-\d{2}-(\d{2})/.exec(dhEmi);
  if (!match) throw new QrCodeError(`dhEmi inválido: ${dhEmi}`);
  return match[1];
}

/** Valor com exatamente 2 casas e ponto decimal, como o `vNF` do XML. */
export function formatarValor(valor: number | string): string {
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero))
    throw new QrCodeError(`Valor inválido para o QR: ${valor}`);
  return numero.toFixed(2);
}

/** ASCII → hexadecimal minúsculo. O `digVal` entra hexado no QR v2. */
export function paraHex(valor: string): string {
  let out = "";
  for (let i = 0; i < valor.length; i++)
    out += valor.charCodeAt(i).toString(16).padStart(2, "0");
  return out;
}

function montar(urlConsulta: string, payload: string): QrCodeResult {
  const base = urlConsulta.includes("?p=") ? urlConsulta : `${urlConsulta}?p=`;
  return { payload, url: `${base}${payload}` };
}

function exigeChave(chNFe: string): void {
  if (!/^\d{44}$/.test(chNFe))
    throw new QrCodeError(`Chave de acesso inválida no QR: ${chNFe}`);
}

/** O `cscId` vai no QR como inteiro — "000001" viraria hash errado. */
function exigeCsc(
  cscId: string | undefined,
  csc: string | undefined,
): { cscId: string; csc: string } {
  if (!cscId || !csc)
    throw new QrCodeError(
      "CSC e cscId são obrigatórios no QR v2. Gere-os no portal da SEFAZ da UF.",
    );
  const numero = Number(cscId);
  if (!Number.isInteger(numero) || numero <= 0)
    throw new QrCodeError(`cscId inválido: ${cscId}`);
  return { cscId: String(numero), csc };
}

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
