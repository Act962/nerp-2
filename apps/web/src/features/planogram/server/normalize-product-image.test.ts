import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeProductImage } from "./normalize-product-image";

const W = 200;
const H = 320;

// Geometria do caso difícil: garrafa BRANCA sobre fundo BRANCO, com sombra
// suave embaixo — a foto de referência do Brilux.
const BOTTLE = { x0: 70, x1: 130, y0: 40, y1: 260 };
const LABEL = { y0: 190, y1: 230 };

function put(buf: Buffer, x: number, y: number, rgb: [number, number, number]) {
  const o = (y * W + x) * 4;
  buf[o] = rgb[0];
  buf[o + 1] = rgb[1];
  buf[o + 2] = rgb[2];
  buf[o + 3] = 255;
}

/**
 * Fundo branco puro, corpo de plástico branco (246 — quase indistinguível do
 * fundo), rótulo colorido e uma sombra que cai DEVAGAR, sem degrau.
 */
function buildScene(): Buffer {
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) put(buf, x, y, [255, 255, 255]);
  }

  // Sombra: bump suave, ~1 unidade por pixel. Nenhum degrau que trave o
  // preenchimento — é assim que sombra de verdade se comporta.
  for (let y = 266; y < 296; y++) {
    const queda = 15 * (1 - Math.abs(y - 281) / 15);
    const v = Math.round(255 - queda);
    for (let x = 55; x < 145; x++) put(buf, x, y, [v, v, v]);
  }

  for (let y = BOTTLE.y0; y < BOTTLE.y1; y++) {
    for (let x = BOTTLE.x0; x < BOTTLE.x1; x++) {
      const noRotulo = y >= LABEL.y0 && y < LABEL.y1;
      put(buf, x, y, noRotulo ? [40, 90, 200] : [246, 246, 246]);
    }
  }
  return buf;
}

async function toPng(raw: Buffer): Promise<Buffer> {
  return sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer();
}

describe("normalizeProductImage — embalagem branca sobre fundo branco", () => {
  it("mantém o corpo branco e remove fundo e sombra", async () => {
    const result = await normalizeProductImage(await toPng(buildScene()));

    expect(result.status).toBe("OK");
    expect(result.keyedBackground).toBe(true);

    // A prova: o recorte fica do tamanho da GARRAFA. Se o preenchimento
    // tivesse vazado para dentro do plástico branco, sobraria só o rótulo; se
    // a sombra tivesse ficado, o recorte seria bem mais largo e mais alto.
    const meta = await sharp(result.buffer).metadata();
    const largura = BOTTLE.x1 - BOTTLE.x0;
    const altura = BOTTLE.y1 - BOTTLE.y0;

    expect(meta.width).toBeGreaterThanOrEqual(largura - 2);
    expect(meta.width).toBeLessThanOrEqual(largura + 2);
    expect(meta.height).toBeGreaterThanOrEqual(altura - 2);
    expect(meta.height).toBeLessThanOrEqual(altura + 2);
  });

  it("o miolo do plástico branco continua opaco", async () => {
    const result = await normalizeProductImage(await toPng(buildScene()));
    const { data, info } = await sharp(result.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const meio = ((info.height >> 1) * info.width + (info.width >> 1)) * 4;
    const topo = (10 * info.width + (info.width >> 1)) * 4;

    expect(data[meio + 3]).toBe(255);
    expect(data[topo + 3]).toBe(255);
  });

  it("fundo colorido preserva o branco da embalagem", async () => {
    const buf = buildScene();
    // Encarte: fundo azul, garrafa continua branca.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dentro =
          x >= BOTTLE.x0 && x < BOTTLE.x1 && y >= BOTTLE.y0 && y < BOTTLE.y1;
        if (!dentro) put(buf, x, y, [30, 80, 190]);
      }
    }
    const result = await normalizeProductImage(await toPng(buf));
    const { data, info } = await sharp(result.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const meio = ((info.height >> 1) * info.width + (info.width >> 1)) * 4;
    expect(data[meio + 3]).toBe(255);
    // E não foi tingido pelo azul do fundo.
    expect(data[meio]).toBeGreaterThan(200);
  });

  it("foto de gôndola (fundo bagunçado) volta intacta e marcada", async () => {
    const buf = buildScene();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dentro =
          x >= BOTTLE.x0 && x < BOTTLE.x1 && y >= BOTTLE.y0 && y < BOTTLE.y1;
        if (!dentro) put(buf, x, y, [(x * 7) % 256, (y * 11) % 256, 120]);
      }
    }
    const result = await normalizeProductImage(await toPng(buf));

    expect(result.status).toBe("SUSPECT");
    expect(result.keyedBackground).toBe(false);
    expect(result.reason).toMatch(/n[ãa]o uniforme/);
  });
});
