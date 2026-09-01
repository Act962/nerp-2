/**
 * O catálogo real da suíte ORBITA.
 *
 * Fonte: `specs/site-orbitatec/05-operacoes.md` (descrições de site já escritas
 * para cada ferramenta) e `specs/site-orbitatec/06-briefing-imagens.md` (a
 * trajetória de 4 etapas de cada uma). Nada aqui é inventado.
 *
 * As notas de veracidade do próprio spec foram respeitadas:
 * - Disparo vende "API oficial", nunca "campanha em massa" — o módulo não existe.
 * - TradeGram vive no NERP, e aparece aqui como ferramenta da suíte com link.
 * - Nenhuma integração não implementada é citada (sem Salesforce, HubSpot, Shopify).
 * - A palavra "offline" não aparece: não é promessa real da suíte.
 *
 * Cada ferramenta é uma esfera na órbita; cada funcionalidade é uma sub-esfera
 * da roleta que o scroll percorre depois do clique.
 */

export type Feature = {
  id: string;
  title: string;
  description: string;
};

export type Tool = {
  id: string;
  /** Nome curto usado no rótulo da órbita. */
  name: string;
  /** Nome completo, com o prefixo da marca. */
  fullName: string;
  category: CategoryId;
  /** Uma linha: o que a ferramenta é. */
  tagline: string;
  /** O parágrafo do spec, para a abertura do modo produto. */
  summary: string;
  features: Feature[];
  /** A ponte com o ERP tem tratamento próprio na cena. */
  bridge?: boolean;
  href?: string;
};

export type CategoryId = "comercial" | "gestao" | "marketing" | "plataforma";

export const CATEGORIES: Array<{
  id: CategoryId;
  title: string;
  lead: string;
}> = [
  {
    id: "comercial",
    title: "O cliente chega e avança",
    lead: "Da primeira conversa ao contrato assinado, sem trocar de sistema no meio do caminho.",
  },
  {
    id: "gestao",
    title: "A casa funciona por dentro",
    lead: "Trabalho, dinheiro e metas no mesmo lugar em que o negócio acontece.",
  },
  {
    id: "marketing",
    title: "A empresa aparece e capta",
    lead: "Cada canal de aquisição termina no mesmo funil — nenhum lead morre num print.",
  },
  {
    id: "plataforma",
    title: "O que só existe aqui",
    lead: "Inteligência, presença e execução em campo: a camada que separa a suíte de um CRM comum.",
  },
];

const RAW_TOOLS: Tool[] = [
  /* ---------------------------------------------------------------- comercial */
  {
    id: "tracking",
    name: "CRM Tracking",
    fullName: "ORBITA Tracking",
    category: "comercial",
    tagline: "CRM multi-funil em kanban",
    summary:
      "Arraste o card, o processo anda. Vários funis por empresa, cada um com as etapas do seu processo — e não do processo de outra pessoa.",
    features: [
      {
        id: "funis",
        title: "Vários funis",
        description:
          "Cada operação com o seu funil, sobre a mesma base de contatos.",
      },
      {
        id: "etapas",
        title: "Etapas personalizáveis",
        description: "O quadro se adapta ao seu processo, não o contrário.",
      },
      {
        id: "tags",
        title: "Tags e motivos",
        description:
          "Etiquetas em cada card e motivo registrado em toda vitória e perda.",
      },
      {
        id: "importacao",
        title: "Importação de leads",
        description: "A planilha vira base classificada dentro do funil.",
      },
      {
        id: "inatividade",
        title: "Automação de inatividade",
        description: "O card parado avisa sozinho, antes de esfriar.",
      },
    ],
  },
  {
    id: "chat",
    name: "Chat",
    fullName: "ORBITA Chat",
    category: "comercial",
    tagline: "Atendimento WhatsApp multi-instância",
    summary:
      "A conversa inteira dentro do CRM: texto, áudio, mídia, templates e etiquetas — com agenda, proposta e formulário abrindo dentro dela.",
    features: [
      {
        id: "instancias",
        title: "Multi-instância",
        description: "Várias linhas de WhatsApp atendidas no mesmo painel.",
      },
      {
        id: "oficial",
        title: "API oficial da Meta",
        description: "Templates aprovados e janela de 24h, dentro das regras.",
      },
      {
        id: "midia",
        title: "Texto, áudio e mídia",
        description: "Tudo o que o cliente manda, sem sair da conversa.",
      },
      {
        id: "paineis",
        title: "Painéis acoplados",
        description:
          "Agenda, proposta e formulário abrem ao lado da conversa, não em outra aba.",
      },
      {
        id: "inchat",
        title: "Modo In-Chat",
        description:
          "Se o WhatsApp cair ou for banido, o atendimento continua numa página própria, automaticamente.",
      },
    ],
  },
  {
    id: "forms",
    name: "Forms",
    fullName: "ORBITA Forms",
    category: "comercial",
    tagline: "Formulários que viram lead",
    summary:
      "Formulários sem código cujas respostas entram classificadas direto na etapa certa do funil.",
    features: [
      {
        id: "construtor",
        title: "Construtor visual",
        description: "Monta o formulário arrastando, sem escrever uma linha.",
      },
      {
        id: "publica",
        title: "Página pública",
        description: "Um link próprio, pronto para divulgar em qualquer canal.",
      },
      {
        id: "classificacao",
        title: "Resposta vira lead",
        description: "Cada envio nasce classificado na etapa certa do funil.",
      },
      {
        id: "whatsapp",
        title: "Validação de WhatsApp",
        description: "O número é conferido antes de virar contato.",
      },
      {
        id: "pdf",
        title: "Exportação em PDF",
        description: "A resposta completa vira documento com um clique.",
      },
    ],
  },
  {
    id: "agendas",
    name: "Agendas",
    fullName: "ORBITA Agendas",
    category: "comercial",
    tagline: "Agendamento com página pública",
    summary:
      "Múltiplas agendas com disponibilidade por responsável. Todo horário marcado vira contato no CRM.",
    features: [
      {
        id: "multiplas",
        title: "Múltiplas agendas",
        description: "Uma para cada serviço, equipe ou unidade.",
      },
      {
        id: "responsavel",
        title: "Disponibilidade por responsável",
        description: "Cada pessoa com os seus horários e os seus limites.",
      },
      {
        id: "publica",
        title: "Página de agendamento",
        description: "O cliente escolhe o horário sozinho, pelo link.",
      },
      {
        id: "chat",
        title: "Agendamento pelo chat",
        description: "Marcar sem tirar o cliente da conversa.",
      },
      {
        id: "crm",
        title: "Horário vira contato",
        description: "Todo agendamento entra no funil com histórico.",
      },
    ],
  },
  {
    id: "forge",
    name: "Forge",
    fullName: "ORBITA Forge",
    category: "comercial",
    tagline: "Propostas e contratos",
    summary:
      "Proposta assinada, atendimento avisado. O catálogo alimenta o documento e o aceite público fecha o ciclo.",
    features: [
      {
        id: "catalogo",
        title: "Catálogo de produtos",
        description: "Preço e escopo entram na proposta já conferidos.",
      },
      {
        id: "templates",
        title: "Templates",
        description: "O padrão da casa em todo documento que sai.",
      },
      {
        id: "assinatura",
        title: "Aceite com assinatura digital",
        description: "O cliente assina pelo link, sem imprimir nada.",
      },
      {
        id: "dashboard",
        title: "Dashboard de fechamento",
        description: "Quanto está na mesa e o que virou contrato.",
      },
      {
        id: "handoff",
        title: "Passagem automática",
        description:
          "Proposta assinada chega ao atendimento com todo o histórico junto.",
      },
    ],
  },

  /* ------------------------------------------------------------------ gestão */
  {
    id: "workspaces",
    name: "Workspaces",
    fullName: "ORBITA Workspaces",
    category: "gestao",
    tagline: "Gestão de trabalho por quadros",
    summary:
      "O setor inteiro num quadro — com o trabalho quebrado até o nível de quem executa.",
    features: [
      {
        id: "tarefas",
        title: "Tarefas e subtarefas",
        description: "O grande quebrado no que dá para fazer hoje.",
      },
      {
        id: "responsaveis",
        title: "Responsáveis e prazos",
        description: "Quem faz o quê, e até quando.",
      },
      {
        id: "chat",
        title: "Chat por tarefa",
        description: "A conversa fica onde o trabalho está.",
      },
      {
        id: "lembretes",
        title: "Lembretes e calendário",
        description: "Nada depende de alguém lembrar.",
      },
      {
        id: "automacoes",
        title: "Automações com gatilhos",
        description: "O quadro anda sozinho quando a condição acontece.",
      },
    ],
  },
  {
    id: "payment",
    name: "Payment",
    fullName: "ORBITA Payment",
    category: "gestao",
    tagline: "Financeiro e cobrança",
    summary:
      "Gera a cobrança e dá a baixa sozinho. O financeiro completo, ligado ao negócio que o originou.",
    features: [
      {
        id: "contas",
        title: "Contas a pagar e receber",
        description: "O caixa inteiro, com o contrato ao lado do lançamento.",
      },
      {
        id: "fluxo",
        title: "Fluxo de caixa e centros de custo",
        description: "Para onde o dinheiro vai, por área.",
      },
      {
        id: "aprovacoes",
        title: "Fluxo de aprovações",
        description: "Nada sai sem passar por quem decide.",
      },
      {
        id: "regua",
        title: "Régua de cobrança",
        description: "Lembra o cliente antes de você precisar lembrar.",
      },
      {
        id: "gateways",
        title: "Gateways integrados",
        description:
          "Asaas, Stripe e Mercado Pago geram e baixam automaticamente.",
      },
    ],
  },
  {
    id: "nbox",
    name: "N-box",
    fullName: "ORBITA N-box",
    category: "gestao",
    tagline: "Arquivos da organização",
    summary:
      "O contrato, a arte e a planilha no mesmo lugar do processo que eles servem.",
    features: [
      {
        id: "pastas",
        title: "Pastas e links",
        description: "O arquivo e o endereço convivendo na mesma estrutura.",
      },
      {
        id: "visibilidade",
        title: "Público ou privado",
        description: "Cada item com o alcance que ele deve ter.",
      },
      {
        id: "cota",
        title: "Cota por plano",
        description: "Espaço previsível, sem surpresa na fatura.",
      },
      {
        id: "contexto",
        title: "Junto do processo",
        description: "O documento fica ao lado do negócio que ele fecha.",
      },
    ],
  },
  {
    id: "ranking",
    name: "Ranking",
    fullName: "ORBITA Ranking de Vendas",
    category: "gestao",
    tagline: "Metas e pódio",
    summary: "Quem produz aparece — na tela do gestor e na parede da loja.",
    features: [
      {
        id: "metas",
        title: "Metas por equipe e vendedor",
        description:
          "Períodos do diário ao anual, com acompanhamento contínuo.",
      },
      {
        id: "podio",
        title: "Pódio",
        description: "O resultado exposto, no lugar da planilha escondida.",
      },
      {
        id: "telao",
        title: "Modo telão",
        description: "O ranking projetado para o time inteiro ver.",
      },
      {
        id: "importacao",
        title: "Importação de metas",
        description: "Via planilha, inclusive no formato do Winthor.",
      },
    ],
  },

  /* --------------------------------------------------------------- marketing */
  {
    id: "planner",
    name: "Planner",
    fullName: "ORBITA Planner",
    category: "marketing",
    tagline: "Planejamento de marketing com IA",
    summary:
      "Da identidade da marca à publicação: campanha pensada, produzida e no ar sem sair da plataforma.",
    features: [
      {
        id: "identidade",
        title: "Identidade de marca",
        description: "Tom, cores e referências num lugar só, para tudo herdar.",
      },
      {
        id: "briefing",
        title: "Briefing gerado por IA",
        description: "Da ideia ao roteiro, com o contexto da sua marca.",
      },
      {
        id: "mapas",
        title: "Mapas mentais",
        description: "A campanha pensada antes de virar arte.",
      },
      {
        id: "calendario",
        title: "Calendário editorial",
        description: "O mês inteiro planejado e visível.",
      },
      {
        id: "publicacao",
        title: "Editor e publicação",
        description: "Imagem, vídeo e postagem nas redes, no mesmo fluxo.",
      },
    ],
  },
  {
    id: "pages",
    name: "Pages",
    fullName: "ORBITA Pages",
    category: "marketing",
    tagline: "Construtor de landing pages",
    summary:
      "A página montada por encaixe, publicada em domínio próprio — que dá para comprar sem sair da plataforma.",
    features: [
      {
        id: "blocos",
        title: "26 blocos prontos",
        description: "A página inteira montada por encaixe.",
      },
      {
        id: "templates",
        title: "Templates",
        description: "Comece de um ponto que já funciona.",
      },
      {
        id: "versionamento",
        title: "Versionamento",
        description: "Publique sem medo: dá para voltar.",
      },
      {
        id: "analytics",
        title: "Analytics",
        description: "Quem chegou, por onde veio e o que fez.",
      },
      {
        id: "dominio",
        title: "Domínio próprio",
        description: "Registrado ali mesmo, sem passar por outro serviço.",
      },
    ],
  },
  {
    id: "linnker",
    name: "Linnker",
    fullName: "ORBITA Linnker",
    category: "marketing",
    tagline: "Página de links com QR",
    summary:
      "Seu link da bio virou canal de aquisição, com o lead entrando direto no funil.",
    features: [
      {
        id: "bio",
        title: "Página de links",
        description: "Todos os seus destinos num endereço só.",
      },
      {
        id: "qr",
        title: "QR Code próprio",
        description: "A ponte do impresso para o digital.",
      },
      {
        id: "lead",
        title: "Captura de lead",
        description: "O clique não vira só visita: vira contato no funil.",
      },
      {
        id: "stats",
        title: "Acessos e escaneios",
        description: "O que funciona, medido por canal.",
      },
    ],
  },
  {
    id: "comments",
    name: "Comments",
    fullName: "ORBITA Comments",
    category: "marketing",
    tagline: "Automação de comentários do Instagram",
    summary:
      "Comentar vira entrar no funil, na etapa que a palavra-chave definir.",
    features: [
      {
        id: "palavra",
        title: "Palavra-chave vira lead",
        description: "Quem comenta entra classificado, na hora.",
      },
      {
        id: "gatilhos",
        title: "Gatilhos",
        description: "Cada palavra leva a um caminho diferente.",
      },
      {
        id: "notificacoes",
        title: "Notificações",
        description: "O time sabe enquanto o interesse ainda está quente.",
      },
      {
        id: "sorteios",
        title: "Sorteios",
        description: "Engajamento que deixa base, não só curtida.",
      },
    ],
  },
  {
    id: "disparo",
    name: "Disparo",
    fullName: "ORBITA Disparo",
    category: "marketing",
    tagline: "API oficial do WhatsApp",
    summary:
      "Envio pela API oficial da Meta, com templates aprovados e o custo de cada conversa à vista.",
    features: [
      {
        id: "oficial",
        title: "API oficial da Meta",
        description: "Envio dentro das regras, sem risco de bloqueio.",
      },
      {
        id: "templates",
        title: "Templates aprovados",
        description: "Mensagem pronta e liberada antes do envio.",
      },
      {
        id: "janela",
        title: "Janela de 24h",
        description: "O que pode ser dito, e em que momento.",
      },
      {
        id: "custo",
        title: "Custo por conversa",
        description: "Quanto custou falar, medido por conversa.",
      },
    ],
  },

  /* -------------------------------------------------------------- plataforma */
  {
    id: "astro",
    name: "Astro",
    fullName: "ORBITA Astro",
    category: "plataforma",
    tagline: "A inteligência artificial da plataforma",
    summary:
      "Conhece o histórico de cada cliente, responde pelo time, prepara o atendimento e quebra objeções.",
    features: [
      {
        id: "historico",
        title: "Conhece o histórico",
        description:
          "Cada cliente com o contexto inteiro, não com o último print.",
      },
      {
        id: "atendimento",
        title: "Responde pelo time",
        description: "Prepara o atendimento e sustenta a objeção.",
      },
      {
        id: "rag",
        title: "Base de conhecimento própria",
        description: "Responde com o que é seu, não com o que inventou.",
      },
      {
        id: "voz",
        title: "Voz e bot de WhatsApp",
        description: "Atende no canal em que o cliente já está.",
      },
      {
        id: "modelos",
        title: "Claude, GPT e Gemini",
        description: "O modelo é escolha sua, não amarra da plataforma.",
      },
    ],
  },
  {
    id: "space-station",
    name: "Space Station",
    fullName: "ORBITA Space Station",
    category: "plataforma",
    tagline: "O escritório virtual da empresa",
    summary:
      "Sua operação deixou de estar escondida em sete abas: um mundo 2D navegável onde chegar perto é começar a conversa.",
    features: [
      {
        id: "mundo",
        title: "Mundo navegável",
        description: "A empresa inteira num mapa, com avatares.",
      },
      {
        id: "proximidade",
        title: "Áudio e vídeo por proximidade",
        description: "Aproximar-se de alguém abre a conversa.",
      },
      {
        id: "salas",
        title: "Salas de reunião",
        description: "Entrar na sala, em vez de marcar um link.",
      },
      {
        id: "auditorio",
        title: "Auditório e eventos",
        description: "Apresentações para dentro e para fora, com ingresso.",
      },
    ],
  },
  {
    id: "route",
    name: "Route",
    fullName: "ORBITA Route",
    category: "plataforma",
    tagline: "Cursos e área de membros",
    summary: "Monetize o que a sua empresa sabe, com checkout próprio.",
    features: [
      {
        id: "cursos",
        title: "Cursos e trilhas",
        description: "Vídeo, progresso e certificado no fim.",
      },
      {
        id: "conteudo",
        title: "eBooks e eventos",
        description: "Material e encontro no mesmo catálogo.",
      },
      {
        id: "assinaturas",
        title: "Mentorias e assinaturas",
        description: "Receita recorrente pelo seu conhecimento.",
      },
      {
        id: "checkout",
        title: "Checkout próprio",
        description: "A venda acontece na sua casa.",
      },
    ],
  },
  {
    id: "tradegram",
    name: "TradeGram",
    fullName: "ORBITA TradeGram",
    category: "plataforma",
    tagline: "Execução de trade marketing no PDV",
    summary:
      "O que foi combinado com a indústria, verificado na gôndola — com foto, rota e planograma.",
    features: [
      {
        id: "promotores",
        title: "Promotores e rotas",
        description: "Quem vai, aonde e quando — com registro de campo.",
      },
      {
        id: "fotos",
        title: "Fotos de PDV",
        description: "A gôndola como ela está, não como deveria estar.",
      },
      {
        id: "books",
        title: "Books",
        description: "Relatório fotográfico pronto para entregar à indústria.",
      },
      {
        id: "planograma",
        title: "Planograma",
        description: "O combinado comparado com o executado.",
      },
    ],
  },
  {
    id: "nerp",
    name: "NERP",
    fullName: "ORBITA NERP",
    category: "plataforma",
    tagline: "O ERP dentro da suíte",
    summary:
      "A suíte não substitui o seu ERP — ela conversa com ele. O NERP cuida da operação da loja e compartilha a mesma base com todas as ferramentas.",
    bridge: true,
    features: [
      {
        id: "operacao",
        title: "Produto, estoque e venda",
        description: "A operação da loja, do cadastro ao caixa.",
      },
      {
        id: "base",
        title: "Uma base, dois lados",
        description:
          "O produto do ERP aparece na proposta; a venda vira lançamento no financeiro.",
      },
      {
        id: "sync",
        title: "Sincronização assinada",
        description:
          "A troca entre a suíte e o ERP é contínua — nada depende de exportar planilha.",
      },
      {
        id: "connect",
        title: "Já tem ERP?",
        description:
          "O Orbita Connect integra com WinThor, TOTVS, Oracle, SAP e APIs abertas.",
      },
    ],
  },
];

/**
 * O destino de cada solução — o lugar para colar as URLs.
 *
 * O menu "Soluções" e o rodapé leem daqui. A regra é simples:
 *
 * - com URL → o item vira um link de verdade. Começou com `http`, abre em aba
 *   nova; começou com `/`, navega dentro do site.
 * - sem URL → o item leva o usuário até a estação daquela ferramenta na
 *   órbita e abre o modo produto, com as funcionalidades na roleta.
 *
 * Ou seja: as páginas internas podem ir nascendo uma a uma. Enquanto a de uma
 * ferramenta não existir, o menu continua levando a algum lugar que existe.
 *
 * Basta descomentar a linha e trocar pelo endereço real.
 */
export const TOOL_LINKS: Record<string, string | undefined> = {
  // comercial
  // tracking: "/solucoes/tracking",
  // chat: "/solucoes/chat",
  // forms: "/solucoes/forms",
  // agendas: "/solucoes/agendas",
  // forge: "/solucoes/forge",

  // gestão
  // workspaces: "/solucoes/workspaces",
  // payment: "/solucoes/payment",
  // nbox: "/solucoes/n-box",
  // ranking: "/solucoes/ranking",

  // marketing
  // planner: "/solucoes/planner",
  // pages: "/solucoes/pages",
  // linnker: "/solucoes/linnker",
  // comments: "/solucoes/comments",
  // disparo: "/solucoes/disparo",

  // plataforma
  // astro: "/solucoes/astro",
  // "space-station": "/solucoes/space-station",
  // route: "/solucoes/route",
  // tradegram: "/solucoes/tradegram",
  nerp: "/login",
};

/** O catálogo com o destino já resolvido. */
export const TOOLS: Tool[] = RAW_TOOLS.map((tool) => ({
  ...tool,
  href: TOOL_LINKS[tool.id] ?? tool.href,
}));

export const TOOLS_BY_CATEGORY = CATEGORIES.map((category) => ({
  ...category,
  tools: TOOLS.filter((tool) => tool.category === category.id),
}));

export function findTool(id: string | null) {
  return id ? (TOOLS.find((tool) => tool.id === id) ?? null) : null;
}
