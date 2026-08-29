import forge from "node-forge";

/**
 * Gera um .pfx autoassinado em memória para os testes.
 *
 * Existe para não versionar binário de certificado no repositório e para poder
 * variar CNPJ e validade por caso de teste (expirado, sem CNPJ, outro titular).
 * Chave de 1024 bits: só precisa ser estruturalmente válida, e 2048 levaria
 * segundos em cada `beforeAll`.
 */

/** OID do CNPJ do titular no subjectAltName (padrão ICP-Brasil). */
const OID_CNPJ_ICP_BRASIL = "2.16.76.1.3.3";

export type TestPfxOptions = {
  /** CNPJ só com dígitos. `null` simula um e-CPF (sem o campo). */
  cnpj?: string | null;
  /**
   * Emitir o `subjectAltName` com o OID do CNPJ. `false` simula os A1 antigos,
   * que só trazem o CNPJ colado no CN.
   */
  withAltName?: boolean;
  razaoSocial?: string;
  notBefore?: Date;
  notAfter?: Date;
  password?: string;
};

export type TestPfx = {
  pfx: Buffer;
  password: string;
  cnpj: string | null;
  notBefore: Date;
  notAfter: Date;
};

export function makeTestPfx(options: TestPfxOptions = {}): TestPfx {
  const {
    cnpj = "12345678000195",
    razaoSocial = "LOJA TESTE LTDA",
    notBefore = new Date("2026-01-01T00:00:00Z"),
    notAfter = new Date("2027-01-01T00:00:00Z"),
    password = "senha-de-teste",
    withAltName = true,
  } = options;

  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;

  // O CN da ICP-Brasil vem como "RAZAO SOCIAL:CNPJ" — é o fallback do parser.
  const commonName = cnpj ? `${razaoSocial}:${cnpj}` : razaoSocial;
  cert.setSubject([{ shortName: "CN", value: commonName }]);
  cert.setIssuer([{ shortName: "CN", value: "AC TESTE v1" }]);

  if (cnpj && withAltName)
    cert.setExtensions([
      { name: "subjectAltName", altNames: [cnpjOtherName(cnpj)] },
    ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "3des",
  });
  const der = forge.asn1.toDer(p12).getBytes();

  return {
    pfx: Buffer.from(der, "binary"),
    password,
    cnpj,
    notBefore,
    notAfter,
  };
}

/**
 * `otherName` com o OID do CNPJ, como a ICP-Brasil emite.
 *
 * O forge não serializa `otherName` estruturado: ele embrulha `value` num
 * CONTEXT_SPECIFIC do `type` informado e escreve os bytes crus. Então passamos
 * o DER da SEQUENCE { OID, [0] { PrintableString } } já pronto.
 */
function cnpjOtherName(cnpj: string): { type: number; value: string } {
  const { asn1 } = forge;
  const sequence = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.OID,
      false,
      asn1.oidToDer(OID_CNPJ_ICP_BRASIL).getBytes(),
    ),
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.PRINTABLESTRING, false, cnpj),
    ]),
  ]);
  return { type: 0, value: asn1.toDer(sequence).getBytes() };
}
