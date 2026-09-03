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

/**
 * Texto autoral, por ferramenta.
 *
 * Cada campo é OPCIONAL — o que não estiver aqui cai no default enxuto do
 * `buildSolutionPage`. Mais tarde, o admin do site pode sobrescrever qualquer
 * um destes valores no banco.
 *
 * Convenção da voz da ÓRBITA (baseada na copy do CRM Tracking, aprovada):
 * frases curtas, verbo no presente, comparações com o "mercado" ficam
 * implícitas (o Mais/Menos e o herói já carregam o gatilho). Sem "revolução",
 * "melhor do mercado", "líder" — a marca ganha peso mostrando O QUE ela faz,
 * não com adjetivos.
 */
type PageCopy = {
  /** Endereço da página. Sem isto, o slug sai do id da ferramenta. */
  slug?: string;
  heroTitle?: string;
  /** Subtítulo do herói. Ausente: cai no `tool.summary`. */
  heroText?: string;
  /** Rótulo do primeiro botão do herói. Ausente: "Agendar uma demonstração". */
  heroPrimaryLabel?: string;
  /** Rótulo do segundo botão do herói. Ausente: "Ver funcionalidades". */
  heroSecondaryLabel?: string;
  statementTitle?: string;
  statementText?: string;
  /** Rótulo do CTA da statement. Ausente: "Falar com um especialista". */
  statementCta?: string;
  compare?: { more: string[]; less: string[] };
  split?: { title: string; paragraphs: string[] };
  /** Título do bloco de contato. Ausente: "Vamos impulsionar a gestão do seu negócio?". */
  contactTitle?: string;
};

const PAGE_COPY: Record<string, PageCopy> = {
  tracking: {
    slug: "crm-tracking",
    heroTitle: "CRM Tracking: o funil que anda quando o card anda",
    heroText:
      "Enquanto sua planilha vira memória, cada card aqui é um contrato próximo — com histórico, dono e prazo. Nada some, ninguém esquece.",
    heroPrimaryLabel: "Ver meu funil hoje",
    heroSecondaryLabel: "Como funciona",
    statementTitle: "O único CRM que se molda ao processo que já dá certo.",
    statementText:
      "Cada empresa tem um jeito de vender. Aqui, você monta o funil — não o contrário. Vários funis, várias etapas, uma base de contatos.",
    statementCta: "Falar com o time comercial",
    compare: {
      more: [
        "Histórico do contato num lugar só",
        "Previsibilidade do que vai fechar",
        "Motivo registrado em cada perda",
        "Time inteiro olhando o mesmo funil",
        "Vendedor movendo o card na rua",
      ],
      less: [
        "Lead esquecido na caixa de entrada",
        "Planilha paralela que só uma pessoa entende",
        "Reunião para descobrir em que pé está cada negócio",
        "Card parado sem ninguém perceber",
        "Vendedor que sai levando a carteira",
      ],
    },
    split: {
      title: "O funil no bolso de quem está na rua",
      paragraphs: [
        "O vendedor move o card, registra o motivo da perda e vê o histórico do contato — sem voltar para o computador.",
        "Cada movimentação vai para o funil da empresa em tempo real. Sem retrabalho, sem re-digitação, sem confiar na memória.",
      ],
    },
    contactTitle: "Pronto para ver seu funil andar sozinho?",
  },
  chat: {
    heroTitle: "Chat: a conversa que também trabalha por você",
    heroText:
      "O WhatsApp deixou de ser conversa de bastidor. Aqui, cada mensagem vira histórico, cada contato tem dono e cada resposta abre caminho para a próxima venda.",
    heroPrimaryLabel: "Ativar meu WhatsApp",
    heroSecondaryLabel: "Ver como conecta",
    statementTitle:
      "Todo cliente atendido pelo mesmo número — mesmo com o time trocando de plantão.",
    statementText:
      "Vários atendentes, uma caixa. API oficial da Meta, mensagens em texto, áudio e mídia. O contato não repete a história, o vendedor não perde o contexto.",
    statementCta: "Conectar meu WhatsApp agora",
    compare: {
      more: [
        "A conversa inteira dentro do CRM",
        "Vários números na mesma caixa de entrada",
        "Agenda e proposta sem sair do chat",
        "Histórico do contato junto da mensagem",
        "Time atendendo pelo número da empresa",
      ],
      less: [
        "Número no celular de um vendedor só",
        "Conversa que sai da empresa quando a pessoa sai",
        "Cliente repetindo o que já contou",
        "Print de tela para provar o que foi combinado",
        "WhatsApp Business banido por uso indevido",
      ],
    },
    split: {
      title: "A conversa no mesmo lugar do processo",
      paragraphs: [
        "Texto, áudio e mídia pela API oficial da Meta, com várias instâncias na mesma caixa. Cada mensagem já nasce ligada ao contato certo.",
        "O atendente termina a conversa e o vendedor abre o card sabendo o que foi combinado — sem cópia, sem imprensão, sem retrabalho.",
      ],
    },
    contactTitle: "Quer ver seu WhatsApp conversando com o funil?",
  },
  forms: {
    heroTitle: "Forms: cada resposta é um lead entrando no funil",
    heroText:
      "Enquanto formulários viram e-mail perdido, aqui cada resposta cai direto na etapa certa do CRM — com o WhatsApp validado no momento do envio.",
    heroPrimaryLabel: "Publicar meu formulário",
    heroSecondaryLabel: "Ver o construtor",
    statementTitle: "Do clique ao card, um caminho só.",
    statementText:
      "Construa a página visualmente, publique num link próprio e assista as respostas virarem contatos classificados. Sem desenvolvedor, sem planilha, sem re-digitação.",
    statementCta: "Ver como funciona",
    compare: {
      more: [
        "Formulário no ar sem depender de desenvolvedor",
        "Resposta entrando direto no funil, na etapa certa",
        "WhatsApp conferido no momento do envio",
        "Resposta arquivada em PDF, pronta pra assinar",
        "Anexo guardado junto do contato",
      ],
      less: [
        "Formulário que só devolve um e-mail",
        "Digitar resposta no CRM à mão",
        "Número errado descoberto na hora de ligar",
        "Anexo perdido na caixa de entrada",
        "Lead esperando três dias por retorno",
      ],
    },
    split: {
      title: "Da resposta ao funil, sem passar pela mão de ninguém",
      paragraphs: [
        "O construtor é visual e a página é pública. Quem responde vira lead classificado no funil, com o WhatsApp já validado.",
        "O time comercial abre o card sabendo o que a pessoa pediu, quando pediu e qual anexo mandou — sem trocar de aba.",
      ],
    },
    contactTitle: "Pronto para transformar sua página em máquina de lead?",
  },
  agendas: {
    heroTitle: "Agendas: o horário marcado já entra no CRM",
    heroText:
      "Chega de vai-e-volta pra achar horário. O cliente escolhe, o responsável certo é bloqueado e o card nasce com data, dono e histórico.",
    heroPrimaryLabel: "Ver minha agenda pública",
    heroSecondaryLabel: "Como funciona",
    statementTitle:
      "Uma agenda por responsável, uma página pública, zero conflito.",
    statementText:
      "Cliente marca sozinho, dentro da disponibilidade real de quem vai atender. E o card já entra no funil no mesmo instante — sem cadastro manual, sem lembrete perdido.",
    statementCta: "Abrir minha agenda pública",
    compare: {
      more: [
        "Página pública para o cliente escolher o horário",
        "Uma agenda por responsável, sem conflito",
        "Marcação feita dentro da conversa",
        "Horário marcado virando contato",
        "Lembrete automático antes da reunião",
      ],
      less: [
        "Vai-e-volta de mensagem para achar horário",
        "Duas pessoas marcadas no mesmo intervalo",
        "Agenda numa ferramenta e cliente em outra",
        "Quem agendou sem cadastro nenhum",
        "Cliente esquecido do horário na última hora",
      ],
    },
    split: {
      title: "O horário marcado já nasce como contato",
      paragraphs: [
        "Cada responsável com a própria disponibilidade, uma página pública para marcar e o agendamento também pelo chat.",
        "O horário fechado entra no CRM, o card é criado, o lembrete é enviado. Você aparece na reunião sabendo com quem vai falar.",
      ],
    },
    contactTitle: "Quer sua agenda funcionando sozinha?",
  },
  forge: {
    heroTitle: "Forge: proposta aceita é atendimento avisado",
    heroText:
      "Enquanto contratos vivem em pastas de e-mail, aqui o aceite digital move o card sozinho e o time comercial descobre na hora que fechou.",
    heroPrimaryLabel: "Montar minha primeira proposta",
    heroSecondaryLabel: "Ver o fluxo",
    statementTitle:
      "A proposta virou um passo do processo — não um documento avulso.",
    statementText:
      "Templates sobre o catálogo, assinatura digital pública e o card andando no funil quando o cliente aceita. Cada proposta tem dono, prazo e status à vista.",
    statementCta: "Falar com nosso comercial",
    compare: {
      more: [
        "Proposta montada a partir do catálogo",
        "Aceite com assinatura digital, com validade",
        "Visão em tempo real do que está em aprovação",
        "Proposta aceita seguindo sozinha para a próxima etapa",
        "Histórico do que foi negociado com cada cliente",
      ],
      less: [
        "Proposta refeita do zero a cada pedido",
        "Contrato impresso para assinar",
        "Perguntar por e-mail se já foi aprovado",
        "Digitar de novo o que já foi fechado",
        "Comercial descobrindo o aceite dois dias depois",
      ],
    },
    split: {
      title: "Do catálogo ao aceite, no mesmo caminho",
      paragraphs: [
        "Templates sobre o catálogo de produtos, assinatura digital pública e passagem automática de etapa quando o cliente aceita.",
        "O dashboard mostra o que está parado em qual porta — quem precisa cobrar, quem precisa aprovar, quem precisa começar a executar.",
      ],
    },
    contactTitle: "Quer sua próxima proposta rodando no piloto automático?",
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
    heroTitle: "Payment: o financeiro que fecha o mês sozinho",
    heroText:
      "Cobrança que corre atrás, saldo que anda em tempo real e pagamento que passa pelo olho de quem precisa aprovar — antes de sair da conta.",
    heroPrimaryLabel: "Assumir o financeiro hoje",
    heroSecondaryLabel: "Ver o fluxo",
    statementTitle:
      "Do orçamento aprovado ao dinheiro na conta, um caminho só.",
    statementText:
      "Contas a pagar e a receber, fluxo de caixa, centros de custo e régua de cobrança. Gateways integrados. Cada real vendido bate com cada real recebido.",
    statementCta: "Falar com nosso financeiro",
    compare: {
      more: [
        "Contas a pagar e a receber no mesmo painel",
        "Fluxo de caixa por centro de custo",
        "Aprovação registrada antes do pagamento",
        "Cobrança que segue sozinha até o cliente",
        "Saldo real, atualizado a cada movimento",
      ],
      less: [
        "Planilha de contas que só uma pessoa mantém",
        "Descobrir o saldo no fim do mês",
        "Pagamento aprovado por mensagem no grupo",
        "Boleto vencido sem ninguém avisar",
        "Inadimplência descoberta com dois meses de atraso",
      ],
    },
    split: {
      title: "O dinheiro no mesmo sistema da venda",
      paragraphs: [
        "Contas, fluxo de caixa, centros de custo, aprovações e régua de cobrança. Gateways de pagamento integrados — o que foi vendido conversa com o que foi recebido.",
        "Nada de exportar planilha, empurrar boleto por WhatsApp ou esperar o extrato bater. O financeiro vira parte do processo — não um passo extra.",
      ],
    },
    contactTitle: "Quer o financeiro rodando sem você olhar toda hora?",
  },
  nbox: {
    heroTitle: "N-box: o arquivo no lugar em que ele é usado",
    heroText:
      "Drive não sabe que aquele contrato pertence àquele cliente. Aqui, o arquivo mora dentro do processo — some da caixa de entrada e aparece na hora certa.",
    heroPrimaryLabel: "Organizar meus arquivos",
    heroSecondaryLabel: "Ver a estrutura",
    statementTitle: "Fim do arquivo caçado no e-mail.",
    statementText:
      "Pastas por processo, links para gente de fora, controle do que é público e cota por plano. O arquivo vive junto do que ele serve — cliente, projeto ou contrato.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Arquivo guardado junto do processo",
        "Link seguro para quem está de fora",
        "Controle do que é público e do que não é",
        "Cota definida por plano",
        "Histórico de quem baixou o quê",
      ],
      less: [
        "Contrato no computador de uma pessoa",
        "Anexo caçado no e-mail",
        "Arquivo de cliente misturado com o resto",
        "Versão antiga circulando por aí",
        "Nuvem pessoal com dado da empresa",
      ],
    },
    split: {
      title: "O arquivo no mesmo lugar do processo",
      paragraphs: [
        "Pastas por processo, links para gente de fora, controle do que é público e cota por plano.",
        "O arquivo vive junto do que ele serve. O contrato vem no card do cliente, a arte vem no card da campanha, a planilha vem no card do fechamento.",
      ],
    },
    contactTitle: "Cansado de perder anexo?",
  },
  ranking: {
    heroTitle: "Ranking: quem produz aparece — enquanto ainda dá para reagir",
    heroText:
      "Fim do quadro de metas atualizado na sexta. Aqui, o pódio anda em tempo real e o time enxerga a posição no telão da loja, no PC do gestor ou no bolso.",
    heroPrimaryLabel: "Ligar meu telão de metas",
    heroSecondaryLabel: "Ver como funciona",
    statementTitle: "A meta que anda sozinha e cobra sozinha.",
    statementText:
      "O número sai do próprio funil, o pódio se atualiza a cada card fechado e o telão faz o time se olhar de canto de olho. Meta importada uma vez, competição rodando o mês inteiro.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Meta por equipe e por vendedor",
        "Pódio que se atualiza sozinho",
        "Telão para o time acompanhar em tempo real",
        "Metas importadas de uma vez, sem re-digitar",
        "Comissão calculada em cima do fechado",
      ],
      less: [
        "Quadro de metas atualizado à mão",
        "Descobrir a posição só no fim do mês",
        "Uma planilha de meta em cada gestor",
        "Ranking que ninguém confere",
        "Time desmotivado por não ver o próprio esforço",
      ],
    },
    split: {
      title: "A meta visível enquanto ainda dá para reagir",
      paragraphs: [
        "Metas por equipe e por vendedor, pódio e modo telão. O número sai do próprio funil — ninguém precisa alimentar o painel.",
        "O vendedor vê a posição no bolso, o gestor vê o time inteiro no monitor, o dono vê a receita no fim do mês. Sem planilha entre eles.",
      ],
    },
    contactTitle: "Quer o time competindo pelo que importa?",
  },
  planner: {
    heroTitle: "Planner: da marca ao post publicado, no mesmo lugar",
    heroText:
      "Enquanto agências vivem entre 8 ferramentas, aqui a identidade, o briefing, o calendário editorial e a peça publicada moram na mesma janela. Com IA que já leu sua marca.",
    heroPrimaryLabel: "Planejar meu próximo mês",
    heroSecondaryLabel: "Ver o fluxo criativo",
    statementTitle:
      "Marketing feito no ritmo do negócio, não da agenda do designer.",
    statementText:
      "Identidade de marca guardada, briefing gerado por IA, mapas mentais, calendário editorial e editor com publicação. O plano e a peça no mesmo lugar — sem trocar ferramenta.",
    statementCta: "Falar com nosso time criativo",
    compare: {
      more: [
        "Identidade da marca guardada num lugar só",
        "Briefing pronto em minutos, gerado por IA",
        "Calendário editorial à vista de todo o time",
        "Peça editada e publicada sem sair da plataforma",
        "Aprovação do cliente registrada no calendário",
      ],
      less: [
        "Post decidido na véspera, sem plano",
        "Briefing passado por áudio de 12 minutos",
        "Calendário em planilha que ninguém abre",
        "Arquivo final no WhatsApp de alguém",
        "Marca sem consistência de post para post",
      ],
    },
    split: {
      title: "Do briefing à publicação, sem trocar de ferramenta",
      paragraphs: [
        "Identidade de marca, briefing gerado por IA, mapas mentais, calendário editorial e editor com publicação.",
        "O plano nasce sabendo o que a marca vende, para quem vende e como fala. A peça sai no ar herdando isso — não reinventando cada vez.",
      ],
    },
    contactTitle: "Pronto para o próximo trimestre pensado?",
  },
  pages: {
    heroTitle: "Pages: landing page publicada hoje, revisível amanhã",
    heroText:
      "Enquanto sites institucionais dependem do dev, aqui o time monta por blocos, publica em domínio próprio e mede o resultado no mesmo painel — sem esperar sprint.",
    heroPrimaryLabel: "Publicar minha primeira página",
    heroSecondaryLabel: "Ver os blocos",
    statementTitle: "A página no ar hoje. E melhor amanhã.",
    statementText:
      "Vinte e seis blocos prontos, templates, versionamento e analytics embutido. Publica em domínio próprio comprado dentro da plataforma. O time monta, mede e corrige sozinho.",
    statementCta: "Ver os blocos disponíveis",
    compare: {
      more: [
        "Landing page montada por blocos",
        "Versão anterior guardada, revertível",
        "Número de acesso na mesma tela",
        "Domínio próprio comprado sem sair daqui",
        "Formulário integrado ao CRM",
      ],
      less: [
        "Esperar a agenda do desenvolvedor",
        "Página sem histórico de mudança",
        "Analytics em outro painel",
        "Endereço genérico de plataforma de terceiro",
        "Página de captura desconectada do funil",
      ],
    },
    split: {
      title: "A página no ar hoje, e revisível amanhã",
      paragraphs: [
        "Vinte e seis blocos prontos, templates, versionamento, analytics e domínio próprio.",
        "A página é montada, medida e corrigida pelo mesmo time — o gestor de marketing não depende do dev pra trocar uma headline.",
      ],
    },
    contactTitle: "Quer sua próxima campanha no ar hoje?",
  },
  linnker: {
    heroTitle: "Linnker: seu link da bio virou canal de aquisição",
    heroText:
      "Linktree perde a visita depois do clique. Aqui, cada acesso pode virar lead, o QR é seu e o painel mostra o que funcionou — do post ao contato.",
    heroPrimaryLabel: "Criar minha página",
    heroSecondaryLabel: "Ver na prática",
    statementTitle: "Cada clique tem hora, canal e nome.",
    statementText:
      "Página de links com QR próprio, captura de lead na hora e contagem de acessos e escaneios. O link da bio deixa de ser atalho e passa a alimentar o funil.",
    statementCta: "Publicar minha bio",
    compare: {
      more: [
        "Uma página com todos os links",
        "QR próprio para material impresso",
        "Lead capturado na própria página",
        "Contagem de acessos e escaneios",
        "Origem do lead registrada no card",
      ],
      less: [
        "Um link diferente em cada canal",
        "QR de serviço de terceiro",
        "Visita que não vira contato",
        "Palpite sobre o que funcionou",
        "Bio genérica que serve para todos",
      ],
    },
    split: {
      title: "O link da bio que devolve contato",
      paragraphs: [
        "Página de links com QR Code próprio, captura de lead e contagem de acessos e escaneios.",
        "O que era só um atalho passa a alimentar o funil. Você vê de qual post veio, em que dia, e a partir daí conversa com esse contato pelo CRM.",
      ],
    },
    contactTitle: "Pronto para transformar sua bio em máquina de lead?",
  },
  comments: {
    heroTitle: "Comments: comentar vira entrar no funil",
    heroText:
      "Enquanto o time varre comentário na mão, aqui a palavra-chave puxa o seguidor pra dentro — com resposta automática, DM sequenciada e o lead classificado.",
    heroPrimaryLabel: "Ativar minha automação",
    heroSecondaryLabel: "Ver os gatilhos",
    statementTitle: "Um post viral deixou de ser trabalho — virou receita.",
    statementText:
      "Palavra-chave no comentário aciona resposta pública, envia DM e move o card no funil. Sorteio conduzido pela ferramenta, com auditoria. Quem comentou não espera mais.",
    statementCta: "Ver casos de conversão",
    compare: {
      more: [
        "Comentário com palavra-chave virando lead",
        "Resposta automática no próprio post",
        "Aviso quando alguém interage",
        "Sorteio conduzido pela ferramenta, sem print",
        "DM seguindo sozinha depois do comentário",
      ],
      less: [
        "Varrer comentário na mão",
        "Seguidor esperando resposta por horas",
        "Interesse perdido no meio dos comentários",
        "Sorteio apurado por print, sem prova",
        "Post viralizando e vendedor sem tempo pra atender",
      ],
    },
    split: {
      title: "O comentário que vira contato",
      paragraphs: [
        "Palavra-chave, gatilhos, notificações e sorteios no Instagram.",
        "Quem comentou entra no funil sem ninguém copiar arroba nenhuma. E a próxima peça do time sabe que aquela pessoa já veio.",
      ],
    },
    contactTitle: "Quer o próximo post virando conversa?",
  },
  disparo: {
    heroTitle: "Disparo: envio dentro da regra, sem número bloqueado",
    heroText:
      "Enquanto o mercado usa robô para acabar banido, aqui o envio passa pela API oficial da Meta — com template aprovado e custo por conversa à vista.",
    heroPrimaryLabel: "Ligar meu disparo oficial",
    heroSecondaryLabel: "Ver custos",
    statementTitle: "É comunicação em escala, não disparo em massa.",
    statementText:
      "API oficial da Meta, templates aprovados, janela de 24h respeitada e custo transparente por conversa. Sem risco de bloqueio, sem perder o número que a empresa levou anos pra construir.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Envio pela API oficial da Meta",
        "Template aprovado antes do envio",
        "Janela de 24h respeitada",
        "Custo por conversa à vista",
        "Número da empresa preservado",
      ],
      less: [
        "Número bloqueado por uso indevido",
        "Mensagem fora do padrão da Meta",
        "Conta pessoal usada para atender",
        "Custo que aparece só na fatura",
        "Cliente marcando spam e caindo pra outro plano",
      ],
    },
    split: {
      title: "O caminho oficial, com a regra da Meta respeitada",
      paragraphs: [
        "API oficial, templates aprovados, janela de 24h e custo por conversa.",
        "É envio dentro da regra, não disparo em massa. Sua base cresce, seu número segue de pé.",
      ],
    },
    contactTitle: "Pronto pra comunicar sem risco?",
  },
  astro: {
    heroTitle: "Astro: uma IA que já leu o histórico do cliente",
    heroText:
      "Enquanto chatbots falam com todo mundo igual, o Astro responde sabendo o nome, o produto que a pessoa comprou e a última reclamação — em Claude, GPT ou Gemini, escolha sua.",
    heroPrimaryLabel: "Ligar a IA no meu atendimento",
    heroSecondaryLabel: "Ver como aprende",
    statementTitle: "IA que conhece o seu cliente, não uma resposta pronta.",
    statementText:
      "Aprende da base de conhecimento da empresa, enxerga o histórico do contato e responde pelo time — texto ou voz. Sem lock-in: você troca o modelo de IA quando quiser.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "IA que enxerga o histórico do contato",
        "Base de conhecimento da própria empresa",
        "Atendimento por voz e por WhatsApp",
        "Escolha do modelo de IA — Claude, GPT ou Gemini",
        "Time avisado quando a IA não sabe responder",
      ],
      less: [
        "Resposta genérica de robô",
        "Explicar o contexto de novo a cada conversa",
        "Ficar preso a um único fornecedor de IA",
        "O time respondendo sempre o mesmo",
        "IA que inventa resposta com dado fora do banco",
      ],
    },
    split: {
      title: "Uma IA que já leu o histórico",
      paragraphs: [
        "Ela conhece o histórico, responde pelo time e aprende da base de conhecimento da empresa.",
        "Roda em Claude, GPT ou Gemini — a escolha é de quem contrata. E quando ela não sabe, avisa o humano. Sem inventar dado.",
      ],
    },
    contactTitle: "Quer sua IA falando a linguagem da sua marca?",
  },
  "space-station": {
    heroTitle: "Space Station: o corredor que o trabalho remoto perdeu",
    heroText:
      "Times remotos não têm cafezinho. Aqui, o escritório é um mundo 2D onde chegar perto é começar a conversar — sem link novo, sem reunião marcada pra pergunta de 30 segundos.",
    heroPrimaryLabel: "Explorar o escritório",
    heroSecondaryLabel: "Ver a experiência",
    statementTitle: "Falar com alguém volta a ser chegar perto.",
    statementText:
      "Um mundo navegável com áudio e vídeo por proximidade, salas de reunião com porta e auditório para o time inteiro. A cadeira do lado voltou a existir — mesmo com o time em três estados.",
    statementCta: "Ver o mundo em ação",
    compare: {
      more: [
        "Um escritório onde se vê quem está",
        "Conversa que começa ao chegar perto",
        "Sala de reunião com porta",
        "Auditório para o time inteiro",
        "Salinha reservada para bate-papo do time",
      ],
      less: [
        "Reunião marcada para uma pergunta de um minuto",
        "Time remoto sem corredor, sem cafezinho",
        "Link novo a cada conversa",
        "Evento interno em ferramenta de fora",
        "Sensação de estar sozinho num call vazio",
      ],
    },
    split: {
      title: "O corredor que o trabalho remoto perdeu",
      paragraphs: [
        "Um mundo navegável com áudio e vídeo por proximidade, salas de reunião e auditório.",
        "O time volta a se ver, a se encontrar, a se cumprimentar. E o gestor volta a saber quem está por perto, sem precisar mandar mensagem.",
      ],
    },
    contactTitle: "Quer o time remoto se sentindo junto?",
  },
  route: {
    heroTitle: "Route: monetize o que sua empresa sabe, sem taxa em cada venda",
    heroText:
      "Enquanto plataformas de curso levam 20% de cada venda, aqui o checkout é seu, o aluno é seu contato do CRM e o conteúdo mora ao lado do resto do negócio.",
    heroPrimaryLabel: "Lançar meu primeiro curso",
    heroSecondaryLabel: "Ver o que dá pra vender",
    statementTitle: "A área de membros dentro de casa.",
    statementText:
      "Cursos, trilhas, eBooks, eventos, mentorias e assinaturas. Checkout próprio, sem taxa de plataforma. E o aluno é o mesmo contato que já está no seu CRM.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Curso e trilha dentro da própria suíte",
        "eBook e evento no mesmo lugar",
        "Mentoria e assinatura recorrente",
        "Checkout próprio, sem taxa de terceiro",
        "Aluno virando lead do próprio funil",
      ],
      less: [
        "Plataforma de curso à parte",
        "Aluno cadastrado duas vezes",
        "Conteúdo espalhado em drive",
        "Taxa de terceiro em cada venda",
        "Marca do fornecedor em cima da sua",
      ],
    },
    split: {
      title: "A área de membros dentro de casa",
      paragraphs: [
        "Cursos, trilhas, eBooks, eventos, mentorias e assinaturas, com checkout próprio.",
        "O aluno é o mesmo contato que já está no CRM — o que ele comprou, o que viu e o que abandonou fica registrado onde o time comercial vê.",
      ],
    },
    contactTitle: "Pronto pra vender o que sua empresa já sabe?",
  },
  tradegram: {
    heroTitle: "TradeGram: o que foi combinado, conferido na gôndola",
    heroText:
      "Trade marketing morre em auditoria por amostragem. Aqui, cada foto do PDV tem GPS, data e produto identificado — e o book da indústria sai pronto no mesmo dia.",
    heroPrimaryLabel: "Ver a execução no campo",
    heroSecondaryLabel: "Como monta o book",
    statementTitle: "A camada de campo que separa a suíte de um CRM comum.",
    statementText:
      "Promotores e rotas, fotos de PDV com GPS, books montados sozinhos e planograma comparado com a gôndola real. A verba da indústria vira execução comprovada.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Rota do promotor planejada",
        "Foto do PDV com data e lugar",
        "Book pronto para a indústria",
        "Gôndola comparada com o planejado",
        "Prova de execução para desbloquear verba",
      ],
      less: [
        "Relatório de campo por WhatsApp",
        "Foto sem saber de onde veio",
        "Book montado no PowerPoint",
        "Execução conferida por amostragem",
        "Verba travada por falta de prova",
      ],
    },
    split: {
      title: "A execução no PDV, com prova",
      paragraphs: [
        "Promotores e rotas, fotos de PDV, books e planograma.",
        "A camada de campo que separa a suíte de um CRM comum. Você mostra o que aconteceu na gôndola sem depender de quem estava no PDV.",
      ],
    },
    contactTitle: "Quer sua verba trade rodando com prova?",
  },
  nerp: {
    heroTitle: "NERP: o ERP dentro da suíte — não outro ERP",
    heroText:
      "Quem tem ERP não quer trocar, quem não tem sofre pra escolher. O NERP resolve os dois: opera a loja de ponta a ponta e conversa com o ERP que já roda na sua contabilidade.",
    heroPrimaryLabel: "Falar com o time NERP",
    heroSecondaryLabel: "Como se integra",
    statementTitle: "Uma base, dois lados.",
    statementText:
      "Produto, estoque e venda no mesmo lugar do funil — com sincronização assinada quando o cliente já tem outro ERP e não vai trocar. O comercial enxerga o que a loja vendeu, a loja enxerga quem comprou.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Produto, estoque e venda na base do CRM",
        "Um cadastro só para os dois lados",
        "Sincronização assinada com ERP externo",
        "Caminho suave para quem já tem ERP",
        "Fiscal, financeiro e comercial olhando o mesmo dado",
      ],
      less: [
        "Cadastro digitado duas vezes",
        "Estoque que só o ERP conhece",
        "Integração feita por planilha",
        "Venda que o comercial não enxerga",
        "Substituir o ERP inteiro no meio do ano",
      ],
    },
    split: {
      title: "Uma base, dois lados",
      paragraphs: [
        "Produto, estoque e venda no mesmo lugar do funil.",
        "Sincronização assinada entre os dois lados — quem já tem ERP e não vai trocar continua com ele; o NERP cuida da operação e conversa com o que já roda.",
      ],
    },
    contactTitle: "Quer o ERP e o CRM falando a mesma língua?",
  },
  pdv: {
    heroTitle: "PDV: o balcão que fala com o estoque e o financeiro",
    heroText:
      "Enquanto sistemas de caixa vivem soltos, o PDV daqui move estoque, baixa financeiro e emite fiscal na mesma tela — sem digitação em duplicidade, sem diferença descoberta depois.",
    heroPrimaryLabel: "Ver meu PDV rodando",
    heroSecondaryLabel: "Como funciona",
    statementTitle: "Cada bipe move o negócio inteiro.",
    statementText:
      "Venda, emissão fiscal, cancelamento com autorização e fechamento de turno com conferência. O caixa deixa de ser um sistema à parte e vira parte do fluxo — estoque, financeiro e comercial olhando o mesmo dado.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Venda no balcão com emissão fiscal",
        "Cancelamento com autorização registrada",
        "Turno aberto e fechado com conferência",
        "Caixa ligado ao estoque em tempo real",
        "Vendedor com atalhos e leitor no celular",
      ],
      less: [
        "Bloco de nota e digitação depois",
        "Cancelamento sem rastro",
        "Diferença de caixa descoberta dias depois",
        "Venda que não baixa o estoque",
        "Fila no caixa por sistema lento",
      ],
    },
    split: {
      title: "O balcão ligado ao resto",
      paragraphs: [
        "Venda, emissão fiscal, cancelamento autorizado e fechamento de turno.",
        "Cada passagem pelo caixa move o estoque e o financeiro — o dono não precisa esperar o fim do mês pra saber o que rodou.",
      ],
    },
    contactTitle: "Quer seu caixa parte do processo?",
  },
  estoque: {
    heroTitle: "Estoque: o saldo que a venda mantém, não o gestor",
    heroText:
      "Enquanto sistemas fazem o estoque virar planilha, aqui cada venda baixa o saldo, cada entrada registra o custo e cada loja enxerga o que tem — sem contar pra descobrir.",
    heroPrimaryLabel: "Ver meu estoque agora",
    heroSecondaryLabel: "Como se organiza",
    statementTitle: "Um cadastro, todas as lojas, saldo em tempo real.",
    statementText:
      "Entrada, saída e saldo por loja. Custo e preço no mesmo cadastro que o PDV e o catálogo usam. Uma alteração vale pra todo mundo — sem duas planilhas, sem preço divergente entre canal e balcão.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Saldo por loja",
        "Entrada e saída registradas com nota",
        "Custo e preço no mesmo cadastro",
        "Venda baixando o saldo em tempo real",
        "Alerta de ruptura antes de faltar",
      ],
      less: [
        "Contar para saber o que tem",
        "Vender o que acabou ontem",
        "Preço diferente em cada canal",
        "Custo que ninguém sabe dizer",
        "Ruptura descoberta pelo cliente reclamando",
      ],
    },
    split: {
      title: "O saldo que a venda mantém",
      paragraphs: [
        "Entrada, saída e saldo por loja, com custo e preço no mesmo cadastro que o PDV e o catálogo usam.",
        "O gerente enxerga o que falta antes de faltar, e o dono descobre o custo médio real — sem esperar o inventário do fim do ano.",
      ],
    },
    contactTitle: "Quer o estoque contando sozinho?",
  },
  inventario: {
    heroTitle: "Inventário: o coletor que já está no bolso do seu time",
    heroText:
      "Alugar coletor é caro, contar no papel é lento. Aqui a câmera do celular lê o código, o app organiza por setor e a divergência aparece antes de a loja fechar.",
    heroPrimaryLabel: "Fazer meu inventário hoje",
    heroSecondaryLabel: "Como funciona no celular",
    statementTitle: "Inventário sem fechar a loja e sem alugar equipamento.",
    statementText:
      "A câmera do celular vira coletor, a contagem sai organizada por setor e a divergência aparece na hora — enquanto o produto ainda está na gôndola pra conferir.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "O celular do time virando coletor",
        "Contagem organizada por setor",
        "Divergência apontada na hora",
        "Inventário sem parar a loja",
        "Prova de contagem por operador",
      ],
      less: [
        "Coletor alugado por temporada",
        "Contagem no papel e digitação depois",
        "Diferença descoberta no fechamento",
        "Loja fechada para contar",
        "Erro sem saber quem contou",
      ],
    },
    split: {
      title: "O coletor que já está no bolso",
      paragraphs: [
        "A câmera do celular lê o código e a contagem sai organizada por setor.",
        "A divergência aparece enquanto ainda dá para conferir na gôndola — sem loja fechada, sem noite virada, sem aluguel de equipamento.",
      ],
    },
    contactTitle: "Pronto para inventariar sem sofrer?",
  },
  "catalogo-promocional": {
    heroTitle: "Catálogo Promocional: encarte que nasce do próprio cadastro",
    heroText:
      "Chega de designer toda semana. Aqui o encarte sai do estoque, o preço é por loja e a correção vale pra todo mundo no mesmo minuto — no papel e no link.",
    heroPrimaryLabel: "Montar meu próximo encarte",
    heroSecondaryLabel: "Ver exemplos",
    statementTitle: "O encarte que se corrige em minutos, não em semanas.",
    statementText:
      "A lista de produtos sai do próprio cadastro, o preço é por loja e o link é público. A correção de um preço errado vale para todos ao mesmo tempo — no impresso é o próximo lote; no digital, agora mesmo.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Encarte montado do próprio cadastro",
        "Preço por loja",
        "Link público para mandar ao cliente",
        "Alteração que sai no mesmo dia",
        "Modelo salvo para reaproveitar",
      ],
      less: [
        "Encarte no designer toda semana",
        "Preço errado já impresso",
        "PDF pesado circulando no WhatsApp",
        "Promoção que muda e ninguém atualiza",
        "Palavra do vendedor contra o preço do encarte",
      ],
    },
    split: {
      title: "O encarte que nasce do cadastro",
      paragraphs: [
        "A lista de produtos sai do próprio estoque, o preço é por loja e o link é público.",
        "A correção de um preço vale para todo mundo na hora. E o modelo do encarte fica salvo — a próxima campanha começa de onde a anterior terminou.",
      ],
    },
    contactTitle: "Quer publicar seu próximo encarte hoje?",
  },
  "qr-preco": {
    heroTitle: "QR Preço: o preço na mão de quem está na gôndola",
    heroText:
      "Terminal de consulta gera fila, etiqueta borrada gera dúvida. Aqui o cliente aponta o celular e vê o preço — sem baixar app, sem entregar dado pessoal.",
    heroPrimaryLabel: "Ativar QR na minha loja",
    heroSecondaryLabel: "Ver na prática",
    statementTitle: "Consulta de preço sem fila, curiosidade que vira dado.",
    statementText:
      "O cliente escaneia e vê o preço na hora. A loja vê qual produto despertou interesse — sem rastrear a pessoa. Preço, interesse e movimento na mesma tela do gestor.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Cliente vendo o preço na hora",
        "Loja vendo o que despertou interesse",
        "Leitura sem instalar nada",
        "Medição sem rastrear pessoa",
        "Terminal caro substituído por QR",
      ],
      less: [
        "Fila no terminal de consulta",
        "Produto com etiqueta ilegível",
        "Palpite sobre o que o cliente olhou",
        "Coleta de dado pessoal sem necessidade",
        "Manutenção de terminal antigo quebrando",
      ],
    },
    split: {
      title: "O preço na mão de quem está na gôndola",
      paragraphs: [
        "O cliente escaneia e vê o preço.",
        "A loja vê a jornada de interesse por produto — sem rastrear quem escaneou. Privacidade preservada, decisão de sortimento informada.",
      ],
    },
    contactTitle: "Pronto pra acabar com a fila do terminal?",
  },
  "catalogo-online": {
    heroTitle: "Catálogo Online: vitrine que fala com o balcão",
    heroText:
      "Marketplace fica com a margem, cardápio em PDF esconde produto. Aqui a vitrine é sua, no seu endereço, com o mesmo produto do PDV — e cada pedido cai no CRM.",
    heroPrimaryLabel: "Abrir minha vitrine",
    heroSecondaryLabel: "Como conecta",
    statementTitle: "Sua vitrine, sua marca, sem intermediário levando margem.",
    statementText:
      "Endereço próprio, carrinho que vira pedido, o mesmo cadastro de produto e cliente que o balcão usa. Pedido feito online é venda que o comercial enxerga — sem taxa, sem re-digitação.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Vitrine no endereço da própria loja",
        "Carrinho que vira pedido",
        "O mesmo produto do PDV",
        "O mesmo cliente do CRM",
        "Pagamento com gateway da própria conta",
      ],
      less: [
        "Cardápio em PDF sem preço atualizado",
        "Pedido anotado na conversa",
        "Cadastro de produto em dois lugares",
        "Cliente novo a cada compra",
        "Marketplace levando parte do lucro",
      ],
    },
    split: {
      title: "A vitrine ligada ao caixa",
      paragraphs: [
        "A loja na internet com endereço próprio, do carrinho ao pedido.",
        "Sobre o mesmo cadastro de produto e de cliente que o balcão usa. Vender pela web é a mesma venda que sai pelo caixa — o gestor vê tudo no mesmo painel.",
      ],
    },
    contactTitle: "Quer sua vitrine no ar hoje?",
  },
  planograma: {
    heroTitle: "Planograma: o planejado, ao lado do que foi feito",
    heroText:
      "Enquanto montagem de gôndola é feita no olho, aqui a arte é desenhada, a foto do campo entra ao lado e o share de espaço sai medido — sem discussão, sem memória.",
    heroPrimaryLabel: "Desenhar minha gôndola",
    heroSecondaryLabel: "Como se compara",
    statementTitle: "O combinado ao lado do executado.",
    statementText:
      "A gôndola é desenhada com precisão de milímetros. A foto do PDV entra ao lado, sobreposta ao planejado. O share de cada marca sai medido — com revisões guardadas para provar a evolução.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Gôndola desenhada antes de montar",
        "Planejado e executado lado a lado",
        "Share de espaço medido, não estimado",
        "Revisão guardada para comparar no tempo",
        "Prova visual pra negociar com indústria",
      ],
      less: [
        "Montagem feita no olho",
        "Conferência por memória",
        "Discussão sobre quanto espaço cada marca teve",
        "Versão antiga sem registro",
        "Verba de trade sem prova de execução",
      ],
    },
    split: {
      title: "O planejado, ao lado do que foi feito",
      paragraphs: [
        "A gôndola é desenhada, a foto do campo entra ao lado e o share de espaço sai medido.",
        "As revisões ficam guardadas — dá pra provar como a gôndola evoluiu, e com quanto espaço cada marca ficou de fato.",
      ],
    },
    contactTitle: "Quer a próxima negociação com prova na mão?",
  },
  book: {
    heroTitle: "Book: a prova que libera a verba",
    heroText:
      "Montar apresentação foto a foto no PowerPoint é o que trava verba de trade. Aqui, a foto do campo vira página automaticamente — com data, lugar e produto identificado.",
    heroPrimaryLabel: "Montar meu primeiro book",
    heroSecondaryLabel: "Ver o modelo",
    statementTitle: "O book que a indústria pede, pronto no mesmo dia.",
    statementText:
      "Cada foto de execução vira página organizada, no formato que a indústria pede. Data, lugar e produto em cada registro — a verba deixa de esperar comprovação.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Foto do campo virando página",
        "Book montado sozinho, por rota",
        "Entrega no formato que a indústria pede",
        "Prova de execução com data e GPS",
        "Verba destravada pelo próprio sistema",
      ],
      less: [
        "Montar apresentação foto a foto",
        "Verba travada por falta de comprovação",
        "Arquivo gigante indo por e-mail",
        "Foto sem contexto nenhum",
        "Assistente perdendo o dia montando slide",
      ],
    },
    split: {
      title: "A prova que libera a verba",
      paragraphs: [
        "As fotos de execução viram páginas montadas e um book pronto para entregar à indústria.",
        "Com data e lugar em cada registro. O que era dor de assistente vira entrega do dia — e verba que rola sem cobrança.",
      ],
    },
    contactTitle: "Quer o próximo book pronto sem sofrer?",
  },
  trafego: {
    heroTitle: "TrafeGO: do anúncio ao que ele fechou, sem planilha",
    heroText:
      "Enquanto agências entregam CPL e somem, o TrafeGO liga cada real gasto a cada real vendido. Você vê qual anúncio gerou o lead que virou cliente — sem planilha, sem palpite.",
    heroPrimaryLabel: "Ligar meu tráfego ao funil",
    heroSecondaryLabel: "Ver o ROI",
    statementTitle:
      "Verba de tráfego que responde por resultado, não por vaidade.",
    statementText:
      "O cliente chega pelo anúncio, entra no funil e o card fecha na loja. Os dois lados no mesmo lugar. Você para de discutir CTR e passa a discutir CAC real.",
    statementCta: "Falar com nosso time",
    compare: {
      more: [
        "Campanha ligada ao funil",
        "Lead do anúncio entrando no CRM",
        "Venda da loja ligada ao anúncio de origem",
        "Verba acompanhada em tempo real",
        "CAC real, não estimado",
      ],
      less: [
        "Anúncio que gera lead e some",
        "Planilha para juntar anúncio e venda",
        "Verba sem retorno visível",
        "Relatório que chega tarde demais",
        "Agência mostrando CTR em vez de faturamento",
      ],
    },
    split: {
      title: "Do anúncio ao que ele fechou",
      paragraphs: [
        "O cliente chega pelo anúncio e avança no funil.",
        "A loja abre e vende — os dois lados no mesmo lugar. Você sabe qual campanha pagou pela venda que entrou hoje.",
      ],
    },
    contactTitle: "Pronto pra descobrir seu CAC de verdade?",
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
      text: copy.heroText ?? tool.summary,
      primary: {
        label: copy.heroPrimaryLabel ?? "Agendar uma demonstração",
        href: options.whatsappHref,
      },
      secondary: {
        label: copy.heroSecondaryLabel ?? "Ver funcionalidades",
        href: "#funcionalidades",
      },
      image: { key: "", alt: "" },
    },
    {
      id: "statement",
      type: "statement",
      enabled: true,
      title: copy.statementTitle ?? tool.tagline,
      text: copy.statementText ?? tool.summary,
      cta: {
        label: copy.statementCta ?? "Falar com um especialista",
        href: options.whatsappHref,
      },
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
      title: copy.contactTitle ?? "Vamos impulsionar a gestão do seu negócio?",
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
