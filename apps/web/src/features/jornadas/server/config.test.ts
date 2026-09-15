import { describe, expect, it } from "vitest";
import type { Jornada } from "../catalogo/tipos";
import { configDaJornada, lerConfigDasJornadas } from "./config";

const JORNADA = {
  id: "produtos-cadastro",
  starsSugeridas: 10,
} as Jornada;

describe("lerConfigDasJornadas", () => {
  it("chave ausente vira o padrão — a tela abre com o banco vazio", () => {
    const config = lerConfigDasJornadas(undefined);
    expect(config.porJornada).toEqual({});
    expect(config.recompensarSandbox).toBe(true);
  });

  it("valor fora de formato não derruba a tela", () => {
    const config = lerConfigDasJornadas({ porJornada: "isto não é objeto" });
    expect(config.porJornada).toEqual({});
  });

  it("lê o que foi gravado", () => {
    const config = lerConfigDasJornadas({
      porJornada: { "produtos-cadastro": { stars: 3, ativa: false } },
      recompensarSandbox: false,
    });
    expect(config.porJornada["produtos-cadastro"]).toEqual({
      stars: 3,
      ativa: false,
    });
    expect(config.recompensarSandbox).toBe(false);
  });
});

describe("configDaJornada", () => {
  it("sem linha gravada, vale o sugerido e a jornada nasce no ar", () => {
    const config = lerConfigDasJornadas({});
    expect(configDaJornada(config, JORNADA)).toEqual({
      stars: 10,
      ativa: true,
    });
  });

  it("linha gravada manda — inclusive valendo zero", () => {
    const config = lerConfigDasJornadas({
      porJornada: { "produtos-cadastro": { stars: 0, ativa: true } },
    });
    expect(configDaJornada(config, JORNADA).stars).toBe(0);
  });

  it("desligar uma jornada não apaga o preço dela", () => {
    const config = lerConfigDasJornadas({
      porJornada: { "produtos-cadastro": { stars: 7, ativa: false } },
    });
    expect(configDaJornada(config, JORNADA)).toEqual({
      stars: 7,
      ativa: false,
    });
  });
});
