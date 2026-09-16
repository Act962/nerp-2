import {
  ASTRO_VIEWBOX,
  type AstroCamada,
  type AstroEstado,
  CAMADA_PADRAO,
  ESTADO_ZERO,
} from "@nerp/site-content";

/**
 * O catálogo de peças do ASTRO.
 *
 * São dois arquivos em `public/astro/camadas/`, e a divisão não é acidental:
 *
 * - `manifesto.json` é a ARTE OFICIAL desmontada — o globo, o rosto e as 48
 *   luvas recortados do PNG oficial, com as posições medidas nele. É daqui que
 *   sai o ASTRO que já existe no site.
 * - `pecas.json` é o pacote de EXPRESSÕES — 12 pares de olhos, 9 bocas, 24
 *   objetos e 6 fundos, desenhados depois para o editor. Vêm no tamanho em que
 *   foram desenhados, que é maior que a régua da cena: cada família tem o seu
 *   fator abaixo.
 *
 * Os arquivos moram no `apps/site` e chegam aqui pelo `copy-astro-camadas.mjs`
 * em dev/build, no mesmo caminho público. É o que faz uma cena montada neste
 * editor desenhar igual lá.
 */

export type PecaDoCatalogo = {
  id: string;
  nome: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LuvaDoCatalogo = {
  id: number;
  src: string;
  /** largura ÷ altura, para a luva não achatar ao ser posicionada */
  prop: number;
};

export type Manifesto = {
  viewBox: { w: number; h: number };
  fundo: string;
  corpo: { cx: number; cy: number; rx: number; ry: number };
  camadas: PecaDoCatalogo[];
  maos: LuvaDoCatalogo[];
  apelidos: Record<string, number>;
};

/** Um par de olhos: o mesmo modelo tem um recorte para cada lado. */
export type ModeloDeOlho = {
  id: string;
  nome: string;
  esq: string;
  dir: string;
  w: number;
  h: number;
};

/** Boca, objeto e fundo: uma peça só. */
export type ModeloDePeca = {
  id: string;
  nome: string;
  src: string;
  w: number;
  h: number;
};

export type Pecas = {
  olhos: ModeloDeOlho[];
  bocas: ModeloDePeca[];
  objetos: ModeloDePeca[];
  fundos: ModeloDePeca[];
};

export const PASTA_DAS_LUVAS = "/astro/camadas/maos/";
export const PASTA_DOS_OLHOS = "/astro/camadas/olhos/";
export const PASTA_DAS_BOCAS = "/astro/camadas/bocas/";
export const PASTA_DOS_OBJETOS = "/astro/camadas/objetos/";
export const PASTA_DOS_FUNDOS = "/astro/camadas/fundos/";

/**
 * Quanto encolher cada família ao trazer a peça para a régua da cena.
 *
 * Um fator por FAMÍLIA, e não um tamanho fixo por peça: é o que preserva a
 * proporção entre as expressões. Normalizar pela largura faria o "sorriso
 * largo" sair do mesmo tamanho do sorriso comum — perdendo justamente o que o
 * torna largo.
 *
 * Olhos e bocas são ancorados na arte oficial: o `aberto` do pacote é o olho do
 * `manifesto.json` (103,6 de largura contra 266) e o `sorriso` é a boca dele
 * (245,1 contra 727). Objetos não têm âncora — 0,26 põe uma peça de mil pixels
 * perto do tamanho de uma mão, que é a escala com que convivem na cena.
 */
const FATOR = {
  olho: 103.6 / 266,
  boca: 245.1 / 727,
  objeto: 0.26,
} as const;

let manifestoCache: Promise<Manifesto> | null = null;
let pecasCache: Promise<Pecas> | null = null;

export function carregarManifesto(): Promise<Manifesto> {
  if (!manifestoCache) {
    manifestoCache = fetch("/astro/camadas/manifesto.json").then(
      (r) => r.json() as Promise<Manifesto>,
    );
  }
  return manifestoCache;
}

export function carregarPecas(): Promise<Pecas> {
  if (!pecasCache) {
    pecasCache = fetch("/astro/camadas/pecas.json").then(
      (r) => r.json() as Promise<Pecas>,
    );
  }
  return pecasCache;
}

// ------------------------------------------------------------- quem é o quê

export function ehLuva(camada: AstroCamada): boolean {
  return camada.tipo === "imagem" && camada.src.startsWith(PASTA_DAS_LUVAS);
}

export function ehOlho(camada: AstroCamada): boolean {
  return camada.tipo === "imagem" && camada.src.startsWith(PASTA_DOS_OLHOS);
}

export function ehBoca(camada: AstroCamada): boolean {
  return camada.tipo === "imagem" && camada.src.startsWith(PASTA_DAS_BOCAS);
}

/**
 * De que lado do rosto está este olho.
 *
 * Sai do nome do arquivo (`..._esq.webp`), e não do id da camada: é o arquivo
 * que diz para que lado a peça foi desenhada, e trocar de modelo tem de
 * continuar do mesmo lado.
 */
export function ladoDoOlho(camada: AstroCamada): "esq" | "dir" {
  return camada.src.includes("_dir.") ? "dir" : "esq";
}

export function srcDoOlho(modelo: ModeloDeOlho, lado: "esq" | "dir"): string {
  return lado === "dir" ? modelo.dir : modelo.esq;
}

// ------------------------------------------------------------ montar camada

function estado(x: number, y: number): AstroEstado {
  return { ...ESTADO_ZERO, x, y };
}

function base(troca: Partial<AstroCamada>): AstroCamada {
  return {
    id: "",
    nome: "",
    tipo: "imagem",
    src: "",
    texto: "",
    cor: "#011121",
    largura: 100,
    altura: 100,
    ...CAMADA_PADRAO,
    ini: { ...ESTADO_ZERO },
    fim: { ...ESTADO_ZERO },
    ...troca,
  };
}

/**
 * O repouso: como cada peça respira na cena inicial.
 *
 * As durações não têm divisor comum de propósito. Com todas iguais as peças
 * sobem e descem em bloco e voltam a coincidir a cada volta — é o que dá a
 * impressão de mecanismo. Sem divisor comum elas nunca se repetem no mesmo
 * instante, e o mascote respira em vez de marchar.
 *
 * A cena nasce ANIMADA, e não parada com sete camadas em 1,2 s: o repouso é o
 * estado mais comum do mascote numa tela, e é dele que quem anima parte. Os
 * deslocamentos são pequenos — flutuar é sinal de vida, não de que algo
 * aconteceu.
 */
const REPOUSO: Record<
  string,
  { duracao: number; sobe: number; gira?: number }
> = {
  globo: { duracao: 2.6, sobe: 10 },
  // O rosto acompanha o globo de perto, senão descola dele ao flutuar.
  boca: { duracao: 2.6, sobe: 10 },
  olho_esq: { duracao: 2.6, sobe: 10 },
  olho_dir: { duracao: 2.6, sobe: 10 },
  mao_esq: { duracao: 1.7, sobe: 18, gira: -5 },
  mao_dir: { duracao: 2.3, sobe: 16, gira: 4 },
  bola: { duracao: 2.9, sobe: 24, gira: 8 },
};

/** O tamanho da peça já na régua da cena. */
function medida(m: { w: number; h: number }, fator: number) {
  return {
    largura: Math.round(m.w * fator),
    altura: Math.round(m.h * fator),
  };
}

/** Uma peça do manifesto oficial (hoje só o globo), no lugar em que nasceu. */
export function camadaDePeca(peca: PecaDoCatalogo): AstroCamada {
  return base({
    id: peca.id,
    nome: peca.nome,
    src: peca.src,
    largura: peca.w,
    altura: peca.h,
    ini: estado(peca.x, peca.y),
    fim: estado(peca.x, peca.y),
  });
}

export function camadaDeOlho(
  modelo: ModeloDeOlho,
  lado: "esq" | "dir",
  opcoes: { id: string; nome: string; x: number; y: number },
): AstroCamada {
  return base({
    id: opcoes.id,
    nome: opcoes.nome,
    src: srcDoOlho(modelo, lado),
    ...medida(modelo, FATOR.olho),
    ini: estado(opcoes.x, opcoes.y),
    fim: estado(opcoes.x, opcoes.y),
  });
}

/**
 * Onde a boca fica no rosto.
 *
 * As bocas do pacote são desenhadas CENTRADAS no próprio recorte, então o
 * lugar delas é o eixo do rosto. O `sorriso` oficial é a exceção e não é
 * descuido: ele é um arco desenhado no canto do recorte, e centralizá-lo
 * mudaria a cara com que o ASTRO já está no ar.
 */
const ANCORA_DA_BOCA = { x: 678, y: 742 };
const ANCORA_DO_SORRISO = { x: 541, y: 701 };

export function ancoraDaBoca(id: string): { x: number; y: number } {
  return id === "sorriso" ? ANCORA_DO_SORRISO : ANCORA_DA_BOCA;
}

export function camadaDeBoca(modelo: ModeloDePeca): AstroCamada {
  const centro = ancoraDaBoca(modelo.id);
  return base({
    id: "boca",
    nome: "Boca",
    src: modelo.src,
    ...medida(modelo, FATOR.boca),
    ini: estado(centro.x, centro.y),
    fim: estado(centro.x, centro.y),
  });
}

/**
 * Um objeto de cena — lâmpada, troféu, zzz, tela 404.
 *
 * Nasce no centro e com id gerado: o mesmo objeto pode entrar duas vezes (dois
 * corações, três estrelas) e cada um precisa do seu lugar na cena.
 */
export function camadaDeObjeto(modelo: ModeloDePeca): AstroCamada {
  return base({
    id: `obj-${modelo.id}-${Date.now().toString(36)}`,
    nome: modelo.nome,
    src: modelo.src,
    ...medida(modelo, FATOR.objeto),
    ini: estado(ASTRO_VIEWBOX.w / 2, ASTRO_VIEWBOX.h / 2),
    fim: estado(ASTRO_VIEWBOX.w / 2, ASTRO_VIEWBOX.h / 2),
  });
}

/**
 * Onde cada olho fica no rosto.
 *
 * Simétricos em torno do centro do globo, porque os modelos do pacote vêm em
 * PARES — um recorte para cada lado — e isso só faz sentido num rosto simétrico.
 * A arte oficial põe o olho aberto e a piscada em alturas diferentes, e a cena
 * inicial respeita isso; quem troca de expressão está pedindo outro rosto, e aí
 * os dois se alinham.
 */
export function ancoraDoOlho(lado: "esq" | "dir"): { x: number; y: number } {
  return { x: lado === "dir" ? 784 : 573, y: 592 };
}

/**
 * O que muda numa camada ao trocar de modelo.
 *
 * As medidas vêm JUNTO porque as expressões têm proporções bem diferentes — o
 * olho aberto é alto, o feliz é uma linha larga — e trocar só o arquivo
 * esticaria o desenho dentro da caixa do modelo anterior. Quem troca escolhe
 * uma expressão, não um retângulo.
 *
 * A peça também volta para a âncora do rosto, pela mesma regra da boca: só
 * enquanto início e fim forem iguais, isto é, enquanto ninguém tiver animado
 * aquela camada.
 */
export function trocaDeOlho(
  camada: AstroCamada,
  modelo: ModeloDeOlho,
): Partial<AstroCamada> {
  const lado = ladoDoOlho(camada);
  const troca: Partial<AstroCamada> = {
    src: srcDoOlho(modelo, lado),
    ...medida(modelo, FATOR.olho),
  };
  if (camada.ini.x !== camada.fim.x || camada.ini.y !== camada.fim.y) {
    return troca;
  }
  const centro = ancoraDoOlho(lado);
  return {
    ...troca,
    ini: { ...camada.ini, ...centro },
    fim: { ...camada.fim, ...centro },
  };
}

/**
 * Trocar de boca também RECOLOCA a peça no rosto — mas só enquanto a camada
 * não foi animada. Início e fim iguais querem dizer "ninguém mexeu ainda"; a
 * partir do momento em que a boca tem um movimento próprio, trocar o desenho
 * não pode jogar fora o trabalho de quem o fez.
 */
export function trocaDeBoca(
  camada: AstroCamada,
  modelo: ModeloDePeca,
): Partial<AstroCamada> {
  const troca: Partial<AstroCamada> = {
    src: modelo.src,
    ...medida(modelo, FATOR.boca),
  };
  if (camada.ini.x !== camada.fim.x || camada.ini.y !== camada.fim.y) {
    return troca;
  }
  const centro = ancoraDaBoca(modelo.id);
  return {
    ...troca,
    ini: { ...camada.ini, ...centro },
    fim: { ...camada.fim, ...centro },
  };
}

/** Uma luva do pacote, com a altura vindo da proporção real do recorte. */
export function camadaDeLuva(
  luva: LuvaDoCatalogo,
  opcoes: { id: string; nome: string; x: number; y: number; largura?: number },
): AstroCamada {
  const largura = opcoes.largura ?? 240;
  return base({
    id: opcoes.id,
    nome: opcoes.nome,
    src: luva.src,
    largura,
    altura: Math.round(largura / luva.prop),
    ini: estado(opcoes.x, opcoes.y),
    fim: estado(opcoes.x, opcoes.y),
  });
}

/**
 * Uma mão a mais, no centro do palco.
 *
 * O ASTRO nasce com três (duas mãos e a bola), mas nada impede uma cena de
 * quatro: o id é gerado justamente para a mesma luva poder entrar duas vezes.
 */
export function camadaDeMaoNova(
  luva: LuvaDoCatalogo,
  quantas: number,
): AstroCamada {
  return camadaDeLuva(luva, {
    id: `mao-${Date.now().toString(36)}`,
    nome: `Mão ${quantas + 1}`,
    x: ASTRO_VIEWBOX.w / 2,
    y: ASTRO_VIEWBOX.h / 2,
    largura: 230,
  });
}

/**
 * O globo — o corpo do ASTRO, no lugar em que nasceu na arte.
 *
 * Existe como peça acrescentável porque o X da lista apaga QUALQUER camada: sem
 * isto, apagar o corpo seria um caminho sem volta dentro do editor.
 */
export function camadaDeGlobo(m: Manifesto): AstroCamada | null {
  const globo = m.camadas.find((c) => c.id === "globo");
  return globo ? camadaDePeca(globo) : null;
}

/**
 * A bola branca: a esfera lisa que flutua ao lado da cabeça.
 *
 * NÃO é uma luva do pacote. É peça da arte oficial, recortada do
 * `ASTRO_2D_OFICIAL.svg` junto com o globo e o rosto: superfície lisa, brilho
 * no alto à esquerda, sem contorno e sem dedos. Substituí-la pelo punho
 * fechado do pacote de luvas — que tem traço preto e nós dos dedos — troca o
 * desenho do mascote por outro parecido, e foi exatamente o erro que esta
 * função existe para não repetir.
 *
 * Vem do `manifesto.json` como o globo e o rosto — posição e medidas são as da
 * arte, não chute.
 */
export function camadaDeBolaBranca(m: Manifesto): AstroCamada | null {
  const bola = m.camadas.find((c) => c.id === "bola");
  return bola ? camadaDePeca(bola) : null;
}

/** Um olho do lado pedido, aberto, na âncora do rosto. */
export function camadaDeOlhoNovo(
  p: Pecas,
  lado: "esq" | "dir",
): AstroCamada | null {
  const modelo = p.olhos.find((o) => o.id === "aberto") ?? p.olhos[0];
  if (!modelo) return null;
  const centro = ancoraDoOlho(lado);
  return camadaDeOlho(modelo, lado, {
    id: lado === "dir" ? "olho_dir" : "olho_esq",
    nome: lado === "dir" ? "Olho direito" : "Olho esquerdo",
    ...centro,
  });
}

/** A boca oficial, na âncora dela. */
export function camadaDeBocaNova(p: Pecas): AstroCamada | null {
  const modelo = p.bocas.find((b) => b.id === "sorriso") ?? p.bocas[0];
  return modelo ? camadaDeBoca(modelo) : null;
}

/** O balão de fala — o único texto que a cena aceita. */
export function camadaDeBalao(texto = "Precisa de ajuda?"): AstroCamada {
  return base({
    id: "balao",
    nome: "Balão de texto",
    tipo: "texto",
    texto,
    largura: 430,
    altura: 150,
    ini: estado(1040, 140),
    fim: estado(1040, 140),
  });
}

/**
 * Uma imagem que o editor enviou para o bucket.
 *
 * Guarda a KEY do R2, não a URL: é a mesma regra de `constructUrl`/`assetUrl`,
 * então a cena desenha nos dois apps e sobrevive a uma troca de bucket.
 */
export function camadaDeImagem(
  nome: string,
  key: string,
  largura: number,
  altura: number,
  centro: { x: number; y: number },
): AstroCamada {
  const max = 420;
  const k = largura > max ? max / largura : 1;
  return base({
    id: `img-${Date.now().toString(36)}`,
    nome,
    src: key,
    largura: Math.round(largura * k),
    altura: Math.round(altura * k),
    ini: estado(centro.x, centro.y),
    fim: estado(centro.x, centro.y),
  });
}

// ------------------------------------------------------------------- fundos

/**
 * As cores lisas oferecidas no fundo, além das seis imagens do pacote.
 *
 * `transparent` é o que permite o mascote entrar por cima de uma tela sem
 * carregar um retângulo consigo — é o fundo que o widget do consultor quer, e
 * por isso vem logo depois do oficial.
 */
export const CORES_DE_FUNDO = [
  { nome: "Oficial", cor: "#011121" },
  { nome: "Transparente", cor: "transparent" },
  { nome: "Azul ÓRBITA", cor: "#0B7BFE" },
  { nome: "Ciano", cor: "#2FC0FE" },
  { nome: "Grafite", cor: "#0E1E33" },
  { nome: "Branco", cor: "#FFFFFF" },
] as const;

// ---------------------------------------------------------------- cena base

/**
 * A cena inicial: o ASTRO montado como na arte oficial.
 *
 * A ordem importa — é a ordem de pintura, do fundo para a frente. O rosto sai
 * do pacote de expressões, mas nos modelos que REPRODUZEM a arte oficial
 * (`aberto` à esquerda, `wink` à direita, `sorriso`): quem abre o editor vê o
 * ASTRO de sempre, e a partir dele troca o que quiser.
 */
export function montarAstro(m: Manifesto, p: Pecas): AstroCamada[] {
  const camadas: AstroCamada[] = [];

  const globo = m.camadas.find((c) => c.id === "globo");
  if (globo) camadas.push(camadaDePeca(globo));

  const boca = p.bocas.find((b) => b.id === "sorriso") ?? p.bocas[0];
  if (boca) camadas.push(camadaDeBoca(boca));

  const aberto = p.olhos.find((o) => o.id === "aberto") ?? p.olhos[0];
  const wink = p.olhos.find((o) => o.id === "wink") ?? aberto;
  if (aberto) {
    camadas.push(
      camadaDeOlho(aberto, "esq", {
        id: "olho_esq",
        nome: "Olho esquerdo",
        x: 573,
        y: 592,
      }),
    );
  }
  if (wink) {
    camadas.push(
      camadaDeOlho(wink, "dir", {
        id: "olho_dir",
        nome: "Olho direito",
        x: 748,
        y: 660,
      }),
    );
  }

  const luva = (apelido: string) =>
    m.maos.find((x) => x.id === m.apelidos[apelido]) ?? m.maos[0];

  camadas.push(
    camadaDeLuva(luva("palma"), {
      id: "mao_esq",
      nome: "Mão esquerda",
      x: 205,
      y: 505,
      largura: 250,
    }),
    camadaDeLuva(luva("joinha"), {
      id: "mao_dir",
      nome: "Mão direita",
      x: 1075,
      y: 880,
      largura: 215,
    }),
  );

  const bola = camadaDeBolaBranca(m);
  if (bola) camadas.push(bola);

  // O repouso é aplicado no fim, sobre a cena montada, para a tabela ficar num
  // lugar só em vez de espalhada por sete chamadas.
  return camadas.map((c) => {
    const r = REPOUSO[c.id];
    if (!r) return c;
    return {
      ...c,
      duracao: r.duracao,
      easing: "sine.inOut" as const,
      fim: {
        ...c.ini,
        y: c.ini.y - r.sobe,
        rot: c.ini.rot + (r.gira ?? 0),
      },
    };
  });
}
