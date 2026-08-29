import { describe, expect, it } from "vitest";
import {
  type Rgb,
  backgroundScore,
  buildBackgroundModel,
  rgbToLab,
  whiteBalanceGains,
} from "./image-color";

const BRANCO: Rgb = [255, 255, 255];
const CINZA_CLARO: Rgb = [235, 235, 235];
/** Mesma tinta do fundo branco, só com menos luz — é o que sombra faz. */
const SOMBRA: Rgb = [205, 205, 205];
const SOMBRA_FORTE: Rgb = [175, 175, 175];
const AZUL_ENCARTE: Rgb = [40, 90, 200];

function moldura(cor: Rgb, n = 40): Rgb[] {
  return Array.from({ length: n }, () => cor);
}

describe("rgbToLab", () => {
  it("branco é L=100 sem croma", () => {
    const [l, a, b] = rgbToLab(BRANCO);
    expect(l).toBeCloseTo(100, 0);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });

  // O fato que sustenta a detecção de sombra: cinza é branco com menos L,
  // mesmo croma.
  it("cinza mantém o croma do branco e só perde luminância", () => {
    const branco = rgbToLab(BRANCO);
    const cinza = rgbToLab(SOMBRA);

    expect(cinza[0]).toBeLessThan(branco[0]);
    expect(Math.hypot(cinza[1] - branco[1], cinza[2] - branco[2])).toBeLessThan(
      1,
    );
  });
});

describe("buildBackgroundModel", () => {
  it("fundo branco de estúdio é neutro e uniforme", () => {
    const model = buildBackgroundModel(moldura(BRANCO));

    expect(model.neutral).toBe(true);
    expect(model.uniform).toBe(true);
  });

  it("fundo colorido é uniforme mas NÃO neutro", () => {
    const model = buildBackgroundModel(moldura(AZUL_ENCARTE));

    expect(model.uniform).toBe(true);
    expect(model.neutral).toBe(false);
  });

  // Um canto só não enxergaria o degradê; a moldura inteira sim.
  it("aceita degradê suave de luminância como uniforme", () => {
    const model = buildBackgroundModel([
      ...moldura(BRANCO, 20),
      ...moldura(CINZA_CLARO, 20),
    ]);

    expect(model.uniform).toBe(true);
  });

  it("moldura com cores demais deixa de ser uniforme", () => {
    const model = buildBackgroundModel([
      ...moldura(BRANCO, 20),
      ...moldura(AZUL_ENCARTE, 20),
    ]);

    expect(model.uniform).toBe(false);
  });

  // Percentil, não mínimo/máximo: produto encostando na borda não pode
  // esticar o modelo e transformar o produto inteiro em fundo.
  it("um pixel intruso na moldura não estica o modelo", () => {
    const limpo = buildBackgroundModel(moldura(BRANCO, 40));
    const comIntruso = buildBackgroundModel([
      ...moldura(BRANCO, 39),
      AZUL_ENCARTE,
    ]);

    expect(comIntruso.lMin).toBeCloseTo(limpo.lMin, 0);
  });

  it("sem amostra não finge saber o fundo", () => {
    expect(buildBackgroundModel([])).toMatchObject({
      uniform: false,
      neutral: false,
    });
  });
});

describe("backgroundScore", () => {
  const brancoModel = buildBackgroundModel(moldura(BRANCO));

  it("o próprio fundo pontua no máximo", () => {
    expect(backgroundScore(rgbToLab(BRANCO), brancoModel)).toBeCloseTo(1, 1);
  });

  // O caso que o motor antigo errava: parava na sombra e deixava halo cinza.
  it("sombra sobre fundo branco continua sendo fundo", () => {
    expect(backgroundScore(rgbToLab(SOMBRA), brancoModel)).toBeGreaterThan(0.5);
    expect(
      backgroundScore(rgbToLab(SOMBRA_FORTE), brancoModel),
    ).toBeGreaterThan(0.5);
  });

  it("preto não passa por sombra", () => {
    expect(backgroundScore(rgbToLab([10, 10, 10]), brancoModel)).toBe(0);
  });

  it("cor saturada nunca é fundo branco", () => {
    expect(backgroundScore(rgbToLab(AZUL_ENCARTE), brancoModel)).toBe(0);
    expect(backgroundScore(rgbToLab([220, 40, 40]), brancoModel)).toBe(0);
  });

  // A assimetria: sombra escurece, embalagem branca não fica mais clara que
  // um fundo já em L=100 — mas num fundo cinza, sim.
  it("mais claro que a moldura não é fundo", () => {
    const cinzaModel = buildBackgroundModel(moldura([200, 200, 200]));

    expect(backgroundScore(rgbToLab(BRANCO), cinzaModel)).toBe(0);
    expect(
      backgroundScore(rgbToLab([190, 190, 190]), cinzaModel),
    ).toBeGreaterThan(0.5);
  });

  it("num fundo colorido, o que tem a MESMA cor é fundo", () => {
    const azulModel = buildBackgroundModel(moldura(AZUL_ENCARTE));

    expect(backgroundScore(rgbToLab(AZUL_ENCARTE), azulModel)).toBeCloseTo(
      1,
      1,
    );
    // E o branco da embalagem sobrevive, que é o pedido original.
    expect(backgroundScore(rgbToLab(BRANCO), azulModel)).toBe(0);
  });
});

describe("whiteBalanceGains", () => {
  it("corrige dominante suave em fundo neutro", () => {
    const quente: Rgb = [245, 240, 230];
    const gains = whiteBalanceGains(
      buildBackgroundModel(moldura(quente)),
      quente,
    );

    expect(gains).not.toBeNull();
    // O canal mais fraco (azul) ganha mais que o mais forte (vermelho).
    if (gains) expect(gains[2]).toBeGreaterThan(gains[0]);
  });

  // O ponto que o pedido levantou: encarte de fundo colorido.
  it("não corrige contra fundo colorido — arrancaria a cor do encarte", () => {
    expect(
      whiteBalanceGains(
        buildBackgroundModel(moldura(AZUL_ENCARTE)),
        AZUL_ENCARTE,
      ),
    ).toBeNull();
  });

  it("recusa correção violenta, sinal de que o fundo não era neutro", () => {
    const model = buildBackgroundModel(moldura([255, 255, 255]));
    expect(whiteBalanceGains(model, [255, 120, 90])).toBeNull();
  });

  it("fundo preto não serve de referência de branco", () => {
    const model = buildBackgroundModel(moldura([0, 0, 0]));
    expect(whiteBalanceGains(model, [0, 0, 0])).toBeNull();
  });
});
