import type { Jornada } from "./tipos";

/**
 * A lista de vendas. Curta de propósito: quem chega aqui já vendeu alguma
 * coisa, e o que falta saber é onde conferir e como cancelar direito.
 */
export const JORNADA_VENDAS: Jornada = {
  id: "vendas-consultar",
  modulo: "vendas",
  titulo: "Confira as vendas do dia",
  descricao:
    "Onde ver tudo o que foi vendido, como achar uma venda específica e o que fazer quando ela sai errada.",
  rota: "/vendas",
  starsSugeridas: 5,
  passos: [
    {
      tipo: "ler",
      alvo: "vendas-tabela",
      titulo: "Toda venda passa por aqui",
      texto:
        "Cada linha é uma venda, com número, cliente, forma de pagamento e valor. É a lista que você confere no fim do dia contra o caixa.",
    },
    {
      tipo: "ler",
      alvo: "vendas-abas",
      titulo: "Separe pelo estado",
      texto:
        "As abas separam o que foi concluído, o que está em andamento e o que foi cancelado. Venda cancelada não some — ela fica marcada, com quem cancelou.",
    },
    {
      tipo: "digitar",
      alvo: "vendas-busca",
      titulo: "Ache uma venda",
      texto:
        "Busque pelo número do cupom ou pelo nome do cliente. É o caminho de quando alguém volta na loja com uma dúvida sobre a compra.",
    },
    {
      tipo: "ler",
      alvo: "vendas-frente-de-caixa",
      titulo: "E para vender de novo",
      texto:
        '"Frente de caixa" volta para o PDV. No movimento, o atalho de teclado leva você direto, sem passar por esta tela.',
    },
  ],
};

/**
 * O caixa. A jornada tem de funcionar nos DOIS estados — aberto e fechado —, e
 * numa empresa nova ele está sempre fechado e sem nenhum caixa cadastrado. Por
 * isso quase tudo aqui é opcional, menos o que existe sempre.
 */
export const JORNADA_CAIXA: Jornada = {
  id: "caixa-abertura",
  modulo: "caixa",
  titulo: "Abra e feche o caixa",
  descricao:
    "O ciclo do dia: abrir com o troco, registrar sangria e suprimento, e fechar conferindo o que tem na gaveta.",
  rota: "/vendas/caixa",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "ler",
      alvo: "caixa-status",
      titulo: "Aberto ou fechado",
      texto:
        "Este é o estado do caixa agora. Com o caixa fechado, o PDV registra a venda mas não tem onde lançar o dinheiro — por isso o dia começa aqui.",
    },
    {
      tipo: "ler",
      alvo: "caixa-gerenciar",
      // Só para quem administra a empresa.
      opcional: true,
      titulo: "Primeiro, cadastre o caixa",
      texto:
        '"Gerenciar caixas" é onde você cadastra cada gaveta da loja. Sem pelo menos um caixa cadastrado, não há o que abrir.',
    },
    {
      tipo: "ler",
      alvo: "caixa-abrir",
      // Some quando o caixa já está aberto.
      opcional: true,
      titulo: "Abrir é declarar o troco",
      texto:
        "Ao abrir você informa quanto tem de dinheiro na gaveta. É contra esse valor que o fechamento vai conferir no fim do dia.",
    },
    {
      tipo: "ler",
      alvo: "caixa-sangria",
      // Só existe com o caixa aberto.
      opcional: true,
      titulo: "Sangria tira dinheiro da gaveta",
      texto:
        "Levou dinheiro ao banco ou pagou um fornecedor com o caixa? Registre a sangria, senão o fechamento vai acusar falta.",
    },
    {
      tipo: "ler",
      alvo: "caixa-suprimento",
      opcional: true,
      titulo: "Suprimento põe dinheiro",
      texto:
        "É o contrário: troco que entrou no meio do dia. Sem registrar, o fechamento acusa sobra.",
    },
    {
      tipo: "ler",
      alvo: "caixa-fechar",
      opcional: true,
      titulo: "Fechar é contar e comparar",
      texto:
        "No fechamento você conta a gaveta e informa o valor. O sistema mostra a diferença entre o esperado e o contado, e ela fica registrada.",
    },
  ],
};

/**
 * Colaboradores é a tela que resolve a pergunta mais comum de quem monta a
 * equipe: a diferença entre colaborador e membro do sistema.
 */
export const JORNADA_COLABORADORES: Jornada = {
  id: "colaboradores-equipe",
  modulo: "colaboradores",
  titulo: "Monte a sua equipe",
  descricao:
    "Quem é colaborador, o que ele tem a ver com o vendedor da venda e onde convidar alguém para usar o sistema.",
  rota: "/colaboradores",
  starsSugeridas: 5,
  passos: [
    {
      tipo: "ler",
      alvo: "colaboradores-lista",
      titulo: "Quem trabalha com você",
      texto:
        "Colaborador é a pessoa da equipe: o vendedor que aparece na venda, o promotor que registra foto, o nome que entra no ranking.",
    },
    {
      tipo: "clicar",
      alvo: "colaboradores-novo",
      titulo: "Cadastre alguém",
      texto:
        'Clique em "Novo colaborador". Repare que aqui você cadastra a PESSOA — dar a ela acesso ao sistema é outro passo, em Configurações.',
    },
  ],
};

/**
 * Configurações. A jornada ensina a divisão entre convidar, permitir e
 * esconder — as três camadas que o suporte mais precisa desembaralhar.
 */
export const JORNADA_CONFIGURACOES: Jornada = {
  id: "configuracoes-acesso",
  modulo: "configuracoes",
  titulo: "Dê acesso a quem trabalha com você",
  descricao:
    "Convidar alguém para o sistema, escolher o que cada um enxerga e esconder do menu o que a sua empresa não usa.",
  rota: "/configuracoes",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "ler",
      alvo: "config-abas",
      titulo: "Três coisas diferentes",
      texto:
        "Convites é quem entra. Permissões é o que cada um pode. Módulos é o que aparece no menu. Confundir as três é a origem da maioria das dúvidas aqui.",
    },
    {
      tipo: "clicar",
      alvo: "config-aba-convites",
      titulo: "Comece pelo convite",
      texto: 'Clique em "Convites" para trazer alguém para dentro do sistema.',
    },
    {
      tipo: "ler",
      alvo: "config-convidar",
      opcional: true,
      titulo: "Convite por e-mail",
      texto:
        '"Convidar membro" manda um e-mail com o link de entrada. Também existe o link de entrada, que serve para quem prefere mandar pelo WhatsApp.',
    },
    {
      tipo: "clicar",
      alvo: "config-aba-permissoes",
      titulo: "Agora o que cada um pode",
      texto:
        'Clique em "Permissões". É tela por tela: você marca o que aquela pessoa abre. Dono e administrador passam por tudo.',
    },
    {
      tipo: "clicar",
      alvo: "config-aba-modulos",
      titulo: "E o que some do menu",
      texto:
        'Clique em "Módulos". Aqui você esconde o que a sua empresa não usa. Atenção: esconder é arrumação, não segurança — quem tem permissão continua entrando pelo endereço.',
    },
  ],
};
