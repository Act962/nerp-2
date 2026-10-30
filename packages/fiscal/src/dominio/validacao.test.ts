import { describe, expect, it } from "vitest";
import { notaDeExemplo } from "../testes/nota-de-exemplo";
import type { ItemNota, NotaFiscal } from "./nota-fiscal";
import { validarNotaParaEmissao } from "./validacao";

function comItem(alteracao: Partial<ItemNota>): NotaFiscal {
  const nota = notaDeExemplo();
  return {
    ...nota,
    itens: [{ ...nota.itens[0], ...alteracao }, nota.itens[1]],
  };
}

const campos = (nota: NotaFiscal) =>
  validarNotaParaEmissao(nota).map((p) => p.campo);

describe("validarNotaParaEmissao", () => {
  it("a nota de exemplo passa sem pendências", () => {
    expect(validarNotaParaEmissao(notaDeExemplo())).toEqual([]);
  });

  it("aponta o item e o campo com problema, com o nome do produto", () => {
    const [pendencia] = validarNotaParaEmissao(comItem({ ncm: "2202" }));
    expect(pendencia).toEqual({
      campo: "itens[0].ncm",
      mensagem: "REFRIGERANTE COLA 2L: NCM precisa ter 8 dígitos",
      itemIndice: 0,
    });
  });

  it("devolve todas as pendências de uma vez", () => {
    expect(campos(comItem({ ncm: "", cfop: "", unidade: "" }))).toEqual([
      "itens[0].ncm",
      "itens[0].cfop",
      "itens[0].unidade",
    ]);
  });

  it("NFC-e só aceita CFOP de operação interna", () => {
    expect(campos(comItem({ cfop: "6102" }))).toEqual(["itens[0].cfop"]);
    expect(campos({ ...comItem({ cfop: "6102" }), modelo: 55 })).toEqual([]);
  });

  it("recusa GTIN com dígito errado, mas aceita produto sem GTIN", () => {
    expect(campos(comItem({ gtin: "4006381333932" }))).toEqual([
      "itens[0].gtin",
    ]);
    expect(campos(comItem({ gtin: null }))).toEqual([]);
  });

  it("empresa do Simples precisa de CSOSN; Regime Normal precisa de CST", () => {
    expect(
      campos(
        comItem({
          tributacao: {
            ...notaDeExemplo().itens[0].tributacao,
            icms: { regime: "NORMAL", cst: "60" },
          },
        }),
      ),
    ).toEqual(["itens[0].tributacao.icms"]);

    const normal = notaDeExemplo();
    normal.emitente = { ...normal.emitente, regime: "LUCRO_PRESUMIDO" };
    expect(campos(normal)).toEqual([
      "itens[0].tributacao.icms",
      "itens[1].tributacao.icms",
    ]);
  });

  it("confere CPF do cliente quando informado", () => {
    expect(
      campos(notaDeExemplo({ destinatario: { documento: "52998224725" } })),
    ).toEqual([]);
    expect(
      campos(notaDeExemplo({ destinatario: { documento: "52998224700" } })),
    ).toEqual(["destinatario.documento"]);
  });

  it("pagamento precisa cobrir o total", () => {
    expect(
      campos(notaDeExemplo({ pagamentos: [{ forma: "PIX", valor: 4187 }] })),
    ).toEqual(["pagamentos"]);
    expect(campos(notaDeExemplo({ pagamentos: [] }))).toEqual(["pagamentos"]);
  });

  it("emitente sem IE, com CNPJ inválido ou município sem código IBGE", () => {
    const nota = notaDeExemplo();
    nota.emitente = {
      ...nota.emitente,
      cnpj: "11222333000100",
      inscricaoEstadual: " ",
      endereco: { ...nota.emitente.endereco, codigoMunicipio: "221100" },
    };
    expect(campos(nota)).toEqual([
      "emitente.cnpj",
      "emitente.inscricaoEstadual",
      "emitente.endereco.codigoMunicipio",
    ]);
  });
});
