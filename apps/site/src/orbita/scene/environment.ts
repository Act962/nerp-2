import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  PMREMGenerator,
  RGBAFormat,
  type Texture,
  type WebGLRenderer,
} from "three";

/**
 * Ambiente procedural para os reflexos do símbolo.
 *
 * Um HDRI baixado de CDN seria mais bonito e mais caro — e faria o site
 * depender de rede externa. Este mapa é gerado em memória: preto espacial
 * embaixo, azul de atmosfera no equador, e um sol quente na direção da luz
 * principal. É o suficiente para o arco azul ter reflexo e não parecer PNG.
 */
export function createProceduralEnvironment(renderer: WebGLRenderer): Texture {
  const width = 128;
  const height = 64;
  const data = new Float32Array(width * height * 4);

  // Direção do sol em coordenadas equirretangulares (ver SUN_DIRECTION).
  const sunU = 0.13;
  const sunV = 0.66;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const i = (y * width + x) * 4;

      // Gradiente vertical: espaço profundo → brilho de atmosfera → preto.
      const horizon = 1 - Math.abs(v - 0.52) * 2.4;
      const atmo = Math.max(horizon, 0) ** 2.2;

      let r = 0.012 + atmo * 0.05;
      let g = 0.02 + atmo * 0.17;
      let b = 0.05 + atmo * 0.46;

      // Terra iluminada refletindo por baixo.
      if (v > 0.68) {
        const k = (v - 0.68) / 0.32;
        r += k * 0.05;
        g += k * 0.11;
        b += k * 0.22;
      }

      // Sol.
      const du = Math.min(Math.abs(u - sunU), 1 - Math.abs(u - sunU));
      const dv = Math.abs(v - sunV);
      const d = Math.sqrt(du * du * 4 + dv * dv);
      const sun = Math.exp(-(d * d) / 0.0045) * 26;
      r += sun;
      g += sun * 0.96;
      b += sun * 0.88;

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }

  const source = new DataTexture(data, width, height, RGBAFormat, FloatType);
  source.mapping = EquirectangularReflectionMapping;
  source.magFilter = LinearFilter;
  source.minFilter = LinearFilter;
  source.needsUpdate = true;

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(source);
  pmrem.dispose();
  source.dispose();

  return target.texture;
}
