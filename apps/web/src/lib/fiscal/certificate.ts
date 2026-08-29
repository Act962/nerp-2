import "server-only";

import forge from "node-forge";
import { unformatCNPJ } from "@/utils/format-cnpj";

/**
 * Leitura do certificado digital A1 (.pfx / PKCS#12) em JS puro.
 *
 * Por que `node-forge` e não `openssl`: o Node não sabe abrir PKCS#12 nativamente,
 * e chamar o binário do sistema quebra em duas frentes — serverless não tem
 * `openssl`, e o LibreSSL do macOS recusa PKCS#12 legado (RC2-40-CBC), que é o
 * formato da maioria dos A1 emitidos no Brasil. Em JS puro os dois casos passam.
 *
 * Só LEITURA de metadados aqui. Assinatura de XML entra com o driver de emissão.
 */

export type CertificateErrorCode =
  | "WRONG_PASSWORD"
  | "INVALID_FILE"
  | "NO_CERTIFICATE";

export class CertificateError extends Error {
  readonly code: CertificateErrorCode;
  constructor(code: CertificateErrorCode, message: string) {
    super(message);
    this.name = "CertificateError";
    this.code = code;
  }
}

export type ParsedCertificate = {
  /** CN do titular, como veio no certificado (ex.: "LOJA X LTDA:12345678000195"). */
  subjectName: string;
  /** CN da autoridade certificadora. */
  issuerName: string;
  /** CNPJ do titular, só dígitos. `null` em e-CPF ou certificado sem o campo. */
  cnpj: string | null;
  notBefore: Date;
  notAfter: Date;
};

/** OID do CNPJ do titular no subjectAltName (padrão ICP-Brasil). */
const OID_CNPJ_ICP_BRASIL = "2.16.76.1.3.3";

/**
 * Abre o .pfx e devolve os metadados do certificado do titular.
 *
 * Lança `CertificateError` com código — o chamador distingue "senha errada"
 * (erro do usuário, mensagem clara) de "arquivo inválido".
 */
export function parsePfx(pfx: Buffer, password: string): ParsedCertificate {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    // O forge trabalha com "binary string", não Buffer.
    const asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfx.toString("binary")),
    );
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch (error) {
    // O forge não distingue: senha errada e arquivo corrompido caem no mesmo
    // throw. A mensagem dele é o único sinal disponível.
    const message = error instanceof Error ? error.message : String(error);
    if (
      /mac could not be verified|invalid password|Invalid password/i.test(
        message,
      )
    )
      throw new CertificateError(
        "WRONG_PASSWORD",
        "Senha do certificado incorreta",
      );
    throw new CertificateError(
      "INVALID_FILE",
      "Arquivo não é um certificado A1 (.pfx) válido",
    );
  }

  const cert = pickHolderCertificate(p12);
  if (!cert)
    throw new CertificateError(
      "NO_CERTIFICATE",
      "O arquivo não contém nenhum certificado",
    );

  return {
    subjectName: fieldValue(cert.subject, "CN"),
    issuerName: fieldValue(cert.issuer, "CN"),
    cnpj: extractCnpj(cert),
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
  };
}

/**
 * O .pfx traz a cadeia inteira (titular + intermediárias + raiz). O titular é o
 * que NÃO assinou ninguém: procuramos o certificado cujo subject não aparece
 * como issuer de nenhum outro. Se a heurística falhar, cai no primeiro.
 */
function pickHolderCertificate(
  p12: forge.pkcs12.Pkcs12Pfx,
): forge.pki.Certificate | null {
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ];
  const certs = (bags ?? [])
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => !!cert);
  if (certs.length === 0) return null;

  const issuers = new Set(certs.map((c) => c.issuer.hash));
  return certs.find((c) => !issuers.has(c.subject.hash)) ?? certs[0];
}

function fieldValue(
  name: forge.pki.Certificate["subject"],
  shortName: string,
): string {
  const field = name.getField({ shortName });
  return typeof field?.value === "string" ? field.value : "";
}

/**
 * CNPJ do titular. Duas fontes, nesta ordem:
 *
 * 1. `subjectAltName` com o OID 2.16.76.1.3.3 — o lugar oficial na ICP-Brasil.
 *    O forge não decodifica `otherName`, então varremos o valor bruto da
 *    extensão atrás da sequência de 14 dígitos que segue o OID.
 * 2. O CN, que na prática vem como "RAZAO SOCIAL:CNPJ".
 */
function extractCnpj(cert: forge.pki.Certificate): string | null {
  const altName = cert.extensions.find((e) => e.name === "subjectAltName");
  const raw = typeof altName?.value === "string" ? altName.value : "";
  if (raw) {
    const derOid = forge.asn1.oidToDer(OID_CNPJ_ICP_BRASIL).getBytes();
    const at = raw.indexOf(derOid);
    if (at >= 0) {
      const digits = raw.slice(at + derOid.length).match(/\d{14}/);
      if (digits) return digits[0];
    }
  }

  const cn = fieldValue(cert.subject, "CN");
  const fromCn = cn.split(":")[1]?.match(/\d{14}/);
  return fromCn ? fromCn[0] : null;
}

/** O certificado já venceu (ou vence antes de `reference`)? */
export function isExpired(cert: ParsedCertificate, reference: Date): boolean {
  return cert.notAfter.getTime() <= reference.getTime();
}

/**
 * O CNPJ do certificado bate com o cadastrado na configuração fiscal?
 *
 * Certificado de outra empresa é rejeitado no upload de propósito: descoberto
 * aqui é um erro de tela; descoberto na primeira venda é incidente fiscal.
 * Certificado sem CNPJ (e-CPF) não é aceito para emissão.
 */
export function matchesCnpj(
  cert: ParsedCertificate,
  configuredCnpj: string | null | undefined,
): boolean {
  if (!cert.cnpj || !configuredCnpj) return false;
  return cert.cnpj === unformatCNPJ(configuredCnpj);
}
