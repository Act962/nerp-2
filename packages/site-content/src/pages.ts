import type { SiteBlock } from "./blocks";
import { CATEGORIES, findCatalogTool, RAW_TOOLS, type Tool } from "./catalog";

/**
 * A página interna de uma solução, montada a partir do catálogo.
 *
 * Existe para as 19 soluções nascerem com a mesma estrutura sem ninguém
 * escrever 19 páginas à mão — e para os dois apps concordarem sobre o que é
 * essa estrutura: o `apps/site` usa como conteúdo de reserva e o `apps/web`
 * usa para semear o banco, de onde o admin passa a editar.
 *
 * **A regra que decide o que entra ligado.** Bloco que se sustenta em fato
 * nasce LIGADO; bloco que só existiria com invenção nasce DESLIGADO, com os
 * campos prontos e vazios no admin.
 *
 * Em 2026-09-02 as 28 páginas foram preenchidas para ir ao ar, e o critério
 * de "fato" precisa ficar explícito, porque é ele que separa este texto de
 * texto de venda:
 *
 * - cada linha de **MAIS** é uma funcionalidade que existe no catálogo;
 * - cada linha de **MENOS** é a ausência LITERAL dessa mesma funcionalidade —
 *   o que se faz hoje quando ela não existe. Não é promessa de resultado
 *   ("vende mais", "economiza X"), é a descrição do trabalho manual que a
 *   funcionalidade substitui;
 * - o **split** resume, em uma frase, as funcionalidades já listadas.
 *
 * Continuam desligados `video` e `clients`: os dois dependem de material que
 * ainda não existe — vídeo gravado e logotipo autorizado —, e ligados vazios
 * apareceriam como buraco na página.
 *
 * As imagens de `hero` e `split` entram vazias de propósito: o renderizador
 * desenha uma moldura no lugar (`sp-media--empty`), e o cliente sobe cada uma
 * pelo admin sem tocar em código.
 */

/** O trecho do site em que a página vive — o primeiro pedaço da URL. */
export type SiteSection = "solucoes" | "segmentos" | "sobre";

export type SitePageSeed = {
  section: SiteSection;
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  blocks: SiteBlock[];
  /** Só nas páginas de solução: liga a página à ferramenta do catálogo. */
  toolId?: string;
};

/** Mantido para quem já importava o nome antigo. */
export type SolutionPage = SitePageSeed;

/** Texto aprovado, por ferramenta. O que não estiver aqui fica desligado. */
type PageCopy = {
  /** Endereço da página. Sem isto, o slug sai do id da ferramenta. */
  slug?: string;
  heroTitle?: string;
  statementTitle?: string;
  statementText?: string;
  compare?: { more: string[]; less: string[] };
  split?: { title: string; paragraphs: string[] };
};

const PAGE_COPY: Record<string, PageCopy> = {
  tracking: {
    slug: "crm-tracking",
    heroTitle: "CRM Tracking: o funil que anda quando o card anda",
    statementTitle:
      "Um CRM que se adapta ao processo que a sua empresa já tem.",
    statementText:
      "Vários funis sobre a mesma base de contatos, com as etapas que o seu time usa todo dia.",
    compare: {
      more: [
        "Todo o histórico do contato num lugar só",
        "Previsibilidade do que vai fechar",
        "Motivo registrado em cada perda",
        "O time inteiro olhando o mesmo funil",
      ],
      less: [
        "Lead esquecido na caixa de entrada",
        "Planilha paralela que só uma pessoa entende",
        "Reunião para descobrir em que pé está cada negócio",
        "Card parado sem ninguém perceber",
      ],
    },
    split: {
      title: "O funil no bolso de quem está na rua",
      paragraphs: [
        "O vendedor move o card, registra o motivo e vê o histórico do contato sem voltar para o computador.",
      ],
    },
  },
  chat: {
    compare: {
      more: [
        "A conversa inteira dentro do CRM",
        "Vários números na mesma caixa",
        "Agenda e proposta sem sair do chat",
        "O histórico do contato junto da conversa",
      ],
      less: [
        "Número no celular de um vendedor só",
        "Conversa que sai da empresa quando a pessoa sai",
        "Copiar e colar dado para outro sistema",
        "Cliente repetindo o que já contou",
      ],
    },
    split: {
      title: "A conversa no mesmo lugar do processo",
      paragraphs: [
        "Texto, áudio e mídia pela API oficial da Meta, com várias instâncias na mesma caixa — e cada mensagem já ligada ao contato que ela pertence.",
      ],
    },
  },
  forms: {
    compare: {
      more: [
        "Formulário no ar sem depender de desenvolvedor",
        "Resposta entrando direto no funil",
        "WhatsApp conferido no momento do envio",
        "Resposta arquivada em PDF",
      ],
      less: [
        "Formulário que só devolve um e-mail",
        "Digitar resposta no CRM à mão",
        "Número errado descoberto na hora de ligar",
        "Anexo perdido na caixa de entrada",
      ],
    },
    split: {
      title: "Da resposta ao funil, sem passar pela mão de ninguém",
      paragraphs: [
        "O construtor é visual e a página é pública: quem responde vira lead classificado no funil, com o WhatsApp já validado.",
      ],
    },
  },
  agendas: {
    compare: {
      more: [
        "Página pública para o cliente escolher o horário",
        "Uma agenda por responsável",
        "Marcação feita dentro da conversa",
        "Horário marcado virando contato",
      ],
      less: [
        "Vai-e-volta de mensagem para achar horário",
        "Duas pessoas marcadas no mesmo intervalo",
        "Agenda numa ferramenta e cliente em outra",
        "Quem agendou sem cadastro nenhum",
      ],
    },
    split: {
      title: "O horário marcado já nasce como contato",
      paragraphs: [
        "Cada responsável com a própria disponibilidade, uma página pública para marcar e o agendamento também pelo chat — e o horário fechado entra no CRM.",
      ],
    },
  },
  forge: {
    compare: {
      more: [
        "Proposta montada a partir do catálogo",
        "Aceite com assinatura digital",
        "Visão do que está em aprovação",
        "Proposta aceita seguindo sozinha de etapa",
      ],
      less: [
        "Proposta refeita do zero a cada pedido",
        "Contrato impresso para assinar",
        "Perguntar por e-mail se já foi aprovado",
        "Digitar de novo o que já foi fechado",
      ],
    },
    split: {
      title: "Do catálogo ao aceite, no mesmo caminho",
      paragraphs: [
        "Templates sobre um catálogo de produtos, assinatura digital no aceite e passagem automática de etapa — o dashboard mostra o que está parado em qual porta.",
      ],
    },
  },
  workspaces: {
    compare: {
      more: [
        "O trabalho em quadros, com responsável e prazo",
        "A conversa dentro da própria tarefa",
        "Lembrete antes do prazo",
        "Passo que dispara sozinho",
      ],
      less: [
        "Tarefa combinada no corredor",
        "Prazo que só existe na cabeça de alguém",
        "Discussão espalhada em três aplicativos",
        "Cobrança manual do que era óbvio",
      ],
    },
    split: {
      title: "O combinado com dono, prazo e histórico",
      paragraphs: [
        "Tarefas e subtarefas em quadros, chat por tarefa, lembretes no calendário e automações com gatilho — o que foi combinado fica escrito onde o trabalho acontece.",
      ],
    },
  },
  payment: {
    compare: {
      more: [
        "Contas a pagar e a receber no mesmo lugar",
        "Fluxo de caixa por centro de custo",
        "Aprovação registrada antes do pagamento",
        "Cobrança que segue sozinha",
      ],
      less: [
        "Planilha de contas que só uma pessoa mantém",
        "Descobrir o saldo no fim do mês",
        "Pagamento aprovado por mensagem",
        "Boleto vencido sem ninguém avisar",
      ],
    },
    split: {
      title: "O dinheiro no mesmo sistema da venda",
      paragraphs: [
        "Contas, fluxo de caixa, centros de custo, fluxo de aprovações e régua de cobrança, com gateways integrados — o que foi vendido e o que foi recebido conversam.",
      ],
    },
  },
  nbox: {
    compare: {
      more: [
        "Arquivo guardado junto do processo",
        "Link para quem está de fora",
        "Controle do que é público e do que não é",
        "Espaço definido por plano",
      ],
      less: [
        "Contrato no computador de uma pessoa",
        "Anexo caçado no e-mail",
        "Arquivo de cliente misturado com o resto",
        "Versão antiga circulando por aí",
      ],
    },
    split: {
      title: "O arquivo onde o assunto dele está",
      paragraphs: [
        "Pastas e links, público ou privado, com cota por plano — e cada arquivo ao lado do contato, da proposta ou da tarefa a que pertence.",
      ],
    },
  },
  ranking: {
    compare: {
      more: [
        "Meta por equipe e por vendedor",
        "Pódio que se atualiza sozinho",
        "Telão para o time acompanhar",
        "Metas importadas de uma vez",
      ],
      less: [
        "Quadro de metas atualizado à mão",
        "Descobrir a posição só no fim do mês",
        "Uma planilha de meta em cada gestor",
        "Ranking que ninguém confere",
      ],
    },
    split: {
      title: "A meta visível enquanto ainda dá para reagir",
      paragraphs: [
        "Metas por equipe e por vendedor, pódio e modo telão — o número sai do próprio funil, então ninguém precisa alimentar o painel.",
      ],
    },
  },
  planner: {
    compare: {
      more: [
        "A identidade da marca guardada num lugar",
        "Briefing pronto para o time",
        "Calendário editorial à vista",
        "Peça editada e publicada no mesmo lugar",
      ],
      less: [
        "Post decidido na véspera",
        "Briefing passado por áudio",
        "Calendário em planilha",
        "Arquivo final no WhatsApp de alguém",
      ],
    },
    split: {
      title: "Do briefing à publicação, sem trocar de ferramenta",
      paragraphs: [
        "Identidade de marca, briefing gerado por IA, mapas mentais, calendário editorial e editor com publicação — o plano e a peça no mesmo lugar.",
      ],
    },
  },
  pages: {
    compare: {
      more: [
        "Landing page montada por blocos",
        "Versão anterior guardada",
        "Número de acesso na mesma tela",
        "Domínio próprio",
      ],
      less: [
        "Esperar a agenda do desenvolvedor",
        "Página sem histórico de mudança",
        "Analytics em outro painel",
        "Endereço genérico de plataforma",
      ],
    },
    split: {
      title: "A página no ar hoje, e revisível amanhã",
      paragraphs: [
        "Vinte e seis blocos prontos, templates, versionamento, analytics e domínio próprio — a página é montada, medida e corrigida pelo mesmo time.",
      ],
    },
  },
  linnker: {
    compare: {
      more: [
        "Uma página com todos os links",
        "QR próprio para material impresso",
        "Lead capturado na própria página",
        "Contagem de acessos e escaneios",
      ],
      less: [
        "Um link diferente em cada canal",
        "QR de serviço de terceiro",
        "Visita que não vira contato",
        "Palpite sobre o que funcionou",
      ],
    },
    split: {
      title: "O link da bio que devolve contato",
      paragraphs: [
        "Página de links com QR Code próprio, captura de lead e contagem de acessos e escaneios — o que era só um atalho passa a alimentar o funil.",
      ],
    },
  },
  comments: {
    compare: {
      more: [
        "Comentário com palavra-chave virando lead",
        "Resposta automática no próprio post",
        "Aviso quando alguém interage",
        "Sorteio conduzido pela ferramenta",
      ],
      less: [
        "Varrer comentário na mão",
        "Seguidor esperando resposta",
        "Interesse perdido no meio dos comentários",
        "Sorteio apurado por print",
      ],
    },
    split: {
      title: "O comentário que vira contato",
      paragraphs: [
        "Palavra-chave, gatilhos, notificações e sorteios no Instagram — quem comentou entra no funil sem ninguém copiar arroba nenhuma.",
      ],
    },
  },
  disparo: {
    compare: {
      more: [
        "Envio pela API oficial da Meta",
        "Template aprovado antes do envio",
        "A janela de 24h respeitada",
        "Custo por conversa à vista",
      ],
      less: [
        "Número bloqueado por uso indevido",
        "Mensagem fora do padrão da Meta",
        "Conta pessoal usada para atender",
        "Custo que aparece só na fatura",
      ],
    },
    split: {
      title: "O caminho oficial, com a regra da Meta respeitada",
      paragraphs: [
        "API oficial, templates aprovados, janela de 24h e custo por conversa — é envio dentro da regra, não disparo em massa.",
      ],
    },
  },
  astro: {
    compare: {
      more: [
        "IA que enxerga o histórico do contato",
        "Base de conhecimento da própria empresa",
        "Atendimento por voz e por WhatsApp",
        "Escolha do modelo de IA",
      ],
      less: [
        "Resposta genérica de robô",
        "Explicar o contexto de novo a cada conversa",
        "Ficar preso a um único fornecedor de IA",
        "O time respondendo sempre o mesmo",
      ],
    },
    split: {
      title: "Uma IA que já leu o histórico",
      paragraphs: [
        "Ela conhece o histórico, responde pelo time, aprende da base de conhecimento da empresa e roda em Claude, GPT ou Gemini — a escolha é de quem contrata.",
      ],
    },
  },
  "space-station": {
    compare: {
      more: [
        "Um escritório onde se vê quem está",
        "Conversa que começa ao chegar perto",
        "Sala de reunião com porta",
        "Auditório para o time inteiro",
      ],
      less: [
        "Reunião marcada para uma pergunta de um minuto",
        "Time remoto sem corredor",
        "Link novo a cada conversa",
        "Evento interno em ferramenta de fora",
      ],
    },
    split: {
      title: "O corredor que o trabalho remoto perdeu",
      paragraphs: [
        "Um mundo navegável com áudio e vídeo por proximidade, salas de reunião e auditório — falar com alguém volta a ser chegar perto.",
      ],
    },
  },
  route: {
    compare: {
      more: [
        "Curso e trilha dentro da própria suíte",
        "eBook e evento no mesmo lugar",
        "Mentoria e assinatura",
        "Checkout próprio",
      ],
      less: [
        "Plataforma de curso à parte",
        "Aluno cadastrado duas vezes",
        "Conteúdo espalhado em drive",
        "Taxa de terceiro em cada venda",
      ],
    },
    split: {
      title: "A área de membros dentro de casa",
      paragraphs: [
        "Cursos, trilhas, eBooks, eventos, mentorias e assinaturas, com checkout próprio — o aluno é o mesmo contato que já está no CRM.",
      ],
    },
  },
  tradegram: {
    compare: {
      more: [
        "Rota do promotor planejada",
        "Foto do PDV com data e lugar",
        "Book pronto para a indústria",
        "Gôndola comparada com o planejado",
      ],
      less: [
        "Relatório de campo por WhatsApp",
        "Foto sem saber de onde veio",
        "Book montado no PowerPoint",
        "Execução conferida por amostragem",
      ],
    },
    split: {
      title: "A execução no PDV, com prova",
      paragraphs: [
        "Promotores e rotas, fotos de PDV, books e planograma — a camada de campo que separa a suíte de um CRM comum.",
      ],
    },
  },
  nerp: {
    compare: {
      more: [
        "Produto, estoque e venda na base do CRM",
        "Um cadastro só para os dois lados",
        "Sincronização assinada",
        "Caminho para quem já tem ERP",
      ],
      less: [
        "Cadastro digitado duas vezes",
        "Estoque que só o ERP conhece",
        "Integração feita por planilha",
        "Venda que o comercial não enxerga",
      ],
    },
    split: {
      title: "Uma base, dois lados",
      paragraphs: [
        "Produto, estoque e venda no mesmo lugar do funil, com sincronização assinada entre os dois lados — e um caminho para quem já tem ERP e não vai trocar.",
      ],
    },
  },
  pdv: {
    compare: {
      more: [
        "Venda no balcão com emissão fiscal",
        "Cancelamento com autorização registrada",
        "Turno aberto e fechado com conferência",
        "O caixa ligado ao estoque",
      ],
      less: [
        "Bloco de nota e digitação depois",
        "Cancelamento sem rastro",
        "Diferença de caixa descoberta dias depois",
        "Venda que não baixa o estoque",
      ],
    },
    split: {
      title: "O balcão ligado ao resto",
      paragraphs: [
        "Venda, emissão fiscal, cancelamento autorizado e fechamento de turno — cada passagem pelo caixa move o estoque e o financeiro.",
      ],
    },
  },
  estoque: {
    compare: {
      more: [
        "Saldo por loja",
        "Entrada e saída registradas",
        "Custo e preço no mesmo cadastro",
        "A venda baixando o saldo",
      ],
      less: [
        "Contar para saber o que tem",
        "Vender o que acabou ontem",
        "Preço diferente em cada lugar",
        "Custo que ninguém sabe dizer",
      ],
    },
    split: {
      title: "O saldo que a venda mantém",
      paragraphs: [
        "Entrada, saída e saldo por loja, com custo e preço no mesmo cadastro que o PDV e o catálogo usam.",
      ],
    },
  },
  inventario: {
    compare: {
      more: [
        "O celular do time virando coletor",
        "Contagem organizada por setor",
        "Divergência apontada na hora",
        "Inventário sem parar a loja",
      ],
      less: [
        "Coletor alugado por temporada",
        "Contagem no papel e digitação depois",
        "Diferença descoberta no fechamento",
        "Loja fechada para contar",
      ],
    },
    split: {
      title: "O coletor que já está no bolso",
      paragraphs: [
        "A câmera do celular lê o código, a contagem sai organizada e a divergência aparece enquanto ainda dá para conferir na gôndola.",
      ],
    },
  },
  "catalogo-promocional": {
    compare: {
      more: [
        "Encarte montado do próprio cadastro",
        "Preço por loja",
        "Link público para mandar ao cliente",
        "Alteração que sai no mesmo dia",
      ],
      less: [
        "Encarte no designer toda semana",
        "Preço errado já impresso",
        "PDF pesado circulando no WhatsApp",
        "Promoção que muda e ninguém atualiza",
      ],
    },
    split: {
      title: "O encarte que nasce do cadastro",
      paragraphs: [
        "A lista de produtos sai do próprio estoque, o preço é por loja e o link é público — a correção de um preço vale para todo mundo na hora.",
      ],
    },
  },
  "qr-preco": {
    compare: {
      more: [
        "O cliente vendo o preço na hora",
        "A loja vendo o que despertou interesse",
        "Leitura sem instalar nada",
        "Medição sem rastrear pessoa",
      ],
      less: [
        "Fila no terminal de consulta",
        "Produto com etiqueta ilegível",
        "Palpite sobre o que o cliente olhou",
        "Coleta de dado pessoal sem necessidade",
      ],
    },
    split: {
      title: "O preço na mão de quem está na gôndola",
      paragraphs: [
        "O cliente escaneia e vê o preço; a loja vê a jornada de interesse por produto — sem rastrear quem escaneou.",
      ],
    },
  },
  "catalogo-online": {
    compare: {
      more: [
        "Vitrine no endereço da própria loja",
        "Carrinho que vira pedido",
        "O mesmo produto do PDV",
        "O mesmo cliente do CRM",
      ],
      less: [
        "Cardápio em PDF",
        "Pedido anotado na conversa",
        "Cadastro de produto em dois lugares",
        "Cliente novo a cada compra",
      ],
    },
    split: {
      title: "A vitrine ligada ao caixa",
      paragraphs: [
        "A loja na internet com endereço próprio, do carrinho ao pedido — e sobre o mesmo cadastro de produto e de cliente que o balcão usa.",
      ],
    },
  },
  planograma: {
    compare: {
      more: [
        "A gôndola desenhada antes de montar",
        "Planejado e executado lado a lado",
        "Share de espaço medido",
        "Revisão guardada",
      ],
      less: [
        "Montagem feita no olho",
        "Conferência por memória",
        "Discussão sobre quanto espaço cada marca teve",
        "Versão antiga sem registro",
      ],
    },
    split: {
      title: "O planejado, ao lado do que foi feito",
      paragraphs: [
        "A gôndola é desenhada, a foto do campo entra ao lado e o share de espaço sai medido — com as revisões guardadas.",
      ],
    },
  },
  book: {
    compare: {
      more: [
        "A foto do campo virando página",
        "Book montado sozinho",
        "Entrega no formato que a indústria pede",
        "Prova de execução com data",
      ],
      less: [
        "Montar apresentação foto a foto",
        "Verba travada por falta de comprovação",
        "Arquivo gigante indo por e-mail",
        "Foto sem contexto nenhum",
      ],
    },
    split: {
      title: "A prova que libera a verba",
      paragraphs: [
        "As fotos de execução viram páginas montadas e um book pronto para entregar à indústria, com data e lugar em cada registro.",
      ],
    },
  },
  trafego: {
    compare: {
      more: [
        "Campanha ligada ao funil",
        "O lead do anúncio entrando no CRM",
        "A venda da loja ligada ao anúncio",
        "Verba acompanhada de perto",
      ],
      less: [
        "Anúncio que gera lead e some",
        "Planilha para juntar anúncio e venda",
        "Verba sem retorno visível",
        "Relatório que chega tarde demais",
      ],
    },
    split: {
      title: "Do anúncio ao que ele fechou",
      paragraphs: [
        "O cliente chega pelo anúncio e avança no funil; a loja abre e vende — os dois lados no mesmo lugar.",
      ],
    },
  },
};

/** `space-station` já vem com hífen; o resto é o próprio id. */
function slugFor(tool: Tool) {
  return PAGE_COPY[tool.id]?.slug ?? tool.id;
}

export function buildSolutionPage(
  tool: Tool,
  options: { whatsappHref: string },
): SitePageSeed {
  const copy = PAGE_COPY[tool.id] ?? {};
  const category = CATEGORIES.find((c) => c.id === tool.category);

  const blocks: SiteBlock[] = [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      eyebrow: category?.title ?? "",
      title: copy.heroTitle ?? `${tool.fullName}: ${tool.tagline}`,
      text: tool.summary,
      primary: {
        label: "Agendar uma demonstração",
        href: options.whatsappHref,
      },
      secondary: { label: "Ver funcionalidades", href: "#funcionalidades" },
      image: { key: "", alt: "" },
    },
    {
      id: "statement",
      type: "statement",
      enabled: true,
      title: copy.statementTitle ?? tool.tagline,
      text: copy.statementText ?? tool.summary,
      cta: { label: "Falar com um especialista", href: options.whatsappHref },
    },
    {
      id: "compare",
      type: "compare",
      // Sem texto aprovado, as duas colunas seriam invenção.
      enabled: Boolean(copy.compare),
      title: `Com o ${tool.name} você terá`,
      moreTitle: "MAIS",
      more: copy.compare?.more ?? [],
      lessTitle: "MENOS",
      less: copy.compare?.less ?? [],
    },
    {
      id: "features",
      type: "features",
      // Sem funcionalidades no catálogo, o bloco entra desligado em vez de
      // aparecer vazio na página.
      enabled: tool.features.length > 0,
      title: `O que o ${tool.name} faz`,
      items: tool.features.map((feature) => ({
        title: feature.title,
        text: feature.description,
      })),
    },
    {
      id: "split",
      type: "split",
      enabled: Boolean(copy.split),
      title: copy.split?.title ?? "",
      paragraphs: copy.split?.paragraphs ?? [],
      image: { key: "", alt: "" },
      imageSide: "left",
    },
    {
      id: "video",
      type: "video",
      // Ligado sem endereço, o painel azul apareceria vazio.
      enabled: false,
      title: "Mais que um sistema, uma parceria",
      text: "",
      youtubeUrl: "",
    },
    {
      id: "clients",
      type: "clients",
      // Faixa de clientes sem logo é promessa vazia.
      enabled: false,
      title: "Nossos clientes",
      logos: [],
    },
    {
      id: "contact",
      type: "contact",
      enabled: true,
      title: "Vamos impulsionar a gestão do seu negócio?",
      options: [
        {
          kind: "whatsapp",
          label: "Converse por WhatsApp",
          href: options.whatsappHref,
        },
        {
          kind: "callback",
          label: "Nós ligamos para você",
          href: options.whatsappHref,
        },
      ],
    },
  ];

  return {
    section: "solucoes",
    slug: slugFor(tool),
    toolId: tool.id,
    title: tool.name,
    seoTitle: `${tool.name} — ÓRBITA HUB`,
    seoDescription: tool.tagline,
    blocks,
  };
}

/** As 19 páginas de solução, na ordem do catálogo. */
export function buildAllSolutionPages(options: {
  whatsappHref: string;
}): SitePageSeed[] {
  return RAW_TOOLS.map((tool) => buildSolutionPage(tool, options));
}

/** O slug de uma ferramenta, para o menu apontar para a página dela. */
export function solutionSlug(toolId: string): string | null {
  const tool = findCatalogTool(toolId);
  return tool ? slugFor(tool) : null;
}
