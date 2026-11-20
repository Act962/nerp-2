import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

/**
 * As texturas dos planetas da jornada, geradas em canvas.
 *
 * Por que procedural e não arquivo: são vinte corpos, e cada imagem seria mais
 * um download no caminho de uma página que já carrega o three.js. Geradas
 * aqui, custam alguns milissegundos de CPU uma vez e nada de rede.
 *
 * Cada planeta sai com DUAS texturas do mesmo campo de ruído: a cor e o
 * relevo. É o relevo que tira o aspecto de bola pintada — com ele a luz
 * rasante pega borda de cratera, costa de continente e faixa de nuvem, e a
 * superfície passa a ter profundidade em vez de só estampa.
 *
 * O ruído é amostrado na superfície da ESFERA, não no retângulo da imagem.
 * Assim a textura fecha sem costura na volta e não estica nos polos, que é o
 * defeito clássico de ruído 2D embrulhado numa bola.
 *
 * Tudo é determinístico (`semente`): o mesmo planeta sai igual em toda visita.
 */

/** Gerador linear simples — basta para embaralhar a tabela do ruído. */
function sorteio(semente: number) {
  let s = semente % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function tela(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function misturar(a: RGB, b: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

const suave = (t: number) => t * t * (3 - 2 * t);
const degrau = (a: number, b: number, x: number) =>
  suave(Math.min(1, Math.max(0, (x - a) / (b - a))));

/**
 * Ruído de valor em 3D, somado em oitavas.
 *
 * Em três dimensões porque a amostra é um ponto na superfície da esfera.
 */
function criarRuido(semente: number) {
  const r = sorteio(semente);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const a = base[i] ?? 0;
    base[i] = base[j] ?? 0;
    base[j] = a;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255] ?? 0;
  const p = (i: number) => perm[i] ?? 0;
  const valor = (x: number, y: number, z: number) =>
    p(p(p(x & 255) + (y & 255)) + (z & 255)) / 255;

  function ruido(x: number, y: number, z: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = suave(x - xi);
    const v = suave(y - yi);
    const w = suave(z - zi);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    return l(
      l(
        l(valor(xi, yi, zi), valor(xi + 1, yi, zi), u),
        l(valor(xi, yi + 1, zi), valor(xi + 1, yi + 1, zi), u),
        v,
      ),
      l(
        l(valor(xi, yi, zi + 1), valor(xi + 1, yi, zi + 1), u),
        l(valor(xi, yi + 1, zi + 1), valor(xi + 1, yi + 1, zi + 1), u),
        v,
      ),
      w,
    );
  }

  return function fbm(x: number, y: number, z: number, oitavas = 4) {
    let amplitude = 0.5;
    let frequencia = 1;
    let soma = 0;
    let norma = 0;
    for (let i = 0; i < oitavas; i++) {
      // O deslocamento evita que as oitavas se alinhem na origem.
      soma +=
        amplitude *
        ruido(
          x * frequencia + 31.7,
          y * frequencia + 17.3,
          z * frequencia + 5.9,
        );
      norma += amplitude;
      amplitude *= 0.5;
      frequencia *= 2;
    }
    return soma / norma;
  };
}

export type Paleta = {
  /** A cor do corpo. */
  base: string;
  /** O tom escuro: faixas, crateras, sombra. */
  escuro: string;
  /** O tom claro: realce, nuvem, gelo. */
  claro: string;
};

export type EstiloPlaneta = "faixas" | "rochoso" | "continentes" | "gelado";

/** O que um ponto da superfície devolve: a cor e a altura (0 a 1). */
type Amostra = { cor: RGB; altura: number };
type Superficie = (x: number, y: number, z: number, lon: number) => Amostra;

const BRANCO: RGB = [238, 246, 255];

/** Gigante gasoso: faixas por latitude, torcidas pelo ruído, e uma tempestade. */
function faixas(p: Paleta, semente: number): Superficie {
  const fbm = criarRuido(semente);
  const r = sorteio(semente + 3);
  const base = rgb(p.base);
  const escuro = rgb(p.escuro);
  const claro = rgb(p.claro);
  const bandas = 5 + Math.floor(r() * 4);
  const latTempestade = (r() - 0.5) * 0.7;
  const lonTempestade = r() * Math.PI * 2;

  return (x, y, z, lon) => {
    const turbulencia = fbm(x * 2.2, y * 5, z * 2.2, 4) - 0.5;
    const t = y * bandas + turbulencia * 1.6;
    const faixa = 0.5 + 0.5 * Math.sin(t * Math.PI);
    const fino = fbm(x * 9, y * 22, z * 9, 3);
    let cor = misturar(escuro, base, degrau(0.15, 0.6, faixa));
    cor = misturar(cor, claro, degrau(0.62, 1, faixa) * 0.85);
    cor = misturar(cor, escuro, (1 - fino) * 0.22);

    // A tempestade: uma oval mais clara, com a borda escurecida.
    let dLon = Math.abs(lon - lonTempestade);
    if (dLon > Math.PI) dLon = Math.PI * 2 - dLon;
    const d = Math.hypot(dLon / 0.42, (y - latTempestade) / 0.16);
    if (d < 1.25) {
      cor = misturar(cor, escuro, degrau(1.25, 0.9, d) * 0.5);
      cor = misturar(cor, claro, degrau(0.95, 0.2, d) * 0.9);
    }
    return { cor, altura: 0.5 + turbulencia * 0.25 + (faixa - 0.5) * 0.12 };
  };
}

/** Rochoso: terreno irregular, com crateras de fundo escuro e borda clara. */
function rochoso(p: Paleta, semente: number): Superficie {
  const fbm = criarRuido(semente);
  const r = sorteio(semente + 11);
  const base = rgb(p.base);
  const escuro = rgb(p.escuro);
  const claro = rgb(p.claro);
  const crateras = Array.from({ length: 22 }, () => {
    const lon = r() * Math.PI * 2;
    const cy = r() * 2 - 1;
    const s = Math.sqrt(1 - cy * cy);
    return {
      x: s * Math.cos(lon),
      y: cy,
      z: s * Math.sin(lon),
      raio: 0.07 + r() * r() * 0.26,
    };
  });

  return (x, y, z) => {
    const terreno = fbm(x * 2.6, y * 2.6, z * 2.6, 5);
    const grao = fbm(x * 12, y * 12, z * 12, 2);
    let altura = terreno * 0.7 + grao * 0.12;
    let cor = misturar(escuro, base, degrau(0.25, 0.62, terreno));
    cor = misturar(cor, claro, degrau(0.6, 0.85, terreno) * 0.6);

    for (const c of crateras) {
      // Distância em corda: basta para comparar com o raio, sem acos.
      const d = Math.hypot(x - c.x, y - c.y, z - c.z) / c.raio;
      if (d >= 1.25) continue;
      if (d < 0.82) {
        const fundo = degrau(0.82, 0.25, d);
        cor = misturar(cor, escuro, fundo * 0.7);
        altura -= fundo * 0.32;
      } else {
        const borda = 1 - Math.abs(d - 1.02) / 0.23;
        if (borda > 0) {
          cor = misturar(cor, claro, borda * 0.55);
          altura += borda * 0.2;
        }
      }
    }
    return { cor, altura: Math.min(1, Math.max(0, altura)) };
  };
}

/** Com mar, continentes, calotas e uma camada rala de nuvens. */
function continentes(p: Paleta, semente: number): Superficie {
  const fbm = criarRuido(semente);
  const nuvens = criarRuido(semente + 101);
  const mar = rgb(p.base);
  const marFundo = rgb(p.escuro);
  const terra = rgb(p.claro);
  const serra = misturar(terra, BRANCO, 0.45);

  return (x, y, z) => {
    const n = fbm(x * 1.7, y * 1.7, z * 1.7, 5);
    const costa = degrau(0.5, 0.54, n);
    const relevo = degrau(0.54, 0.8, n);
    let cor = misturar(
      misturar(marFundo, mar, degrau(0.25, 0.5, n)),
      misturar(terra, serra, relevo),
      costa,
    );
    let altura = costa * (0.35 + relevo * 0.5);

    // Calotas: é o detalhe que faz o olho ler "planeta" e não "bola pintada".
    const polo = degrau(0.86, 0.96, Math.abs(y) + (n - 0.5) * 0.16);
    cor = misturar(cor, BRANCO, polo * 0.9);
    altura = Math.max(altura, polo * 0.5);

    // Nuvem rala: cobrindo demais, o planeta vira uma bola branca e o
    // desenho dos continentes — que é o que o distingue — some por baixo.
    const nuvem = degrau(0.6, 0.8, nuvens(x * 2.6, y * 3.4, z * 2.6, 4));
    cor = misturar(cor, BRANCO, nuvem * 0.42);
    return { cor, altura: Math.min(1, altura + nuvem * 0.12) };
  };
}

/** Gelado: faixas largas e suaves, com estrias finas. */
function gelado(p: Paleta, semente: number): Superficie {
  const fbm = criarRuido(semente);
  const base = rgb(p.base);
  const escuro = rgb(p.escuro);
  const claro = rgb(p.claro);

  return (x, y, z) => {
    const n = fbm(x * 1.6, y * 3.2, z * 1.6, 4);
    const t = y * 2.6 + (n - 0.5) * 1.8;
    const faixa = 0.5 + 0.5 * Math.sin(t * Math.PI);
    const estria = fbm(x * 5, y * 30, z * 5, 3);
    let cor = misturar(base, claro, degrau(0.35, 0.95, faixa) * 0.8);
    cor = misturar(cor, escuro, degrau(0.55, 0.2, faixa) * 0.45);
    cor = misturar(cor, BRANCO, degrau(0.62, 0.8, estria) * 0.25);
    return { cor, altura: 0.5 + (n - 0.5) * 0.3 + (estria - 0.5) * 0.08 };
  };
}

const SUPERFICIES: Record<
  EstiloPlaneta,
  (p: Paleta, semente: number) => Superficie
> = { faixas, rochoso, continentes, gelado };

export type TexturasDoPlaneta = {
  /** A cor da superfície. */
  mapa: Texture;
  /** O relevo, em tons de cinza: claro é alto. */
  relevo: Texture;
};

/**
 * As texturas de um planeta.
 *
 * `semente` costuma ser o índice do corpo na cena: estável entre recargas e
 * diferente entre vizinhos. `largura` é a resolução — os planetas pequenos
 * passam bem com 512; o do centro, que ocupa boa parte da tela, pede o dobro.
 */
export function texturaPlaneta(
  estilo: EstiloPlaneta,
  paleta: Paleta,
  semente: number,
  largura = 512,
): TexturasDoPlaneta {
  const w = largura;
  const h = largura / 2;
  const superficie = SUPERFICIES[estilo](paleta, semente * 97 + 13);

  const telaCor = tela(w, h);
  const telaRelevo = tela(w, h);
  const ctxCor = telaCor.getContext("2d");
  const ctxRelevo = telaRelevo.getContext("2d");
  if (ctxCor && ctxRelevo) {
    const cor = ctxCor.createImageData(w, h);
    const relevo = ctxRelevo.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      // Latitude: do polo norte (0) ao sul (π).
      const phi = ((py + 0.5) / h) * Math.PI;
      const y = Math.cos(phi);
      const s = Math.sin(phi);
      for (let px = 0; px < w; px++) {
        const lon = ((px + 0.5) / w) * Math.PI * 2;
        const a = superficie(s * Math.cos(lon), y, s * Math.sin(lon), lon);
        const i = (py * w + px) * 4;
        cor.data[i] = a.cor[0];
        cor.data[i + 1] = a.cor[1];
        cor.data[i + 2] = a.cor[2];
        cor.data[i + 3] = 255;
        const cinza = Math.round(a.altura * 255);
        relevo.data[i] = cinza;
        relevo.data[i + 1] = cinza;
        relevo.data[i + 2] = cinza;
        relevo.data[i + 3] = 255;
      }
    }
    ctxCor.putImageData(cor, 0, 0);
    ctxRelevo.putImageData(relevo, 0, 0);
  }

  const mapa = new CanvasTexture(telaCor);
  // Sem isto o three trata a cor como linear e o planeta sai lavado.
  mapa.colorSpace = SRGBColorSpace;
  mapa.anisotropy = 4;
  const relevo = new CanvasTexture(telaRelevo);
  relevo.anisotropy = 4;
  return { mapa, relevo };
}

/**
 * A superfície de um corpo vista DE FRENTE, e não desenrolada.
 *
 * `texturaPlaneta` entrega o mapa equirretangular, que é o que uma esfera que
 * gira precisa. O Astro do centro não gira: ele fica sempre de frente, com o
 * rosto projetado em linha reta sobre a esfera. Para a superfície casar com
 * essa projeção, cada pixel do quadrado amostra o ponto do hemisfério que fica
 * exatamente atrás dele — as faixas saem curvas como num globo, e não retas
 * como num adesivo.
 *
 * A cor volta como canvas, porque quem chama ainda vai pintar por cima; o
 * relevo já volta como textura.
 */
export function texturaDeFrente(
  estilo: EstiloPlaneta,
  paleta: Paleta,
  semente: number,
  lado = 512,
  inclinacao = 0.3,
): { cor: HTMLCanvasElement; relevo: Texture } {
  const superficie = SUPERFICIES[estilo](paleta, semente * 97 + 13);
  const telaCor = tela(lado, lado);
  const telaRelevo = tela(lado, lado);
  const ctxCor = telaCor.getContext("2d");
  const ctxRelevo = telaRelevo.getContext("2d");
  if (ctxCor && ctxRelevo) {
    const cor = ctxCor.createImageData(lado, lado);
    const relevo = ctxRelevo.createImageData(lado, lado);
    const cos = Math.cos(inclinacao);
    const sen = Math.sin(inclinacao);
    for (let py = 0; py < lado; py++) {
      const ny = 1 - ((py + 0.5) / lado) * 2;
      for (let px = 0; px < lado; px++) {
        let nx = ((px + 0.5) / lado) * 2 - 1;
        let y = ny;
        // Os cantos do quadrado ficam fora da esfera: amostram a borda dela,
        // para o filtro da textura não puxar uma cor estranha no contorno.
        const r2 = nx * nx + y * y;
        let z = 0;
        if (r2 > 1) {
          const r = Math.sqrt(r2);
          nx /= r;
          y /= r;
        } else {
          z = Math.sqrt(1 - r2);
        }
        const x = nx * cos - y * sen;
        const yy = nx * sen + y * cos;
        const a = superficie(x, yy, z, Math.atan2(z, x));
        const i = (py * lado + px) * 4;
        cor.data[i] = a.cor[0];
        cor.data[i + 1] = a.cor[1];
        cor.data[i + 2] = a.cor[2];
        cor.data[i + 3] = 255;
        const cinza = Math.round(a.altura * 255);
        relevo.data[i] = cinza;
        relevo.data[i + 1] = cinza;
        relevo.data[i + 2] = cinza;
        relevo.data[i + 3] = 255;
      }
    }
    ctxCor.putImageData(cor, 0, 0);
    ctxRelevo.putImageData(relevo, 0, 0);
  }
  return { cor: telaCor, relevo: new CanvasTexture(telaRelevo) };
}

/**
 * O estilo de cada corpo, derivado do id.
 *
 * Derivado, e não sorteado: assim a mesma solução tem sempre a mesma cara, e
 * quem conhece o produto reconhece o planeta antes de ler o rótulo.
 */
export function estiloDaFerramenta(toolId: string): EstiloPlaneta {
  const soma = [...toolId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const estilos: EstiloPlaneta[] = [
    "faixas",
    "rochoso",
    "continentes",
    "gelado",
  ];
  return estilos[soma % estilos.length] ?? "faixas";
}

/* --------------------------------------------------------------- o cosmos */

/**
 * Uma nuvem de nebulosa.
 *
 * Manchas suaves sobrepostas, com as bordas desfeitas pelo próprio desenho em
 * gradiente radial: é o que separa "nebulosa" de "borrão colorido". Vai em
 * plano distante, com mistura aditiva — por isso o preto do canvas sai de
 * graça, sem precisar de canal alfa recortado.
 */
export function texturaNebulosa(cor: string, semente: number): Texture {
  const r = sorteio(semente * 31 + 7);
  const c = tela(512, 512);
  const x = c.getContext("2d");
  if (!x) return new CanvasTexture(c);
  x.fillStyle = "#000";
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) {
    const px = 100 + r() * 312;
    const py = 100 + r() * 312;
    const raio = 50 + r() * 150;
    const g = x.createRadialGradient(px, py, 0, px, py, raio);
    g.addColorStop(0, cor);
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.globalAlpha = 0.1 + r() * 0.2;
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, raio, 0, Math.PI * 2);
    x.fill();
  }
  // Vinheta: sem ela a nuvem termina num quadrado visível.
  x.globalCompositeOperation = "destination-in";
  const v = x.createRadialGradient(256, 256, 40, 256, 256, 256);
  v.addColorStop(0, "rgba(0,0,0,1)");
  v.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = v;
  x.fillRect(0, 0, 512, 512);
  return new CanvasTexture(c);
}

/** O ponto de luz de uma estrela: núcleo branco com halo curto. */
export function texturaEstrela(): Texture {
  const c = tela(64, 64);
  const x = c.getContext("2d");
  if (!x) return new CanvasTexture(c);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.75)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}
