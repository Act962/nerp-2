import {
  type AstroCamada,
  ASTRO_VIEWBOX,
  CAMADA_PADRAO,
  ESTADO_ZERO,
} from "@nerp/site-content";
import {
  camadaDeBolaBranca,
  camadaDeGlobo,
  camadaDeLuva,
  camadaDeOlho,
  type Manifesto,
  type ModeloDePeca,
  type Pecas,
  trocaDeBoca,
} from "./astro-catalogo";

/**
 * As 25 poses do ASTRO, como DADOS.
 *
 * Cada uma é uma receita — que olhos, que boca, que luvas onde, que objetos —
 * e não uma cena pronta: as camadas saem do mesmo catálogo que o editor usa, e
 * uma peça redesenhada aparece nas 25 sem ninguém reescrever nada.
 *
 * Ser dado é também o que faz a mesma lista servir a dois consumidores: o
 * editor, que as oferece como ponto de partida, e o `seed-astro-poses.ts`, que
 * as grava no banco para irem ao ar.
 *
 * O que elas NÃO são: cópias da folha de referência. A folha é ilustração
 * acabada, com mãos desenhadas para cada gesto; aqui há 16 luvas nomeadas e 24
 * objetos, e a pose é a melhor composição possível com elas. A leitura é a
 * mesma — dorme, comemora, procura — mas o enquadramento não é idêntico, e é
 * por isso que elas entram como PONTO DE PARTIDA editável, não como arte final.
 */

/** Onde as coisas ficam, em relação ao corpo. Evita números soltos na receita. */
const P = {
  /** centro do globo */
  cx: 678,
  cy: 592,
  /** ao lado do corpo */
  esq: 215,
  dir: 1115,
  /** à frente do corpo, mãos juntas */
  frenteEsq: 545,
  frenteDir: 815,
  /** alturas úteis */
  alto: 380,
  meio: 620,
  baixo: 900,
  /** acima da cabeça */
  acima: 200,
} as const;

type MaoNaPose = {
  /** apelido do manifesto: palma, joinha, aponta, concha… */
  gesto: string;
  x: number;
  y: number;
  largura?: number;
  rot?: number;
  /** espelha no eixo X — é o que faz a luva virar a mão do outro lado */
  espelho?: boolean;
};

type ObjetoNaPose = {
  id: string;
  x: number;
  y: number;
  largura?: number;
  rot?: number;
  /**
   * Pintado DEPOIS das mãos. O padrão é antes, que é o que faz um objeto
   * segurado aparecer atrás dos dedos em vez de cobri-los.
   */
  frente?: boolean;
  /** Pintado ANTES do corpo — o rastro de quem voa fica para trás dele. */
  fundo?: boolean;
};

export type PoseDefinida = {
  id: string;
  nome: string;
  /** o momento da interface que esta pose atende, quando há um */
  momento?: string;
  /**
   * O par de olhos. Uma expressão vale para os dois lados; duas dão o rosto
   * ASSIMÉTRICO da arte oficial — cápsula à esquerda, `<` à direita — que é a
   * cara com que o ASTRO já está no ar. Aplicar `wink` nos dois virava `><`,
   * que lê como olhos apertados e apaga a assinatura do mascote.
   */
  olhos: string | [string, string];
  boca: string;
  maos?: MaoNaPose[];
  objetos?: ObjetoNaPose[];
  /** poses em que a bola branca não cabe (mãos ocupadas, objeto no lugar dela) */
  semBola?: boolean;
};

export const POSES: PoseDefinida[] = [
  {
    id: "aceno",
    nome: "Aceno",
    momento: "popup-boas-vindas",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    maos: [
      { gesto: "palma_alta", x: P.esq, y: P.alto, largura: 250, rot: -18 },
      { gesto: "joinha", x: 1075, y: P.baixo, largura: 215 },
    ],
  },
  {
    id: "joinha",
    nome: "Joinha",
    momento: "popup-sucesso",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    maos: [
      { gesto: "punho", x: 250, y: P.meio, largura: 225 },
      { gesto: "joinha", x: 1090, y: 780, largura: 240, rot: -10 },
    ],
  },
  {
    id: "alegre",
    nome: "Alegre",
    olhos: "feliz",
    boca: "sorriso_largo",
    maos: [
      { gesto: "punho", x: 255, y: 430, largura: 215, rot: -20 },
      { gesto: "espalmada", x: 1090, y: 700, largura: 245 },
    ],
    objetos: [
      { id: "estrela5", x: 980, y: 245, largura: 130, frente: true },
      { id: "estrela5", x: 300, y: 980, largura: 95, frente: true },
      { id: "estrela5", x: 760, y: 1040, largura: 110, frente: true },
    ],
  },
  {
    id: "coracao",
    nome: "Coração nas mãos",
    olhos: "apertado",
    boca: "sorriso",
    semBola: true,
    maos: [
      { gesto: "concha", x: P.frenteEsq, y: 905, largura: 240, rot: 25 },
      {
        gesto: "concha",
        x: P.frenteDir,
        y: 905,
        largura: 240,
        rot: -25,
        espelho: true,
      },
    ],
    objetos: [
      { id: "coracao", x: 678, y: 910, largura: 210 },
      { id: "coracao", x: 300, y: 300, largura: 150, frente: true },
      { id: "coracao", x: 420, y: 470, largura: 110, frente: true },
      { id: "coracao", x: 1035, y: 830, largura: 95, frente: true },
    ],
  },
  {
    id: "estiloso",
    nome: "Estiloso",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    maos: [
      { gesto: "aponta_esq", x: 230, y: 700, largura: 230 },
      { gesto: "aponta_dir", x: 1110, y: 700, largura: 230 },
    ],
    objetos: [
      { id: "oculos", x: P.cx, y: 570, largura: 420, frente: true },
      { id: "brilho4", x: 330, y: 250, largura: 120, frente: true },
    ],
  },
  {
    id: "gargalhada",
    nome: "Gargalhada",
    olhos: "apertado",
    boca: "gargalhada",
    maos: [
      { gesto: "espalmada", x: 235, y: 690, largura: 245 },
      { gesto: "espalmada", x: 1110, y: 690, largura: 245, espelho: true },
    ],
    objetos: [{ id: "brilho4", x: 250, y: 285, largura: 130, frente: true }],
  },
  {
    id: "surpreso",
    nome: "Surpreso",
    olhos: "surpreso",
    boca: "surpresa",
    semBola: true,
    maos: [
      { gesto: "espalmada", x: 330, y: 935, largura: 235 },
      { gesto: "espalmada", x: 1020, y: 935, largura: 235, espelho: true },
    ],
    objetos: [{ id: "brilho4", x: 295, y: 300, largura: 150, frente: true }],
  },
  {
    id: "duvida",
    nome: "Dúvida",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    maos: [
      { gesto: "aponta", x: 800, y: 905, largura: 230, rot: -15 },
      { gesto: "punho", x: 1090, y: 480, largura: 200 },
    ],
    objetos: [{ id: "interrogacao", x: 280, y: 330, largura: 160 }],
  },
  {
    id: "triste",
    nome: "Triste",
    momento: "popup-erro",
    olhos: "triste",
    boca: "triste",
    semBola: true,
    maos: [
      { gesto: "palma", x: 315, y: 960, largura: 230, rot: 12 },
      {
        gesto: "palma",
        x: 1040,
        y: 960,
        largura: 230,
        rot: -12,
        espelho: true,
      },
    ],
    objetos: [
      { id: "nuvem_chuva", x: 560, y: 150, largura: 340, frente: true },
    ],
  },
  {
    id: "bravo",
    nome: "Bravo",
    olhos: "bravo",
    boca: "neutra",
    semBola: true,
    maos: [
      { gesto: "punho", x: 300, y: 930, largura: 235 },
      { gesto: "punho", x: 1055, y: 930, largura: 235, espelho: true },
    ],
    objetos: [
      { id: "raiva", x: 1000, y: 300, largura: 180, frente: true },
      { id: "vapor", x: 330, y: 300, largura: 160, frente: true },
      { id: "vapor", x: 1120, y: 470, largura: 130, frente: true },
    ],
  },
  {
    id: "dormindo",
    nome: "Dormindo",
    olhos: "dormindo",
    boca: "sorriso_peq",
    semBola: true,
    maos: [
      { gesto: "concha", x: 545, y: 935, largura: 240, rot: 18 },
      {
        gesto: "concha",
        x: 790,
        y: 950,
        largura: 240,
        rot: -12,
        espelho: true,
      },
    ],
    objetos: [
      { id: "gorro", x: 505, y: 225, largura: 330, rot: -12, frente: true },
      { id: "zzz", x: 1030, y: 265, largura: 230, frente: true },
    ],
  },
  {
    id: "cansado",
    nome: "Cansado",
    olhos: "cansado",
    boca: "ondulada",
    semBola: true,
    maos: [
      { gesto: "palma", x: 325, y: 955, largura: 225, rot: 20 },
      {
        gesto: "palma",
        x: 1035,
        y: 955,
        largura: 225,
        rot: -20,
        espelho: true,
      },
    ],
    objetos: [
      { id: "bateria", x: 415, y: 250, largura: 250 },
      { id: "espiral", x: 1020, y: 300, largura: 110, frente: true },
    ],
  },
  {
    id: "ideia",
    nome: "Ideia",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    maos: [
      { gesto: "aponta", x: 330, y: 460, largura: 230, rot: -12 },
      { gesto: "joinha", x: 1075, y: P.baixo, largura: 215 },
    ],
    objetos: [{ id: "lampada", x: 290, y: 215, largura: 270, frente: true }],
  },
  {
    id: "dinheiro",
    nome: "Dinheiro",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    semBola: true,
    maos: [
      { gesto: "palma_alta", x: 250, y: 520, largura: 235, rot: -14 },
      { gesto: "segura", x: 1000, y: 800, largura: 240, rot: -10 },
    ],
    objetos: [
      { id: "dinheiro", x: 1045, y: 700, largura: 300, rot: -8 },
      { id: "brilho4", x: 1145, y: 430, largura: 110, frente: true },
    ],
  },
  {
    id: "celular",
    nome: "No celular",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    semBola: true,
    maos: [
      { gesto: "segura", x: 540, y: 930, largura: 230, rot: 12 },
      {
        gesto: "segura",
        x: 830,
        y: 930,
        largura: 230,
        rot: -12,
        espelho: true,
      },
    ],
    objetos: [
      { id: "celular", x: 690, y: 870, largura: 215 },
      { id: "coracao", x: 1055, y: 330, largura: 120, frente: true },
    ],
  },
  {
    id: "trabalhando",
    nome: "Trabalhando",
    momento: "carregando",
    olhos: ["aberto", "wink"],
    boca: "sorriso_peq",
    semBola: true,
    maos: [
      { gesto: "palma", x: 480, y: 900, largura: 215, rot: 10 },
      { gesto: "palma", x: 880, y: 900, largura: 215, rot: -10, espelho: true },
    ],
    objetos: [{ id: "laptop", x: 678, y: 905, largura: 430, frente: true }],
  },
  {
    id: "procurando",
    nome: "Procurando",
    momento: "vazio",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    semBola: true,
    maos: [
      { gesto: "segura", x: 330, y: 830, largura: 230, rot: 20 },
      { gesto: "punho", x: 1085, y: 620, largura: 205 },
    ],
    objetos: [{ id: "lupa", x: 395, y: 700, largura: 340, rot: -20 }],
  },
  {
    id: "voando",
    nome: "Voando",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    semBola: true,
    maos: [
      { gesto: "punho", x: 1010, y: 430, largura: 235, rot: -25 },
      { gesto: "punho", x: 905, y: 890, largura: 205, rot: -18 },
    ],
    // O rastro entra ANTES do globo — velocidade é o que fica para trás.
    objetos: [
      { id: "rastro", x: 300, y: 880, largura: 780, rot: -22, fundo: true },
    ],
  },
  {
    id: "aprovado",
    nome: "Aprovado",
    momento: "widget-chamando",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    maos: [
      { gesto: "punho", x: 260, y: 640, largura: 215 },
      { gesto: "joinha", x: 1065, y: 745, largura: 250, rot: -8 },
    ],
    objetos: [
      { id: "brilho4", x: 1060, y: 265, largura: 120, frente: true },
      { id: "estrela5", x: 290, y: 300, largura: 95, frente: true },
    ],
  },
  {
    id: "encantado",
    nome: "Encantado",
    olhos: "estrela",
    boca: "gargalhada",
    semBola: true,
    maos: [
      { gesto: "espalmada", x: 350, y: 930, largura: 235, rot: 15 },
      {
        gesto: "espalmada",
        x: 1010,
        y: 930,
        largura: 235,
        rot: -15,
        espelho: true,
      },
    ],
    objetos: [
      { id: "brilho4", x: 275, y: 290, largura: 130, frente: true },
      { id: "brilho4", x: 1085, y: 300, largura: 110, frente: true },
      { id: "estrela5", x: 1115, y: 830, largura: 90, frente: true },
    ],
  },
  {
    id: "erro-404",
    nome: "Erro 404",
    momento: "404",
    olhos: "morto",
    boca: "ondulada",
    semBola: true,
    maos: [
      { gesto: "palma", x: 305, y: 950, largura: 230, rot: 25 },
      { gesto: "espalmada", x: 1055, y: 930, largura: 230, espelho: true },
    ],
    objetos: [
      { id: "tela404", x: 760, y: 260, largura: 330, frente: true },
      { id: "balao_erro", x: 255, y: 430, largura: 170, frente: true },
    ],
  },
  {
    id: "amor",
    nome: "Abraçando o coração",
    olhos: "feliz",
    boca: "sorriso_peq",
    semBola: true,
    maos: [
      { gesto: "concha", x: 520, y: 900, largura: 235, rot: 30 },
      {
        gesto: "concha",
        x: 845,
        y: 900,
        largura: 235,
        rot: -30,
        espelho: true,
      },
    ],
    objetos: [
      { id: "coracao", x: 678, y: 880, largura: 230 },
      { id: "coracao", x: 320, y: 430, largura: 95, frente: true },
      { id: "coracao", x: 1075, y: 545, largura: 80, frente: true },
    ],
  },
  {
    id: "lendo",
    nome: "Lendo",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    semBola: true,
    maos: [
      { gesto: "palma", x: 445, y: 915, largura: 220, rot: 25 },
      { gesto: "palma", x: 915, y: 915, largura: 220, rot: -25, espelho: true },
    ],
    objetos: [{ id: "livro", x: 678, y: 930, largura: 380, frente: true }],
  },
  {
    id: "vitoria",
    nome: "Vitória",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    semBola: true,
    maos: [
      { gesto: "segura", x: 330, y: 500, largura: 230, rot: -20 },
      { gesto: "joinha", x: 1075, y: 880, largura: 215 },
    ],
    objetos: [
      { id: "trofeu", x: 300, y: 320, largura: 280, rot: -12 },
      { id: "confete", x: 678, y: 592, largura: 900, frente: true },
    ],
  },
  {
    id: "orbita",
    nome: "Em órbita",
    momento: "widget-repouso",
    olhos: ["aberto", "wink"],
    boca: "sorriso",
    maos: [
      { gesto: "palma", x: 225, y: 545, largura: 235 },
      { gesto: "joinha", x: 1090, y: 830, largura: 225 },
    ],
    objetos: [
      { id: "planeta", x: 678, y: 700, largura: 900, frente: true },
      { id: "estrela5", x: 250, y: 290, largura: 85, frente: true },
      { id: "estrela5", x: 1110, y: 350, largura: 70, frente: true },
    ],
  },
];

// ------------------------------------------------------------------ montagem

function estado(x: number, y: number, rot = 0) {
  return { ...ESTADO_ZERO, x, y, rot };
}

function camadaDeObjetoNaPose(
  modelo: ModeloDePeca,
  o: ObjetoNaPose,
  indice: number,
): AstroCamada {
  // A largura da pose manda, e a altura sai da proporção do desenho: o mesmo
  // objeto aparece em tamanhos diferentes conforme a cena, e esticá-lo seria
  // pior do que não usá-lo.
  const largura = o.largura ?? Math.round(modelo.w * 0.26);
  return {
    id: `obj-${o.id}-${indice}`,
    nome: modelo.nome,
    tipo: "imagem",
    src: modelo.src,
    texto: "",
    cor: "#011121",
    largura,
    altura: Math.round((largura * modelo.h) / modelo.w),
    ...CAMADA_PADRAO,
    ini: estado(o.x, o.y, o.rot ?? 0),
    fim: estado(o.x, o.y, o.rot ?? 0),
  };
}

/**
 * A pose virada em camadas, na ordem de pintura.
 *
 * O que decide a ordem é o que deve ficar na frente do quê: objeto segurado
 * entra ANTES das mãos, para os dedos aparecerem sobre ele; objeto de ambiente
 * — estrela, nuvem, confete, o aro do planeta — entra depois de tudo.
 */
export function montarPose(
  pose: PoseDefinida,
  m: Manifesto,
  p: Pecas,
): AstroCamada[] {
  const camadas: AstroCamada[] = [];

  const objetosDaPose = (pose.objetos ?? []).map((o, i) => {
    const modelo = p.objetos.find((x) => x.id === o.id);
    return modelo ? { o, camada: camadaDeObjetoNaPose(modelo, o, i) } : null;
  });

  // Objeto de FUNDO entra antes do corpo: é o caso do rastro de velocidade,
  // que por definição fica para trás de quem voa.
  for (const item of objetosDaPose) {
    if (item?.o.fundo) camadas.push(item.camada);
  }

  const globo = camadaDeGlobo(m);
  if (globo) camadas.push(globo);

  const boca = p.bocas.find((b) => b.id === pose.boca) ?? p.bocas[0];
  if (boca) {
    const base = p.bocas.find((b) => b.id === "sorriso") ?? boca;
    const molde = {
      id: "boca",
      nome: "Boca",
      tipo: "imagem" as const,
      src: base.src,
      texto: "",
      cor: "#011121",
      largura: 245,
      altura: 240,
      ...CAMADA_PADRAO,
      ini: estado(678, 742),
      fim: estado(678, 742),
    };
    camadas.push({ ...molde, ...trocaDeBoca(molde, boca) });
  }

  const [idEsq, idDir] = Array.isArray(pose.olhos)
    ? pose.olhos
    : [pose.olhos, pose.olhos];
  const olhoEsq = p.olhos.find((o) => o.id === idEsq) ?? p.olhos[0];
  const olhoDir = p.olhos.find((o) => o.id === idDir) ?? p.olhos[0];
  if (olhoEsq && olhoDir) {
    camadas.push(
      camadaDeOlho(olhoEsq, "esq", {
        id: "olho_esq",
        nome: "Olho esquerdo",
        x: 573,
        y: 592,
      }),
      camadaDeOlho(olhoDir, "dir", {
        id: "olho_dir",
        nome: "Olho direito",
        // O `<` da arte oficial fica mais baixo que a cápsula; alinhá-los pela
        // régua deixaria o rosto simétrico e, de novo, sem a assinatura.
        x: idDir === "wink" && idEsq !== idDir ? 748 : 784,
        y: idDir === "wink" && idEsq !== idDir ? 660 : 592,
      }),
    );
  }

  for (const item of objetosDaPose) {
    if (item && !item.o.frente && !item.o.fundo) camadas.push(item.camada);
  }

  (pose.maos ?? []).forEach((mao, i) => {
    const luva = m.maos.find((x) => x.id === m.apelidos[mao.gesto]);
    if (!luva) return;
    const camada = camadaDeLuva(luva, {
      id: i === 0 ? "mao_esq" : `mao_${i}`,
      nome: i === 0 ? "Mão esquerda" : `Mão ${i + 1}`,
      x: mao.x,
      y: mao.y,
      largura: mao.largura,
    });
    camadas.push({
      ...camada,
      espelhoX: mao.espelho ?? false,
      ini: estado(mao.x, mao.y, mao.rot ?? 0),
      fim: estado(mao.x, mao.y, mao.rot ?? 0),
    });
  });

  if (!pose.semBola) {
    const bola = camadaDeBolaBranca(m);
    if (bola) camadas.push(bola);
  }

  for (const item of objetosDaPose) {
    if (item?.o.frente) camadas.push(item.camada);
  }

  return camadas;
}

/** O fundo que toda pose usa: o mesmo azul-noite da arte oficial. */
export function fundoDaPose(): AstroCamada {
  return {
    id: "fundo",
    nome: "Fundo",
    tipo: "cor",
    src: "",
    texto: "",
    cor: "#011121",
    largura: ASTRO_VIEWBOX.w,
    altura: ASTRO_VIEWBOX.h,
    ...CAMADA_PADRAO,
    travada: true,
    ini: { ...ESTADO_ZERO },
    fim: { ...ESTADO_ZERO },
  };
}
