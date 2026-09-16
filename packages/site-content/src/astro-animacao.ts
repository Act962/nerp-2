import { z } from "zod";

/**
 * O formato das animações do ASTRO, e a conta que diz onde cada camada está
 * em cada instante.
 *
 * Mora no pacote de contrato porque os DOIS lados precisam da mesma resposta:
 * o editor do admin (`apps/web`, desenhando em Konva) e o mascote nas telas do
 * site (`apps/site`, desenhando em DOM). Fosse cada um com a sua conta, a
 * prévia do editor mentiria sobre o que o visitante vê.
 *
 * Nada aqui importa React, Konva ou o DOM: roda no servidor, num teste e num
 * renderizador de GIF sem mudar uma linha.
 */

/** O tamanho da arte oficial. Toda posição da cena é medida nesta régua. */
export const ASTRO_VIEWBOX = { w: 1332, h: 1190 } as const;

/** As suavizações oferecidas no editor. Os nomes seguem os do GSAP. */
export const EASINGS = [
  "none",
  "sine.inOut",
  "power1.inOut",
  "power2.inOut",
  "power2.out",
  "power3.out",
  "back.out",
  "elastic.out",
  "bounce.out",
] as const;

export const astroEasing = z.enum(EASINGS);
export type AstroEasing = z.infer<typeof astroEasing>;

/** O que uma camada é num instante: posição, giro, tamanho e opacidade. */
export const astroEstado = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  rot: z.number().default(0),
  esc: z.number().default(1),
  op: z.number().min(0).max(1).default(1),
});

export type AstroEstado = z.infer<typeof astroEstado>;

export const ESTADO_ZERO: AstroEstado = { x: 0, y: 0, rot: 0, esc: 1, op: 1 };

export const astroCamada = z.object({
  id: z.string().min(1),
  nome: z.string().default(""),
  tipo: z.enum(["imagem", "texto", "cor"]),
  /**
   * Imagem: key do R2 ou caminho começando em `/` (a arte que vem junto com o
   * app). É a mesma regra de `constructUrl`/`assetUrl`, então a mesma cena
   * desenha nos dois apps sem tradução.
   */
  src: z.string().default(""),
  /** texto: o conteúdo do balão */
  texto: z.string().default(""),
  /** cor: o fundo da cena */
  cor: z.string().default("#011121"),
  largura: z.number().positive().default(100),
  altura: z.number().positive().default(100),
  /**
   * Espelhar não é enfeite: é o que faz uma luva virar a mão do outro lado, e
   * o sorriso virar boca triste. A arte oficial tem UMA boca e um jogo só de
   * luvas — espelhar dobra o vocabulário sem inventar desenho.
   *
   * Fica na camada, e não no estado de início/fim, porque é identidade da peça
   * e não movimento: uma camada que espelhasse no meio da animação piscaria.
   */
  espelhoX: z.boolean().default(false),
  espelhoY: z.boolean().default(false),
  visivel: z.boolean().default(true),
  travada: z.boolean().default(false),
  ini: astroEstado.default(ESTADO_ZERO),
  fim: astroEstado.default(ESTADO_ZERO),
  duracao: z.number().min(0).default(1.2),
  atraso: z.number().min(0).default(0),
  easing: astroEasing.default("power2.inOut"),
  /** -1 = para sempre */
  repete: z.number().int().min(-1).default(-1),
  vaivem: z.boolean().default(true),
  /**
   * Descanso entre uma repetição e a seguinte, em segundos.
   *
   * Sem ele o formato só sabia fazer movimento CONTÍNUO: um ciclo emendava no
   * outro, e não havia como dizer "isto acontece de vez em quando". É o que
   * faltava para piscar — piscar é um evento de 0,1s a cada três segundos, não
   * uma oscilação sem fim.
   *
   * Durante o descanso a camada fica no estado em que a rodada a deixou, que
   * com vai e volta é o próprio início.
   */
  intervalo: z.number().min(0).default(0),
  /**
   * O id da camada cujo movimento esta acompanha, ou nulo.
   *
   * Guarda o LÍDER no seguidor, e não a lista de seguidores no líder, porque
   * assim é impossível uma camada seguir duas ao mesmo tempo — o campo só cabe
   * um. A tela edita a partir do líder, que é como se pensa ("estes vêm
   * comigo"), mas o que fica gravado é a dependência de cada um.
   */
  vinculo: z.string().nullable().default(null),
});

export type AstroCamada = z.infer<typeof astroCamada>;

export const astroAnimacao = z.object({
  versao: z.literal(1).default(1),
  slug: z.string().default(""),
  nome: z.string().default("Sem título"),
  /** em que momento da interface esta animação entra (ver MOMENTOS) */
  momento: z.string().nullable().default(null),
  /** duração da cena em segundos — é o que a linha do tempo mostra */
  duracao: z.number().positive().default(2.4),
  repete: z.boolean().default(true),
  camadas: z.array(astroCamada).default([]),
  atualizadaEm: z.string().optional(),
});

export type AstroAnimacao = z.infer<typeof astroAnimacao>;

/**
 * Os momentos em que o ASTRO aparece.
 *
 * A lista é fechada de propósito: é o contrato entre quem anima, no admin, e
 * quem escreve `<AstroAnimacao momento="..."/>` na tela. Momento novo aqui, e
 * só aqui — um campo livre viraria um mapa com erros de digitação que ninguém
 * descobre até a animação não aparecer.
 */
export const MOMENTOS = [
  { id: "widget-repouso", nome: "Widget · parado" },
  { id: "widget-chamando", nome: "Widget · chamando atenção" },
  { id: "widget-pensando", nome: "Widget · pensando" },
  { id: "popup-boas-vindas", nome: "Pop-up · boas-vindas" },
  { id: "popup-sucesso", nome: "Pop-up · sucesso" },
  { id: "popup-erro", nome: "Pop-up · erro" },
  { id: "carregando", nome: "Tela · carregando" },
  { id: "vazio", nome: "Tela · lista vazia" },
  { id: "404", nome: "Página 404" },
] as const;

export const MOMENTOS_IDS = MOMENTOS.map((m) => m.id);

export function nomeDoMomento(id: string): string {
  return MOMENTOS.find((m) => m.id === id)?.nome ?? id;
}

/**
 * Os tipos de movimento oferecidos no editor.
 *
 * NÃO são um campo novo no formato: cada um é uma combinação dos campos que já
 * existem — para onde a camada vai (`fim`), em quanto tempo, com que suavização
 * e quantas vezes. Guardar o NOME do preset seria guardar uma verdade que
 * envelhece: bastaria mexer na duração para o rótulo passar a mentir. Aqui o
 * preset é um atalho que escreve nos campos, e os campos continuam sendo a
 * verdade.
 *
 * Nenhum deles toca em `ini`. A posição de início é de quem arrasta no palco;
 * um preset que a mudasse moveria a peça de lugar quando só se pediu um
 * movimento.
 */
export type Movimento = {
  id: string;
  nome: string;
  aplicar: (camada: AstroCamada) => Partial<AstroCamada>;
};

function movimento(
  id: string,
  nome: string,
  fim: (ini: AstroEstado) => Partial<AstroEstado>,
  tempo: {
    duracao: number;
    easing: AstroEasing;
    repete: number;
    vaivem: boolean;
    intervalo?: number;
  },
): Movimento {
  return {
    id,
    nome,
    aplicar: (camada) => ({
      fim: { ...camada.ini, ...fim(camada.ini) },
      intervalo: 0,
      ...tempo,
    }),
  };
}

const SEMPRE = -1;
const UMA_VEZ = 0;

export const MOVIMENTOS: Movimento[] = [
  movimento("parado", "Parado", (i) => i, {
    duracao: 1,
    easing: "none",
    repete: UMA_VEZ,
    vaivem: false,
  }),
  movimento("flutuar", "Flutuar", (i) => ({ y: i.y - 42 }), {
    duracao: 1.8,
    easing: "sine.inOut",
    repete: SEMPRE,
    vaivem: true,
  }),
  movimento("pulsar", "Pulsar", (i) => ({ esc: i.esc * 1.08 }), {
    duracao: 0.7,
    easing: "sine.inOut",
    repete: SEMPRE,
    vaivem: true,
  }),
  movimento("esticar", "Esticar", (i) => ({ esc: i.esc * 1.3 }), {
    duracao: 0.5,
    easing: "power2.out",
    repete: SEMPRE,
    vaivem: true,
  }),
  // Sem vai e volta: a volta de um giro completo é o próprio giro seguinte.
  movimento("girar", "Girar", (i) => ({ rot: i.rot + 360 }), {
    duracao: 2.4,
    easing: "none",
    repete: SEMPRE,
    vaivem: false,
  }),
  movimento("balancar", "Balançar", (i) => ({ rot: i.rot + 12 }), {
    duracao: 0.9,
    easing: "sine.inOut",
    repete: SEMPRE,
    vaivem: true,
  }),
  // Curto e duro de propósito: tremor é alta frequência sem suavização.
  movimento("tremer", "Tremer", (i) => ({ x: i.x + 12 }), {
    duracao: 0.06,
    easing: "none",
    repete: SEMPRE,
    vaivem: true,
  }),
  movimento("pingue-pongue", "Pingue-pongue", (i) => ({ x: i.x + 240 }), {
    duracao: 1.2,
    easing: "power2.inOut",
    repete: SEMPRE,
    vaivem: true,
  }),
  // Uma vez só: puxar é entrada, não vaivém.
  movimento("puxar", "Puxar", (i) => ({ x: i.x - 150 }), {
    duracao: 0.6,
    easing: "power3.out",
    repete: UMA_VEZ,
    vaivem: false,
  }),
  /*
    Piscar é um EVENTO, não uma oscilação: some por um décimo de segundo e
    volta, a cada três segundos. Sem `intervalo` isso não existia — a peça
    piscaria sem parar, que é epilepsia, não olho.
  */
  movimento("piscar", "Piscar", () => ({ op: 0 }), {
    duracao: 0.09,
    easing: "none",
    repete: SEMPRE,
    vaivem: true,
    intervalo: 2.6,
  }),
  movimento("sumir", "Sumir", () => ({ op: 0 }), {
    duracao: 0.8,
    easing: "power2.out",
    repete: UMA_VEZ,
    vaivem: false,
  }),
];

export const CAMADA_PADRAO = {
  intervalo: 0,
  vinculo: null as string | null,
  espelhoX: false,
  espelhoY: false,
  visivel: true,
  travada: false,
  duracao: 1.2,
  atraso: 0,
  easing: "power2.inOut" as AstroEasing,
  repete: -1,
  vaivem: true,
};

// ---------------------------------------------------------------- easings

const back = 1.70158;

const CURVAS: Record<AstroEasing, (t: number) => number> = {
  none: (t) => t,
  "sine.inOut": (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  "power1.inOut": (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  "power2.inOut": (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  "power2.out": (t) => 1 - (1 - t) ** 3,
  "power3.out": (t) => 1 - (1 - t) ** 4,
  "back.out": (t) => 1 + (back + 1) * (t - 1) ** 3 + back * (t - 1) ** 2,
  "elastic.out": (t) =>
    t === 0 || t === 1
      ? t
      : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  "bounce.out": (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
    if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
    return n * (t - 2.625 / d) ** 2 + 0.984375;
  },
};

export function suavizar(easing: AstroEasing, t: number): number {
  return (CURVAS[easing] ?? CURVAS.none)(Math.min(Math.max(t, 0), 1));
}

// ---------------------------------------------------------------- tempo

/**
 * Onde a camada está no segundo `t` da cena.
 *
 * Antes do atraso ela fica parada no estado inicial. Depois do último ciclo
 * ela CONGELA onde parou — e para quem vai e volta um número par de vezes isso
 * é o início, não o fim. Sem essa distinção uma animação de entrada terminaria
 * saltando de volta para fora da tela.
 */
export function estadoNoTempo(camada: AstroCamada, t: number): AstroEstado {
  const { ini, fim, duracao, atraso, repete, vaivem, easing } = camada;
  const bruto = t - atraso;
  if (bruto <= 0 || duracao <= 0) return ini;

  const decorrido = semODescanso(camada, bruto);
  const ciclos = repete < 0 ? Number.POSITIVE_INFINITY : repete + 1;
  const volta = Math.floor(decorrido / duracao);

  let p: number;
  if (volta >= ciclos) {
    p = vaivem && ciclos % 2 === 0 ? 0 : 1;
  } else {
    p = (decorrido % duracao) / duracao;
    if (vaivem && volta % 2 === 1) p = 1 - p;
  }

  const f = suavizar(easing, p);
  return {
    x: ini.x + (fim.x - ini.x) * f,
    y: ini.y + (fim.y - ini.y) * f,
    rot: ini.rot + (fim.rot - ini.rot) * f,
    esc: ini.esc + (fim.esc - ini.esc) * f,
    op: ini.op + (fim.op - ini.op) * f,
  };
}

/**
 * O tempo da camada com os descansos tirados fora.
 *
 * O relógio da animação só anda durante o movimento; no intervalo ele PARA no
 * fim do bloco, e é isso que segura a peça parada entre uma repetição e outra.
 * Mapear o tempo assim, em vez de reescrever a conta dos ciclos, é o que faz
 * `intervalo: 0` devolver exatamente o comportamento de antes — a fórmula
 * abaixo vira a identidade.
 *
 * O bloco que se repete é a ida (e a volta, quando há vai e volta): descansar
 * no meio de um vaivém deixaria a peça pendurada longe de casa.
 */
function semODescanso(camada: AstroCamada, decorrido: number): number {
  const { duracao, vaivem, intervalo } = camada;
  if (intervalo <= 0) return decorrido;

  const bloco = vaivem ? duracao * 2 : duracao;
  const rodada = bloco + intervalo;
  const numero = Math.floor(decorrido / rodada);
  return numero * bloco + Math.min(decorrido % rodada, bloco);
}

/**
 * O quadro inteiro: o estado de cada camada visível, indexado por id.
 *
 * `t` é o relógio CORRIDO desde que a cena começou — nunca zerado por quem
 * chama. É aqui dentro que o laço acontece, e ele não acontece para todo mundo:
 *
 * - quem repete PARA SEMPRE ignora o laço e segue no relógio corrido. O ponto
 *   em que a cena reinicia não tem relação nenhuma com o ciclo dessa camada, e
 *   cortar ali é o que fazia a bola saltar assim que as durações deixavam de
 *   ser todas iguais. É o preço de exigir que tudo caiba na mesma volta — e o
 *   contrário do que "para sempre" promete.
 * - quem tem número de repetições PRECISA do laço, senão terminava no primeiro
 *   ciclo e a cena nunca mais o mostraria.
 *
 * Cena que não repete não tem laço: o tempo para no fim e as camadas congelam
 * onde `estadoNoTempo` as deixa.
 */
export function quadro(
  animacao: AstroAnimacao,
  t: number,
): Record<string, AstroEstado> {
  const total = duracaoReal(animacao);
  const noLaco = animacao.repete ? t % total : Math.min(t, total);

  const saida: Record<string, AstroEstado> = {};
  for (const camada of animacao.camadas) {
    if (!camada.visivel) continue;
    saida[camada.id] = estadoNoTempo(camada, camada.repete < 0 ? t : noLaco);
  }
  return saida;
}

/** Quanto a cena dura de fato — a maior soma de atraso + duração. */
export function duracaoReal(animacao: AstroAnimacao): number {
  const fim = animacao.camadas.reduce((maior, c) => {
    // Camada que repete para sempre não tem fim a somar: quem manda na duração
    // é a cena.
    if (c.repete < 0) return maior;
    // `repete` conta TRAVESSIAS, não idas e voltas — o vaivém não dobra a
    // conta. O que o descanso acrescenta é um intervalo por bloco concluído.
    const travessias = c.repete + 1;
    const descansos = Math.floor(travessias / (c.vaivem ? 2 : 1));
    return Math.max(
      maior,
      c.atraso + c.duracao * travessias + c.intervalo * descansos,
    );
  }, 0);
  return Math.max(animacao.duracao, fim, 0.1);
}

// ---------------------------------------------------------------- apoio

export function slugificarAnimacao(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------- vínculos

/**
 * Quem esta camada segue, no fim da corrente.
 *
 * Vai até a raiz porque seguir quem segue outro é seguir o outro: todos os elos
 * copiam o MESMO deslocamento e os MESMOS tempos, então resolver contra a raiz
 * dá o mesmo resultado sem depender da ordem em que as camadas aparecem.
 *
 * Devolve nulo quando a corrente está quebrada (o líder foi apagado) ou quando
 * ela se fecha num ciclo — que a tela impede, mas um `Json` editado à mão não.
 */
function raizDoVinculo(
  porId: Map<string, AstroCamada>,
  camada: AstroCamada,
): AstroCamada | null {
  const vistos = new Set<string>([camada.id]);
  let atual = camada;
  while (atual.vinculo) {
    if (vistos.has(atual.vinculo)) return null;
    vistos.add(atual.vinculo);
    const proximo = porId.get(atual.vinculo);
    if (!proximo) return null;
    atual = proximo;
  }
  return atual === camada ? null : atual;
}

/**
 * O seguidor com o movimento do líder, PARTINDO DO LUGAR DELE.
 *
 * É o deslocamento que se copia, não o destino: copiar o `fim` bruto faria o
 * seguidor saltar para cima do líder, e o que se quer é que ele faça o mesmo
 * gesto de onde está.
 */
function comMovimentoDe(
  seguidor: AstroCamada,
  lider: AstroCamada,
): AstroCamada {
  const d = {
    x: lider.fim.x - lider.ini.x,
    y: lider.fim.y - lider.ini.y,
    rot: lider.fim.rot - lider.ini.rot,
    esc: lider.fim.esc - lider.ini.esc,
    op: lider.fim.op - lider.ini.op,
  };
  return {
    ...seguidor,
    fim: {
      x: seguidor.ini.x + d.x,
      y: seguidor.ini.y + d.y,
      rot: seguidor.ini.rot + d.rot,
      esc: seguidor.ini.esc + d.esc,
      // A opacidade é o único canal com teto: somar o delta pode passar de 1,
      // e o formato recusaria a cena inteira por causa disso.
      op: Math.min(Math.max(seguidor.ini.op + d.op, 0), 1),
    },
    duracao: lider.duracao,
    atraso: lider.atraso,
    easing: lider.easing,
    repete: lider.repete,
    vaivem: lider.vaivem,
  };
}

/**
 * Reescreve todo seguidor a partir do seu líder.
 *
 * Roda depois de QUALQUER mudança na cena, e não só quando o líder muda: é
 * idempotente, custa uma passada e dispensa descobrir o que mudou. Líder
 * apagado desfaz o vínculo em vez de deixar um ponteiro solto.
 */
export function sincronizarVinculos(camadas: AstroCamada[]): AstroCamada[] {
  const porId = new Map(camadas.map((c) => [c.id, c]));
  return camadas.map((c) => {
    if (!c.vinculo) return c;
    const lider = raizDoVinculo(porId, c);
    return lider ? comMovimentoDe(c, lider) : { ...c, vinculo: null };
  });
}

/**
 * Esta camada pode passar a seguir aquela?
 *
 * Não pode seguir a si mesma, nem seguir alguém que já a segue — seria uma
 * corrente fechada, e movimento sem origem.
 */
export function podeSeguir(
  camadas: AstroCamada[],
  seguidorId: string,
  liderId: string,
): boolean {
  if (seguidorId === liderId) return false;
  const porId = new Map(camadas.map((c) => [c.id, c]));
  const vistos = new Set<string>();
  let atual = porId.get(liderId);
  while (atual?.vinculo) {
    if (atual.vinculo === seguidorId) return false;
    if (vistos.has(atual.vinculo)) return false;
    vistos.add(atual.vinculo);
    atual = porId.get(atual.vinculo);
  }
  return true;
}

/**
 * O sinal da escala em cada eixo, já com o espelho aplicado.
 *
 * Existe aqui, e não em cada renderizador, porque o Konva e o DOM têm de
 * chegar ao mesmo número: escala negativa é o que espelha nos dois.
 */
export function escalaComEspelho(
  camada: AstroCamada,
  estado: AstroEstado,
): { x: number; y: number } {
  return {
    x: estado.esc * (camada.espelhoX ? -1 : 1),
    y: estado.esc * (camada.espelhoY ? -1 : 1),
  };
}

/** Uma cena vazia, só com o fundo — o ponto de partida do editor. */
export function cenaNova(nome = "Sem título"): AstroAnimacao {
  return {
    versao: 1,
    slug: slugificarAnimacao(nome) || "sem-titulo",
    nome,
    momento: null,
    duracao: 2.4,
    repete: true,
    camadas: [
      {
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
      },
    ],
  };
}

// ------------------------------------------------------------- fronteiras

/**
 * O que `/api/site/astro/animacoes` devolve: momento → cena.
 *
 * Um mapa, e não uma lista, porque é assim que quem desenha pergunta — pelo
 * momento. Qual cena responde por ele é decisão de quem edita, no admin, e
 * muda sem tocar em código de tela.
 */
export const astroAnimacoesResponse = z.object({
  momentos: z.record(z.string(), astroAnimacao).default({}),
});

export type AstroAnimacoesResponse = z.infer<typeof astroAnimacoesResponse>;

/**
 * Entre os dois apps há uma rede, e entre o editor e o banco há um `Json` sem
 * tipo: o formato é conferido nas duas pontas. Cena torta vira silêncio — o
 * mascote não aparece — e nunca uma tela quebrada.
 */
export function lerAnimacao(dado: unknown): AstroAnimacao | null {
  const lido = astroAnimacao.safeParse(dado);
  if (!lido.success) return null;
  return lido.data;
}

export function lerAnimacoesPorMomento(
  dado: unknown,
): Record<string, AstroAnimacao> {
  const lido = astroAnimacoesResponse.safeParse(dado);
  if (!lido.success) return {};
  return lido.data.momentos;
}
