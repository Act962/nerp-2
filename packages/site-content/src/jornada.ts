import { findCatalogTool, type Tool } from "./catalog";

/**
 * A jornada do ecossistema — a terceira leitura do catálogo.
 *
 * O menu lê `MENU_COLUMNS` (por momento do negócio). A cena da home lê
 * `ORBIT_TOOLS` (as 19 estações). Esta aqui lê por **momento da jornada do
 * cliente**: da entrada do funil até a fidelização.
 *
 * As três convivem porque respondem perguntas diferentes. "Onde encontro a
 * ferramenta X?" é menu. "O que a ÓRBITA faz?" é a órbita da home. "Quando,
 * na vida do meu cliente, esta ferramenta entra?" é esta.
 *
 * Nada aqui repete nome, resumo ou funcionalidade: a órbita guarda só ids, e
 * quem precisa do conteúdo resolve em `findCatalogTool`. Assim uma correção no
 * catálogo chega na cena sem ninguém lembrar de atualizar dois lugares.
 *
 * **A ordem importa e é física:** a órbita 1 é a mais distante do centro, a 5 é
 * a mais próxima. Quanto mais longe, mais perto da entrada do funil; quanto
 * mais perto, mais a solução trabalha para manter o cliente. O centro não é uma
 * ferramenta de captação — é o Star Friends, o destino.
 */

export type OrbitaId =
  | "atracao"
  | "atendimento"
  | "operacao"
  | "entrega"
  | "retencao";

export type Orbita = {
  id: OrbitaId;
  /** A posição na jornada, que também é a ordem de leitura da cena. */
  n: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  /** A frase que abre a etapa, na voz da ÓRBITA. */
  lead: string;
  /** O que acontece com quem não tem esta etapa resolvida. */
  pain: string;
  /** A cor da órbita na cena e na legenda. */
  color: string;
  /** Ids do catálogo. O conteúdo vem de `findCatalogTool`. */
  tools: string[];
};

export const ORBITAS: Orbita[] = [
  {
    id: "atracao",
    n: 1,
    title: "Atração",
    subtitle: "Entrada do funil",
    lead: "Toda jornada começa quando alguém levanta a mão. Cada canal de entrada termina no mesmo funil, com a origem registrada.",
    pain: "Sem isso, o lead entra por vários lugares e ninguém sabe de onde ele veio.",
    color: "#6ea8ff",
    tools: ["trafego", "pages", "linnker", "comments", "disparo", "forms"],
  },
  {
    id: "atendimento",
    n: 2,
    title: "Atendimento",
    subtitle: "Qualificação e relacionamento inicial",
    lead: "O lead chegou. Agora ele precisa de contexto: velocidade na resposta, histórico num lugar só e continuidade entre quem atende.",
    pain: "Mensagem sem resposta, agendamento no caderno e oportunidade esquecida no fim do plantão.",
    color: "#b06cf0",
    tools: ["chat", "agendas", "catalogo-promocional", "catalogo-online"],
  },
  {
    id: "operacao",
    n: 3,
    title: "Operação comercial",
    subtitle: "Gestão do processo",
    lead: "Uma operação saudável não mora na cabeça da equipe. Ela precisa de acompanhamento, visibilidade e passagem limpa entre setores.",
    pain: "O processo morre quando muda de setor — e você só descobre pela reclamação do cliente.",
    color: "#2fd4a7",
    tools: ["tracking", "nerp", "workspaces"],
  },
  {
    id: "entrega",
    n: 4,
    title: "Entrega",
    subtitle: "Execução, acompanhamento e inteligência",
    lead: "Depois do avanço comercial vem o que sustenta a confiança: executar, cobrar, medir e aprender com o que aconteceu.",
    pain: "Cobrança desconectada da venda, entrega sem padrão e operação que ninguém mede.",
    color: "#f5c451",
    tools: ["payment", "forge", "book", "insights", "route"],
  },
  {
    id: "retencao",
    n: 5,
    title: "Retenção",
    subtitle: "Relacionamento contínuo",
    lead: "O destino não é fechar a venda. É o cliente continuar em órbita com a sua empresa — e voltar por vontade própria. Aqui ficam as três coisas que seguram: o programa que recompensa, a automação que não esquece e a inteligência que acompanha.",
    pain: "Cliente que comprou uma vez, não teve motivo para voltar e ninguém percebeu.",
    color: "#4aa8f0",
    tools: ["star-friends", "gatilhos", "astro"],
  },
];

/**
 * As dores que atravessam a jornada.
 *
 * Cada frase aqui é uma reclamação real de operação. Elas já foram asteroides
 * na cena e saíram em 2026-10-06: com as órbitas acendendo uma por vez, as
 * rochas competiam com os planetas pelo olhar e não ajudavam a ler a etapa.
 *
 * A lista fica porque o conteúdo continua certo — é o melhor material que
 * existe no repositório para casar "o que o cliente reclama" com "que etapa
 * resolve". Serve a uma seção de texto, a uma página de segmento ou ao
 * consultor de IA; só não volta para a cena sem uma razão nova.
 */
export const ASTEROIDES: string[] = [
  "Lead esquecido",
  "Cliente sem histórico",
  "Processo que morre entre setores",
  "Retrabalho de digitação",
  "Verba sem comprovação",
  "Agenda sem confirmação",
  "Inadimplência",
  "Planilha paralela",
  "Ruptura de estoque",
  "Decisão no feeling",
];

/**
 * Os três papéis da cena.
 *
 * A frase que abre a página sai daqui, e ela precisa descrever o que o
 * visitante VÊ. O método conduz (a nave atravessa o campo), as soluções
 * executam (os planetas em órbita) e a retenção é o destino (o centro).
 *
 * O Astro saiu desta lista quando deixou de ser personagem flutuante e passou
 * a ser um dos corpos da órbita mais interna: anunciá-lo na abertura o poria
 * acima das outras trinta soluções, e na cena ele é uma delas.
 */
export const PAPEIS = {
  nave: {
    nome: "A Nave N.A.S.A",
    papel: "conduz",
    texto: "A metodologia que conduz sua operação ao próximo nível.",
  },
  solucoes: {
    nome: "As soluções",
    papel: "executam",
    texto: "Cada uma entra no momento em que a operação precisa dela.",
  },
  destino: {
    nome: "A retenção",
    papel: "é o destino",
    texto: "Fidelização e relacionamento de longo prazo.",
  },
} as const;

/** A órbita em que uma ferramenta entra, ou `null` se ela não está na jornada. */
export function orbitaDeFerramenta(toolId: string): Orbita | null {
  return ORBITAS.find((o) => o.tools.includes(toolId)) ?? null;
}

/** As ferramentas de uma órbita, já resolvidas no catálogo. */
export function ferramentasDaOrbita(orbita: Orbita): Tool[] {
  return orbita.tools
    .map((id) => findCatalogTool(id))
    .filter((tool): tool is Tool => Boolean(tool));
}

/**
 * As ferramentas do catálogo que a jornada NÃO conta.
 *
 * A narrativa comercial usa 19 das 31 soluções — as outras são da operação de
 * loja e de trade, que têm uma história própria e atrapalhariam o fio condutor
 * aqui. Elas não somem do site: continuam no menu, na grade de `/solucoes` e
 * com página própria. Esta função existe para o "mapa completo" do último passo
 * poder mostrá-las sem que ninguém precise manter uma segunda lista à mão.
 */
export function ferramentasForaDaJornada(todas: Tool[]): Tool[] {
  const naJornada = new Set(ORBITAS.flatMap((o) => o.tools));
  return todas.filter((tool) => !naJornada.has(tool.id));
}

/* ------------------------------------------------------- a jornada guiada */

/**
 * Os passos da experiência guiada.
 *
 * A página não abre com o mapa inteiro de propósito. Quem chega vê uma coisa
 * de cada vez — primeiro o método que conduz, depois a inteligência que guia,
 * depois cada órbita — e só no fim o ecossistema completo. É a diferença entre
 * um infográfico, que se olha, e uma apresentação, que se conduz.
 *
 * A sequência é dado, não componente: o passo de órbita referencia `ORBITAS`,
 * então acrescentar uma sexta órbita amanhã acrescenta um passo sozinho.
 */
export type PassoId =
  | "hero"
  | "nave"
  | "astro"
  | `orbita-${1 | 2 | 3 | 4 | 5}`
  | "mapa";

export const SEQUENCIA: PassoId[] = [
  "hero",
  "nave",
  "astro",
  ...ORBITAS.map((o) => `orbita-${o.n}` as PassoId),
  "mapa",
];

export type PassoFixo = {
  chapeu: string;
  titulo: string;
  subtitulo?: string;
  texto: string;
  /** Frase que fecha o passo. Fica em destaque, separada do corpo. */
  impacto?: string;
  /** Rótulo do botão que avança. */
  avancar: string;
};

export const PASSOS_FIXOS: Record<
  "hero" | "nave" | "astro" | "mapa",
  PassoFixo
> = {
  hero: {
    chapeu: "O ecossistema",
    titulo:
      "Sua operação não precisa de mais ferramentas. Precisa de uma jornada.",
    texto:
      "Conheça o ecossistema Órbita e veja como um lead entra no seu funil, atravessa a sua operação e chega até a fidelização.",
    // Alinhada com a abertura da página: o ASTRO saiu da frase quando deixou
    // de ser personagem em cena e virou um dos corpos da órbita de retenção.
    impacto:
      "A Nave N.A.S.A conduz. As soluções executam. E o cliente segue em órbita com a sua empresa.",
    avancar: "Começar missão",
  },
  nave: {
    chapeu: "Passo 1 · O método",
    titulo: "Esta é a nave N.A.S.A",
    subtitulo: "A metodologia que conduz a jornada.",
    texto:
      "Ela representa o método que conduz a jornada do lead dentro do ecossistema: entender a necessidade, analisar o que acontece, sistematizar a solução e agir medindo o resultado.",
    impacto: "A metodologia é o que impede a operação de se perder no caminho.",
    avancar: "Avançar para o ASTRO",
  },
  astro: {
    chapeu: "Passo 2 · A inteligência",
    titulo: "Este é o ASTRO",
    subtitulo: "A inteligência operacional que acompanha, orienta e age.",
    texto:
      "O ASTRO não é o destino da jornada: é o guia. Ele acompanha o lead, identifica onde o processo trava, orienta a equipe e aciona a solução quando uma etapa falha.",
    impacto: "O ASTRO não apenas responde. Ele acompanha e age.",
    avancar: "Iniciar trajetória",
  },
  mapa: {
    chapeu: "O ecossistema completo",
    titulo: "Agora você está vendo o ecossistema inteiro",
    subtitulo:
      "Da entrada do lead à fidelização, cada solução cumpre um papel.",
    texto:
      "O Órbita não é uma coleção de ferramentas. É um ecossistema guiado por método, inteligência e processo — onde cada etapa prepara a próxima, até transformar entrada de lead em relacionamento de longo prazo.",
    impacto:
      "O objetivo não é fazer o lead entrar. É fazer ele continuar em órbita com a sua empresa.",
    avancar: "Colocar minha empresa em órbita",
  },
};
