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
  /**
   * Falso para as ferramentas que existem no menu mas NÃO viram esfera na
   * órbita. A cena tem 19 estações e a geometria sai dessa contagem; passar
   * para 28 apertaria os rótulos a ponto de nenhum ficar legível. Os módulos
   * do NERP são módulos — a estação deles é o próprio NERP.
   */
  orbitStation?: boolean;
};

export type CategoryId =
  | "comercial"
  | "gestao"
  | "marketing"
  | "plataforma"
  /** A operação da loja física — módulos do NERP, fora da órbita. */
  | "loja";

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

export const RAW_TOOLS: Tool[] = [
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
  /* -------------------------------------------------------- loja (NERP) */
  /*
    As nove abaixo são módulos do NERP. Elas aparecem no menu e têm página
    própria, mas não são estações da órbita: `orbitStation: false`. A descrição
    de cada uma saiu do código e de `specs/VISAO-PRODUTO.md` — nenhuma foi
    escrita de imaginação.
  */
  {
    id: "pdv",
    name: "PDV",
    fullName: "ORBITA PDV",
    category: "loja",
    orbitStation: false,
    tagline: "Frente de caixa, emissão fiscal e fechamento de turno",
    summary:
      "O caixa da loja: venda, emissão fiscal, autorização de cancelamento e fechamento por operador, na mesma base do estoque e do financeiro.",
    features: [
      {
        id: "venda",
        title: "Venda no balcão",
        description: "Item, desconto e pagamento sem sair da tela.",
      },
      {
        id: "fiscal",
        title: "Emissão fiscal",
        description: "NFC-e emitida na venda, com cancelamento registrado.",
      },
      {
        id: "autorizacao",
        title: "Cancelamento autorizado",
        description:
          "Cancelar passa pela autorização do supervisor, e fica no histórico.",
      },
      {
        id: "turno",
        title: "Abertura e fechamento",
        description:
          "O caixa abre e fecha por operador, com o movimento do turno.",
      },
    ],
  },
  {
    id: "estoque",
    name: "Gestão de Estoque",
    fullName: "ORBITA Estoque",
    category: "loja",
    orbitStation: false,
    tagline: "Entrada, saída e saldo por loja",
    summary:
      "O saldo de cada produto em cada loja, movido pelo que entra e pelo que o caixa vende — sem planilha paralela.",
    features: [
      {
        id: "saldo",
        title: "Saldo por loja",
        description:
          "Cada unidade com o seu estoque, no mesmo cadastro de produto.",
      },
      {
        id: "movimento",
        title: "Entrada e saída",
        description: "A compra entra, a venda sai, e o histórico fica.",
      },
      {
        id: "preco",
        title: "Custo e preço",
        description: "O preço de venda nasce do custo que entrou.",
      },
    ],
  },
  {
    id: "inventario",
    name: "Inventário com coletor",
    fullName: "ORBITA Inventário",
    category: "loja",
    orbitStation: false,
    tagline: "Contagem pelo celular, que vira coletor",
    summary:
      "A contagem do inventário feita com o celular como coletor: lê o código, conta, e confronta com o saldo do sistema.",
    features: [
      {
        id: "coletor",
        title: "O celular vira coletor",
        description:
          "Um QR no PDV liga o telefone como leitor, sem instalar nada.",
      },
      {
        id: "contagem",
        title: "Contagem organizada",
        description:
          "A contagem acontece por lista, com o que já foi e o que falta.",
      },
      {
        id: "divergencia",
        title: "Divergência à vista",
        description:
          "O contado bate com o saldo, e a diferença aparece item a item.",
      },
    ],
  },
  {
    id: "catalogo-promocional",
    name: "Catálogo Promocional",
    fullName: "ORBITA Catálogo Promocional",
    category: "loja",
    orbitStation: false,
    tagline: "O encarte da semana, com preço por loja",
    summary:
      "O encarte deixa de ser uma imagem: vira uma lista de produtos com preço por loja, publicável em link próprio.",
    features: [
      {
        id: "lista",
        title: "Lista de produtos",
        description: "Os itens da promoção saem do próprio cadastro.",
      },
      {
        id: "preco-loja",
        title: "Preço por loja",
        description: "A mesma campanha, com o preço que vale em cada unidade.",
      },
      {
        id: "publico",
        title: "Link público",
        description: "O catálogo tem endereço próprio para compartilhar.",
      },
    ],
  },
  {
    id: "qr-preco",
    name: "QR Preço",
    fullName: "ORBITA QR Preço",
    category: "loja",
    orbitStation: false,
    tagline: "O cliente escaneia e vê o preço; a loja vê o interesse",
    summary:
      "O consumidor escaneia o produto e vê preço e informação. Cada consulta vira dado de loja, horário e categoria — sem rastrear a pessoa.",
    features: [
      {
        id: "preco",
        title: "Preço na hora",
        description: "O cliente aponta a câmera e vê o preço daquele item.",
      },
      {
        id: "jornada",
        title: "Jornada de interesse",
        description:
          "A sequência de consultas mostra o caminho do interesse dentro da loja.",
      },
      {
        id: "privacidade",
        title: "Sem rastrear pessoa",
        description:
          "O que se reconstrói é a jornada, não o indivíduo. Nenhuma consulta é ligada a um nome.",
      },
    ],
  },
  {
    id: "catalogo-online",
    name: "Catálogo Online",
    fullName: "ORBITA Catálogo Online",
    category: "loja",
    orbitStation: false,
    tagline: "A vitrine da loja na internet, ligada ao PDV e ao CRM",
    summary:
      "A loja com endereço próprio na internet: o produto do cadastro vira vitrine, e quem compra entra na mesma base do balcão.",
    features: [
      {
        id: "vitrine",
        title: "Vitrine por endereço próprio",
        description: "Cada loja com o seu catálogo público.",
      },
      {
        id: "pedido",
        title: "Do carrinho ao pedido",
        description: "O pedido nasce online e chega na operação.",
      },
      {
        id: "base",
        title: "Mesmo produto, mesmo cliente",
        description:
          "O item é o do estoque e o comprador é o do CRM — não há segunda base.",
      },
    ],
  },
  {
    id: "planograma",
    name: "Planograma",
    fullName: "ORBITA Shelf",
    category: "loja",
    orbitStation: false,
    tagline: "A gôndola planejada, comparada com a foto",
    summary:
      "O planograma da gôndola, e a comparação entre o que foi planejado e a foto do que está na loja.",
    features: [
      {
        id: "desenho",
        title: "A gôndola desenhada",
        description: "Prateleira, posição e ocupação de cada produto.",
      },
      {
        id: "execucao",
        title: "Planejado x executado",
        description: "A foto do PDV encosta no plano e a diferença aparece.",
      },
      {
        id: "share",
        title: "Share de espaço",
        description: "Quanto da gôndola é de cada marca, em número.",
      },
      {
        id: "revisao",
        title: "Revisões",
        description: "Cada versão do planograma fica registrada.",
      },
    ],
  },
  {
    id: "book",
    name: "Book de Execução",
    fullName: "ORBITA Book",
    category: "loja",
    orbitStation: false,
    tagline: "As fotos da execução viram um book para a indústria",
    summary:
      "As fotos tiradas no ponto de venda viram um relatório fotográfico montado, pronto para entregar à indústria.",
    features: [
      {
        id: "fotos",
        title: "A foto do campo",
        description: "O que o promotor registrou na loja entra no book.",
      },
      {
        id: "paginas",
        title: "Páginas montadas",
        description:
          "As páginas se organizam sozinhas conforme as fotos entram.",
      },
      {
        id: "entrega",
        title: "Pronto para entregar",
        description: "O book sai em PDF, com a identidade de quem apresenta.",
      },
    ],
  },
  {
    id: "trafego",
    name: "TrafeGO",
    fullName: "TrafeGO",
    category: "marketing",
    orbitStation: false,
    tagline: "Gestão inteligente de tráfego pago",
    summary: "Gestão inteligente de tráfego pago.",
    /*
      Sem funcionalidades listadas de propósito: o TrafeGO é o único item deste
      catálogo que não encontrei no código nem em spec. A única frase aqui é a
      que o cliente escreveu. Preencher isto é com quem conhece o produto.
    */
    features: [],
  },
];

/** Busca no catálogo cru, sem os destinos resolvidos pelo site. */
export function findCatalogTool(id: string | null) {
  return id ? (RAW_TOOLS.find((tool) => tool.id === id) ?? null) : null;
}

/**
 * As ferramentas que são estação na órbita.
 *
 * A cena 3D deriva a geometria da CONTAGEM: 19 esferas, os ângulos repartidos
 * entre elas, e o texto de cada categoria posicionado pelo ângulo da primeira e
 * da última. Passar para 28 apertaria tudo — os rótulos se empilhariam e
 * nenhum ficaria legível.
 *
 * Por isso a cena lê daqui, e o menu lê de `MENU_COLUMNS`. São duas leituras
 * do mesmo catálogo, e é essa separação que permite o menu crescer sem a
 * animação mudar.
 */
export const ORBIT_TOOLS: Tool[] = RAW_TOOLS.filter(
  (tool) => tool.orbitStation !== false,
);

export const ORBIT_BY_CATEGORY = CATEGORIES.map((category) => ({
  ...category,
  tools: ORBIT_TOOLS.filter((tool) => tool.category === category.id),
}));

/**
 * As colunas do painel "Soluções".
 *
 * Não são as categorias da órbita: são momentos do negócio, e a ordem conta
 * uma história — o cliente chega, a loja vende, o que aconteceu na loja vira
 * dado, a casa se organiza, a empresa capta, e o que só existe aqui.
 *
 * A lista é explícita, e não derivada de `category`, porque a ordem dentro de
 * cada coluna é editorial: PDV antes de estoque porque é por onde se começa a
 * entender a loja, não porque venha antes no alfabeto.
 */
export const MENU_COLUMNS: Array<{ title: string; tools: string[] }> = [
  {
    title: "O cliente chega e avança",
    tools: ["tracking", "chat", "forms", "agendas", "forge"],
  },
  {
    title: "A loja abre e vende",
    tools: [
      "pdv",
      "estoque",
      "inventario",
      "catalogo-promocional",
      "qr-preco",
      "catalogo-online",
    ],
  },
  {
    title: "O PDV vira inteligência",
    tools: ["tradegram", "planograma", "book", "nerp"],
  },
  {
    title: "A casa funciona por dentro",
    tools: ["workspaces", "payment", "nbox", "ranking"],
  },
  {
    title: "A empresa aparece e capta",
    tools: ["planner", "pages", "linnker", "comments", "disparo", "trafego"],
  },
  {
    title: "O que só existe aqui",
    tools: ["astro", "space-station", "route"],
  },
];
