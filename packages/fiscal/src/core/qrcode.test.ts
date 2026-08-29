import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  QrCodeError,
  diaDeDhEmi,
  formatarValor,
  infNFeSupl,
  paraHex,
  qrCodeContingenciaV2,
  qrCodeContingenciaV3,
  qrCodeOnline,
} from "./qrcode";

/**
 * As estruturas conferidas contra o `sped-nfe` (referência de mercado, que cita
 * o Manual de Padrões 5.0 para a v2 e o 6.00 / NT 2025.001 para a v3):
 *
 *   v2 online       chNFe|2|tpAmb|cscId|HASH
 *   v2 contingência chNFe|2|tpAmb|dia|vNF|digValHex|cscId|HASH
 *   v3 online       chNFe|3|tpAmb
 *   v3 contingência chNFe|3|tpAmb|dia|vNF|tpIdDest|cDest|ASSINATURA
 */

const URL_PI = "https://webas.sefaz.pi.gov.br/nfce-web/consultarNFCe.seam";
const CHAVE = "22260812345678000195650010000000421102030407";
const CSC = "SEGREDO-COMPARTILHADO-COM-A-SEFAZ";
const CSC_ID = "000001";

const sha1Ref = (s: string) =>
  createHash("sha1").update(s).digest("hex").toUpperCase();

describe("qrCodeOnline — v2", () => {
  const resultado = qrCodeOnline({
    urlConsulta: URL_PI,
    chNFe: CHAVE,
    tpAmb: 2,
    versao: 2,
    cscId: CSC_ID,
    csc: CSC,
  });

  it("monta chNFe|2|tpAmb|cscId|HASH", () => {
    const seq = `${CHAVE}|2|2|1`;
    expect(resultado.payload).toBe(`${seq}|${sha1Ref(seq + CSC)}`);
  });

  it("usa o cscId como inteiro, sem zeros à esquerda", () => {
    // "000001" no hash produziria um QR que a SEFAZ recusa (rejeição 464).
    expect(resultado.payload).toContain("|1|");
    expect(resultado.payload).not.toContain("|000001|");
  });

  it("anexa o payload à URL de consulta", () => {
    expect(resultado.url).toBe(`${URL_PI}?p=${resultado.payload}`);
  });

  it("não duplica o ?p= quando a URL já o tem", () => {
    const comP = qrCodeOnline({
      urlConsulta: `${URL_PI}?p=`,
      chNFe: CHAVE,
      tpAmb: 1,
      versao: 2,
      cscId: CSC_ID,
      csc: CSC,
    });
    expect(comP.url.match(/\?p=/g)).toHaveLength(1);
  });

  it("exige CSC", () => {
    expect(() =>
      qrCodeOnline({ urlConsulta: URL_PI, chNFe: CHAVE, tpAmb: 2, versao: 2 }),
    ).toThrow(/CSC/);
  });
});

describe("qrCodeOnline — v3", () => {
  it("é só chave|3|tpAmb, sem CSC nem hash", () => {
    // O ponto da NT 2025.001: a v3 online elimina o segredo compartilhado.
    const { payload } = qrCodeOnline({
      urlConsulta: URL_PI,
      chNFe: CHAVE,
      tpAmb: 1,
      versao: 3,
    });
    expect(payload).toBe(`${CHAVE}|3|1`);
  });
});

describe("qrCodeContingenciaV2", () => {
  const digVal = "kV8Xl0h1p2q3r4s5t6u7v8w9x0y1z2A=";
  const { payload } = qrCodeContingenciaV2({
    urlConsulta: URL_PI,
    chNFe: CHAVE,
    tpAmb: 2,
    versao: 2,
    dhEmi: "2026-08-28T16:30:00-03:00",
    vNF: 200.1,
    digVal,
    cscId: CSC_ID,
    csc: CSC,
  });

  it("monta chNFe|2|tpAmb|dia|vNF|digValHex|cscId|HASH", () => {
    const seq = `${CHAVE}|2|2|28|200.10|${paraHex(digVal)}|1`;
    expect(payload).toBe(`${seq}|${sha1Ref(seq + CSC)}`);
  });

  it("usa só o DIA, não a data inteira", () => {
    // Divergência real encontrada em `@brasil-fiscal/nfe`, que hexa o `dhEmi`
    // completo. O MOC pede o dia do mês em 2 dígitos, sem hex.
    const campos = payload.split("|");
    expect(campos[3]).toBe("28");
  });

  it("formata o valor com duas casas e ponto", () => {
    expect(payload.split("|")[4]).toBe("200.10");
  });

  it("exige digVal — sem ele o QR impresso não referencia a assinatura", () => {
    expect(() =>
      qrCodeContingenciaV2({
        urlConsulta: URL_PI,
        chNFe: CHAVE,
        tpAmb: 2,
        versao: 2,
        dhEmi: "2026-08-28T16:30:00-03:00",
        vNF: 10,
        digVal: "",
        cscId: CSC_ID,
        csc: CSC,
      }),
    ).toThrow(/digVal/);
  });
});

describe("qrCodeContingenciaV3", () => {
  const base = {
    urlConsulta: URL_PI,
    chNFe: CHAVE,
    tpAmb: 2 as const,
    versao: 3 as const,
    dhEmi: "2026-08-28T16:30:00-03:00",
    vNF: 200.12,
  };

  it("assina os campos e anexa a assinatura em base64", () => {
    let assinado = "";
    const { payload } = qrCodeContingenciaV3({
      ...base,
      tpIdDest: 2,
      cDest: "52998224725",
      assinar: (p) => {
        assinado = p;
        return "QVNTSU5BVFVSQQ==";
      },
    });

    expect(assinado).toBe(`${CHAVE}|3|2|28|200.12|2|52998224725`);
    expect(payload).toBe(`${assinado}|QVNTSU5BVFVSQQ==`);
  });

  it("consumidor não identificado deixa os dois campos vazios", () => {
    const { payload } = qrCodeContingenciaV3({
      ...base,
      tpIdDest: "",
      cDest: "",
      assinar: () => "QQ==",
    });
    expect(payload).toBe(`${CHAVE}|3|2|28|200.12|||QQ==`);
  });

  it("estrangeiro não leva o documento, só o separador", () => {
    let assinado = "";
    qrCodeContingenciaV3({
      ...base,
      tpIdDest: 3,
      cDest: "PASSAPORTE123",
      assinar: (p) => {
        assinado = p;
        return "QQ==";
      },
    });
    expect(assinado).toBe(`${CHAVE}|3|2|28|200.12|3|`);
  });

  it("recusa assinatura vazia (rejeição 474)", () => {
    expect(() =>
      qrCodeContingenciaV3({
        ...base,
        tpIdDest: "",
        cDest: "",
        assinar: () => "",
      }),
    ).toThrow(/474/);
  });
});

describe("helpers", () => {
  it("diaDeDhEmi não desloca por fuso", () => {
    // 21h em Teresina é o dia seguinte em UTC.
    expect(diaDeDhEmi("2026-08-31T21:00:00-03:00")).toBe("31");
    expect(() => diaDeDhEmi("28/08/2026")).toThrow(QrCodeError);
  });

  it("formatarValor sempre com duas casas", () => {
    expect(formatarValor(5)).toBe("5.00");
    expect(formatarValor("10.5")).toBe("10.50");
    expect(formatarValor(0.005)).toBe("0.01");
    expect(() => formatarValor("abc")).toThrow(QrCodeError);
  });

  it("paraHex converte ASCII byte a byte", () => {
    expect(paraHex("A=")).toBe("413d");
    expect(paraHex("")).toBe("");
  });

  it("chave inválida é recusada antes de gerar o QR", () => {
    expect(() =>
      qrCodeOnline({
        urlConsulta: URL_PI,
        chNFe: "123",
        tpAmb: 1,
        versao: 3,
      }),
    ).toThrow(/Chave de acesso inválida/);
  });

  it("infNFeSupl escapa o & da URL", () => {
    // O QR entra como texto no XML; um `&` cru quebraria o parse.
    const bloco = infNFeSupl("http://x?p=1&y=2", "http://x/chave");
    expect(bloco).toContain("&amp;y=2");
    expect(bloco).toMatch(/^<infNFeSupl><qrCode>.*<\/urlChave><\/infNFeSupl>$/);
  });
});
