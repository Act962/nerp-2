import { type AstroPagina, astroPaginaSchema } from "./astro-pagina";

/**
 * O que o Astro fala e sabe em cada página do site, pronto para semear.
 *
 * Os balões são escritos por gente, não gerados: aparecem em TODA visita, e
 * pagar um modelo para inventar "essa é top hein" a cada carregamento seria
 * caro e pior. O resumo e as palavras-chave vão para o prompt quando a conversa
 * começa ali — é o que faz o Astro puxar o assunto certo em vez de perguntar do
 * zero a quem já está lendo sobre aquilo.
 *
 * A voz segue a das páginas que já estavam preenchidas: dois balões curtos, o
 * primeiro reconhecendo onde a pessoa está e o segundo oferecendo o próximo
 * passo; resumo em uma ou duas frases concretas; palavras-chave em minúsculas e
 * sem acento, porque é assim que elas casam com o que o visitante digita.
 *
 * **Este catálogo é ponto de partida, não verdade.** Quem manda é o que está
 * gravado no admin: o seed só preenche página que ainda está vazia.
 */

/** Pares slug → configuração. O slug é único no site inteiro. */
const CRU: Record<string, Omit<AstroPagina, "ativo">> = {
  "sobre-o-orbita-hub": {
    baloes: [
      "Veio saber quem está por trás da suíte?",
      "Posso resumir em duas linhas o que a gente faz",
    ],
    resumo:
      "A ÓRBITA é uma suíte só, não um pacote de sistemas com a mesma cor: indústria, distribuidor, varejo e consumidor na mesma base de dados. Quem chega aqui costuma querer entender o tamanho da casa antes de falar de ferramenta.",
    palavrasChave: [
      "sobre",
      "orbita",
      "hub",
      "empresa",
      "quem",
      "somos",
      "suite",
      "historia",
      "time",
      "proposito",
    ],
  },

  "trabalhe-conosco": {
    baloes: [
      "Procurando vaga por aqui?",
      "Te conto como o time trabalha por dentro",
    ],
    resumo:
      "As vagas abertas e como é o time por dentro. Quem chega nesta página quer saber o que a gente procura e como é o dia a dia — não o que a suíte faz.",
    palavrasChave: [
      "trabalhe",
      "conosco",
      "vaga",
      "vagas",
      "carreira",
      "emprego",
      "time",
      "contratacao",
      "curriculo",
      "cultura",
    ],
  },

  "cases-de-sucesso": {
    baloes: [
      "Quer ver o que mudou na operação de quem já usa?",
      "Posso achar um caso parecido com o seu",
    ],
    resumo:
      "O que mudou na operação de quem usa a suíte, com número e contexto. É a página de quem já entendeu a ferramenta e agora quer prova antes de decidir.",
    palavrasChave: [
      "cases",
      "sucesso",
      "resultado",
      "cliente",
      "prova",
      "antes",
      "depois",
      "operacao",
      "numero",
      "exemplo",
    ],
  },

  "parceiros-e-integracoes": {
    baloes: [
      "Quer integrar alguma coisa com a suíte?",
      "Ou está pensando em revender? Também te ajudo",
    ],
    resumo:
      "Quem revende, quem implanta e com o que a suíte conversa. Duas perguntas diferentes chegam aqui: integrar um sistema que a empresa já tem, ou virar parceiro — vale descobrir qual das duas antes de responder.",
    palavrasChave: [
      "parceiros",
      "integracoes",
      "integracao",
      "revenda",
      "revender",
      "implantacao",
      "api",
      "erp",
      "conectar",
      "parceria",
    ],
  },

  treinamentos: {
    baloes: [
      "Veio treinar o time na suíte?",
      "Te mostro por onde costuma começar",
    ],
    resumo:
      "Trilhas para o time aprender a operar a suíte, do primeiro acesso ao uso avançado. Rodam no Route, dentro da própria suíte — não é curso à parte.",
    palavrasChave: [
      "treinamentos",
      "treinamento",
      "trilha",
      "curso",
      "aprender",
      "capacitacao",
      "onboarding",
      "time",
      "route",
      "certificado",
    ],
  },
};

/** O catálogo já validado pelo schema — limites de tamanho inclusos. */
export const ASTRO_DAS_PAGINAS: Record<string, AstroPagina> =
  Object.fromEntries(
    Object.entries(CRU).map(([slug, config]) => [
      slug,
      astroPaginaSchema.parse({ ...config, ativo: true }),
    ]),
  );

/** A sugestão para um slug, ou `null` quando não há uma escrita. */
export function astroSugeridoPara(slug: string): AstroPagina | null {
  return ASTRO_DAS_PAGINAS[slug] ?? null;
}
