import { ORBITAS, type Orbita } from "@nerp/site-content";
import type { Paleta } from "./texturas";

/**
 * A geometria da jornada.
 *
 * Fora do componente de propósito: o fallback em HTML, a cena 3D e o passo a
 * passo guiado precisam concordar sobre onde cada corpo está. Com os números
 * aqui, mudar o raio de uma órbita não exige procurar o mesmo valor em três
 * arquivos.
 *
 * **O eixo é a distância.** A órbita 1 é a mais larga e a 5 a mais apertada,
 * porque é isso que a cena precisa dizer sem texto: longe é entrada de funil,
 * perto é relacionamento. Se alguém inverter esses números, inverte o
 * argumento da página.
 */

/** Raio de cada órbita, da mais distante para a mais próxima. */
export const RAIOS: Record<number, number> = {
  1: 14.4,
  2: 11.8,
  3: 9.2,
  4: 6.8,
  5: 4.55,
};

/** Achatamento da elipse na tela. 1 seria visto de cima; 0, de lado. */
export const ACHATAMENTO = 0.46;

/** O tamanho do corpo cresce para dentro: o destino é o maior. */
export const TAMANHOS: Record<number, number> = {
  1: 0.62,
  2: 0.62,
  3: 0.66,
  4: 0.7,
  /*
    A 5 é a órbita mais apertada e tem três corpos muito perto do destino:
    com o tamanho das outras, Astro e Gatilhos encobriam o planeta central.
  */
  5: 0.58,
};

/**
 * Velocidade angular de cada órbita, em radianos por segundo.
 *
 * Alternam de sinal porque órbitas girando todas para o mesmo lado viram um
 * disco só; com sentidos trocados, o olho separa um anel do outro. As de fora
 * são mais lentas, como em sistema real.
 */
export const VELOCIDADES: Record<number, number> = {
  1: 0.013,
  2: -0.018,
  3: 0.024,
  4: -0.032,
  5: 0.04,
};

/** A paleta de cada órbita, derivada da cor que já está no catálogo. */
export const PALETAS: Record<number, Paleta> = {
  1: { base: "#d9a24a", escuro: "#9c6a1c", claro: "#f7d79a" },
  2: { base: "#c05ec0", escuro: "#7e2f86", claro: "#f0a6e8" },
  3: { base: "#2c9f86", escuro: "#166654", claro: "#79e6c8" },
  4: { base: "#4f7fd4", escuro: "#28508f", claro: "#9fc6f5" },
  5: { base: "#2b74d8", escuro: "#1b4f9e", claro: "#5fa8f0" },
};

/**
 * O vão livre no topo de cada órbita, em radianos.
 *
 * Existe para o rótulo da órbita ("1. Atração") ter onde pousar sem cair em
 * cima de um planeta. Sem o vão, o nome da etapa — que é o que organiza a
 * leitura inteira — disputa espaço com o corpo mais próximo.
 */
export const VAO = 0.95;

/** O ângulo inicial de uma ferramenta dentro da sua órbita. */
export function anguloDaFerramenta(
  orbita: Orbita,
  indice: number,
  total: number,
): number {
  if (total <= 1) return Math.PI / 2;
  const arco = Math.PI * 2 - VAO * 2;
  return -Math.PI / 2 + VAO + (arco / total) * (indice + 0.5) + orbita.n * 0.14;
}

/** Posição no plano da órbita, para um ângulo. */
export function posicao(
  raio: number,
  angulo: number,
): [number, number, number] {
  return [Math.cos(angulo) * raio, 0, Math.sin(angulo) * raio];
}

export type CorpoDaJornada = {
  toolId: string;
  nome: string;
  tagline: string;
  href: string;
  orbita: Orbita;
  raio: number;
  anguloInicial: number;
  tamanho: number;
  velocidade: number;
  paleta: Paleta;
  /** Alguns ganham anel, para a órbita não virar uma fileira de bolas iguais. */
  anel: boolean;
};

/**
 * Monta os corpos da cena a partir do catálogo.
 *
 * Recebe o resolvedor em vez de importar o catálogo do site: assim este módulo
 * continua puro e pode ser testado sem arrastar o app inteiro junto.
 */
export function corposDaJornada(
  resolver: (
    id: string,
  ) => { name: string; tagline: string; href?: string } | null,
): CorpoDaJornada[] {
  const corpos: CorpoDaJornada[] = [];
  for (const orbita of ORBITAS) {
    orbita.tools.forEach((toolId, i) => {
      const tool = resolver(toolId);
      if (!tool) return;
      corpos.push({
        toolId,
        nome: tool.name,
        tagline: tool.tagline,
        href: tool.href ?? `/solucoes/${toolId}`,
        orbita,
        raio: RAIOS[orbita.n] ?? 6,
        anguloInicial: anguloDaFerramenta(orbita, i, orbita.tools.length),
        tamanho: TAMANHOS[orbita.n] ?? 0.46,
        velocidade: VELOCIDADES[orbita.n] ?? 0.02,
        paleta: PALETAS[orbita.n] ?? PALETAS[1],
        anel: i % 3 === 0,
      });
    });
  }
  return corpos;
}

/* ----------------------------------------------------- a câmera da jornada */

/**
 * A largura da fileira de cartões, que a órbita externa copia.
 *
 * As bordas da órbita mais larga caem na mesma linha das bordas dos seis
 * botões: é o que amarra a cena à navegação. Os dois números espelham o CSS —
 * `max-width` de `.jor__etapas` e o padding lateral de `.jor__topo`. Mudar um
 * lado sem o outro desalinha.
 */
export const LARGURA_CADEIA = 1180;
export const PADDING_LATERAL = 32;

/**
 * De onde a câmera olha — a direção, não a distância.
 *
 * A distância e a altura do alvo são calculadas em tempo de execução (ver
 * `Conducao`): a órbita externa precisa ter sempre a largura da cadeia e ficar
 * centrada no espaço livre abaixo dela, e isso depende do tamanho da janela.
 * O que este vetor decide é só a inclinação: perto de 17°, a elipse projetada
 * fica com altura de uns 30% da largura.
 *
 * É um enquadramento só para a jornada inteira. A câmera já aproximou a cada
 * etapa, e saiu: com o zoom, a órbita externa — que é a régua do desenho —
 * escapava da tela a partir do terceiro passo. Quem diferencia as etapas agora
 * é o realce: a órbita ativa acende e as outras apagam.
 */
export const DIRECAO_DA_CAMERA: [number, number, number] = [0, 9.6, 30.5];

/**
 * O raio do corpo central, em unidades da cena.
 *
 * Era o planeta da retenção e hoje é o disco do Astro: o tamanho não mudou na
 * troca, e é por isso que mora aqui e não em quem desenha.
 */
export const RAIO_DO_CENTRO = 2.3;
