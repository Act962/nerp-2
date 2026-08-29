import { describe, expect, it } from "vitest";
import {
  autorizadorContingencia,
  autorizadorDe,
  ufsDoAutorizador,
} from "./autorizadores";
import { UFS, codigoIbgeDaUf, isUf, ufDoCodigoIbge } from "./uf";

describe("autorizadorDe", () => {
  it("PI é autorizado pela SVRS nos dois modelos", () => {
    // A UF do primeiro cliente — se isto mudar, a emissão inteira erra o alvo.
    expect(autorizadorDe("PI", 65)).toBe("SVRS");
    expect(autorizadorDe("PI", 55)).toBe("SVRS");
  });

  it("BA, MA e PE mudam de autorizador entre NF-e e NFC-e", () => {
    // É o caso que a `@brasil-fiscal/nfe` erra: ela consulta sempre a tabela
    // do modelo 55, então mandaria a NFC-e da Bahia para um autorizador sem
    // endpoint de modelo 65.
    expect(autorizadorDe("BA", 55)).toBe("BA");
    expect(autorizadorDe("BA", 65)).toBe("SVRS");

    expect(autorizadorDe("MA", 55)).toBe("SVAN");
    expect(autorizadorDe("MA", 65)).toBe("SVRS");

    expect(autorizadorDe("PE", 55)).toBe("PE");
    expect(autorizadorDe("PE", 65)).toBe("SVRS");
  });

  it("os demais estados usam o mesmo autorizador nos dois modelos", () => {
    const divergentes = new Set(["BA", "MA", "PE"]);
    for (const uf of UFS) {
      if (divergentes.has(uf)) continue;
      expect(autorizadorDe(uf, 55), uf).toBe(autorizadorDe(uf, 65));
    }
  });

  it("cobre as 27 UFs sem buraco", () => {
    expect(UFS).toHaveLength(27);
    for (const uf of UFS) {
      expect(autorizadorDe(uf, 55), uf).toBeTruthy();
      expect(autorizadorDe(uf, 65), uf).toBeTruthy();
    }
  });

  it("SVRS concentra a maioria das UFs na NFC-e", () => {
    expect(ufsDoAutorizador("SVRS", 65).length).toBeGreaterThan(
      ufsDoAutorizador("SVRS", 55).length,
    );
  });
});

describe("autorizadorContingencia", () => {
  it("quem é SVRS cai na SVC-AN; os demais na SVC-RS", () => {
    // Contingência não pode apontar para o ambiente que caiu.
    expect(autorizadorContingencia("PI", 55)).toBe("SVC-AN");
    expect(autorizadorContingencia("SP", 55)).toBe("SVC-RS");
    expect(autorizadorContingencia("MG", 55)).toBe("SVC-RS");
  });

  it("recusa NFC-e — o caminho dela é a contingência offline", () => {
    expect(() => autorizadorContingencia("PI", 65)).toThrow(/tpEmis=9/);
  });
});

describe("uf", () => {
  it("código IBGE do PI é 22 (os dois primeiros dígitos da chave)", () => {
    expect(codigoIbgeDaUf("PI")).toBe(22);
    expect(ufDoCodigoIbge(22)).toBe("PI");
  });

  it("ida e volta é consistente para todas as UFs", () => {
    for (const uf of UFS)
      expect(ufDoCodigoIbge(codigoIbgeDaUf(uf)), uf).toBe(uf);
  });

  it("código inexistente devolve null em vez de estourar", () => {
    expect(ufDoCodigoIbge(99)).toBeNull();
  });

  it("isUf estreita a sigla", () => {
    expect(isUf("PI")).toBe(true);
    expect(isUf("XX")).toBe(false);
  });
});
