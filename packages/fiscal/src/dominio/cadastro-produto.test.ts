import { describe, expect, it } from "vitest";
import {
  normalizarCodigoFiscal,
  padroesSugeridos,
  resolverTributacao,
  validarCamposFiscais,
} from "./cadastro-produto";

const campos = (p: { campo: string }[]) => p.map((x) => x.campo);

describe("cadastro fiscal do produto", () => {
  it("normaliza pontuação e vazio", () => {
    expect(normalizarCodigoFiscal("2202.10.00")).toBe("22021000");
    expect(normalizarCodigoFiscal("  ")).toBeNull();
    expect(normalizarCodigoFiscal(undefined)).toBeNull();
  });

  describe("validarCamposFiscais", () => {
    it("campo vazio não é erro de formato", () => {
      expect(validarCamposFiscais({ ncm: "", cfop: null })).toEqual([]);
    });

    it("aceita NCM com pontuação e recusa tamanho errado", () => {
      expect(validarCamposFiscais({ ncm: "2202.10.00" })).toEqual([]);
      expect(
        campos(validarCamposFiscais({ ncm: "2202", cest: "123" })),
      ).toEqual(["ncm", "cest"]);
    });

    it("CFOP de venda começa com 5 ou 6", () => {
      expect(validarCamposFiscais({ cfop: "5102" })).toEqual([]);
      expect(campos(validarCamposFiscais({ cfop: "1102" }))).toEqual(["cfop"]);
    });

    it("ICMS segue o regime; sem regime aceita os dois", () => {
      expect(
        campos(validarCamposFiscais({ cstIcms: "00" }, "SIMPLES_NACIONAL")),
      ).toEqual(["cstIcms"]);
      expect(
        campos(validarCamposFiscais({ cstIcms: "102" }, "LUCRO_PRESUMIDO")),
      ).toEqual(["cstIcms"]);
      expect(validarCamposFiscais({ cstIcms: "102" }, "SIMPLES_MEI")).toEqual(
        [],
      );
      expect(validarCamposFiscais({ cstIcms: "60" })).toEqual([]);
      expect(campos(validarCamposFiscais({ cstIcms: "999" }))).toEqual([
        "cstIcms",
      ]);
    });

    it("campos da reforma: cClassTrib 6 dígitos, CST IBS/CBS 3", () => {
      expect(
        validarCamposFiscais({ cClassTrib: "000001", cstIbsCbs: "000" }),
      ).toEqual([]);
      expect(
        campos(validarCamposFiscais({ cClassTrib: "1", cstIbsCbs: "12" })),
      ).toEqual(["cClassTrib", "cstIbsCbs"]);
    });
  });

  describe("resolverTributacao", () => {
    const padroes = padroesSugeridos("SIMPLES_NACIONAL");

    it("completa com o padrão da empresa e diz o que veio dele", () => {
      const r = resolverTributacao(
        { ncm: "10063021" },
        padroes,
        "SIMPLES_NACIONAL",
      );
      expect(r).toEqual({
        ok: true,
        valor: {
          ncm: "10063021",
          cest: null,
          cfop: "5102",
          usouPadrao: ["cfop", "cstIcms", "cstPis", "cstCofins"],
          tributacao: {
            origem: "0",
            icms: { regime: "SIMPLES", csosn: "102" },
            pis: { cst: "49" },
            cofins: { cst: "49" },
            ibsCbs: null,
          },
        },
      });
    });

    it("o cadastro do produto vence o padrão (exceção de ST)", () => {
      const r = resolverTributacao(
        { ncm: "22021000", cest: "0300700", cfop: "5405", cstIcms: "500" },
        padroes,
        "SIMPLES_NACIONAL",
      );
      expect(r.ok && r.valor.cfop).toBe("5405");
      expect(r.ok && r.valor.tributacao.icms).toEqual({
        regime: "SIMPLES",
        csosn: "500",
      });
      expect(r.ok && r.valor.usouPadrao).toEqual(["cstPis", "cstCofins"]);
    });

    it("sem NCM nunca fica pronto, mesmo com padrão", () => {
      const r = resolverTributacao({}, padroes, "SIMPLES_NACIONAL");
      expect(r.ok === false && r.motivo).toBe("INCOMPLETO");
      expect(r.ok === false && campos(r.pendencias)).toEqual(["ncm"]);
    });

    it("sem padrão, lista tudo o que falta", () => {
      const r = resolverTributacao(
        { ncm: "10063021" },
        null,
        "LUCRO_PRESUMIDO",
      );
      expect(r.ok === false && campos(r.pendencias)).toEqual([
        "cfop",
        "cstIcms",
        "cstPis",
        "cstCofins",
      ]);
    });

    it("Regime Normal monta ICMS com CST", () => {
      const r = resolverTributacao(
        {
          ncm: "10063021",
          cfop: "5102",
          cstIcms: "00",
          cstPis: "01",
          cstCofins: "01",
        },
        null,
        "LUCRO_REAL",
      );
      expect(r.ok && r.valor.tributacao.icms).toEqual({
        regime: "NORMAL",
        cst: "00",
      });
    });

    it("formato inválido no produto ou no padrão bloqueia", () => {
      const r1 = resolverTributacao(
        { ncm: "123" },
        padroes,
        "SIMPLES_NACIONAL",
      );
      expect(r1.ok === false && r1.motivo).toBe("FORMATO");
      expect(r1.ok === false && campos(r1.pendencias)).toEqual(["ncm"]);
      const r2 = resolverTributacao(
        { ncm: "10063021" },
        { cstIcms: "00" },
        "SIMPLES_NACIONAL",
      );
      expect(r2.ok === false && r2.pendencias[0].mensagem).toMatch(
        /^Padrão da empresa/,
      );
    });

    it("IBS/CBS só entra com os dois campos", () => {
      const r = resolverTributacao(
        { ncm: "10063021", cClassTrib: "000001", cstIbsCbs: "000" },
        padroes,
        "SIMPLES_NACIONAL",
      );
      expect(r.ok && r.valor.tributacao.ibsCbs).toEqual({
        cst: "000",
        cClassTrib: "000001",
      });
    });
  });

  it("só sugere padrão para Simples e MEI", () => {
    expect(padroesSugeridos("SIMPLES_MEI")).not.toBeNull();
    expect(padroesSugeridos("LUCRO_REAL")).toBeNull();
  });
});
