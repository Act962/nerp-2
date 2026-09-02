import type { SiteBlock } from "./blocks";
import type { SitePageSeed } from "./pages";

/**
 * O Método N.A.S.A.
 *
 * Metodologia de gestão, marketing e tomada de decisão desenvolvida por
 * Weydson Lima. O texto abaixo é integralmente dele — nenhuma frase foi
 * escrita por fora. O que o código faz é dar forma: o ciclo vira desenho, as
 * perguntas centrais viram destaque e o princípio vira a frase do meio.
 *
 * Ele não é uma ferramenta da suíte: é o que orquestra as outras. Por isso
 * fecha o painel "Soluções" em vez de virar mais um card na grade.
 */

export const METODO_SLUG = "metodo-nasa";

export function buildMetodoPage(options: {
  whatsappHref: string;
}): SitePageSeed {
  const blocks: SiteBlock[] = [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      eyebrow: "Método",
      title: "N.A.S.A.",
      text: "Uma metodologia de gestão, marketing e tomada de decisão em quatro etapas sequenciais — Necessidade, Análise, Sistematização e Ação. Ela transforma problemas, necessidades e oportunidades em decisões estratégicas e ações práticas, evitando decisão por opinião, improviso ou achismo. Desenvolvida por Weydson Lima.",
      primary: { label: "Ver as quatro etapas", href: "#etapas" },
      secondary: {
        label: "Falar com um especialista",
        href: options.whatsappHref,
      },
      image: { key: "", alt: "" },
    },
    {
      id: "etapas",
      type: "steps",
      enabled: true,
      title: "As quatro etapas",
      cycle: true,
      text: "Na ordem, sempre. Cada uma só começa quando a anterior entregou o que tinha de entregar.",
      items: [
        {
          mark: "N",
          title: "Necessidade",
          question: "O que precisa ser resolvido ou alcançado?",
          text: "Identificar claramente qual é o problema, a necessidade, o objetivo ou a oportunidade que precisa ser trabalhado. A necessidade deve ser definida de forma objetiva, estabelecendo o ponto de partida e o resultado desejado.",
          bullets: [],
        },
        {
          mark: "A",
          title: "Análise",
          question: "O que está acontecendo, e por quê?",
          text: "Coletar, organizar e interpretar dados, informações e contexto relacionados à necessidade identificada. A análise transforma informações dispersas em inteligência para tomada de decisão.",
          bullets: [
            "O que está acontecendo?",
            "Por que está acontecendo?",
            "Quais dados comprovam isso?",
            "Quais são as causas, oportunidades e limitações?",
            "Quem está envolvido?",
          ],
        },
        {
          mark: "S",
          title: "Sistematização",
          question: "Como vamos estruturar a solução?",
          text: "Transformar a análise em um plano estruturado, organizando estratégias, prioridades, processos, recursos, responsáveis, indicadores e etapas. Nesta etapa, a estratégia deixa de ser uma ideia e passa a ser um sistema organizado e executável.",
          bullets: [],
        },
        {
          mark: "A",
          title: "Ação",
          question: "O que será feito, por quem, quando e como será medido?",
          text: "Executar o que foi planejado, acompanhar os resultados e utilizar os aprendizados para realizar ajustes. A ação fecha o ciclo e gera novos dados, que podem alimentar novamente a etapa de Análise.",
          bullets: [
            "O que será feito?",
            "Quem fará?",
            "Quando?",
            "Como será medido?",
            "O resultado esperado foi alcançado?",
          ],
        },
      ],
    },
    {
      id: "principio",
      type: "statement",
      enabled: true,
      title:
        "“Não agir antes de entender a necessidade; não decidir antes de analisar; não executar sem sistematizar; e não encerrar a ação sem medir os resultados.”",
      text: "O princípio fundamental do método.",
      cta: { label: "", href: "" },
    },
    {
      id: "aplicacoes",
      type: "features",
      enabled: true,
      title: "Onde se aplica",
      items: [
        {
          title: "Gestão e processos",
          text: "Gestão empresarial, processos e planejamento estratégico.",
        },
        {
          title: "Marketing e vendas",
          text: "Marketing, vendas e análise de mercado.",
        },
        {
          title: "Projetos e decisões",
          text: "Projetos e tomada de decisão, em qualquer área.",
        },
      ],
    },
    {
      id: "contact",
      type: "contact",
      enabled: true,
      title: "Quer aplicar o método na sua operação?",
      options: [
        {
          kind: "whatsapp",
          label: "Converse por WhatsApp",
          href: options.whatsappHref,
        },
      ],
    },
  ];

  return {
    section: "solucoes",
    slug: METODO_SLUG,
    title: "Método N.A.S.A.",
    seoTitle: "Método N.A.S.A. — ÓRBITA HUB",
    seoDescription:
      "Necessidade, Análise, Sistematização e Ação: a metodologia de gestão e tomada de decisão desenvolvida por Weydson Lima.",
    blocks,
  };
}
