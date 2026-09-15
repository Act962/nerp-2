import type { Jornada } from "./tipos";

/**
 * O dashboard é a primeira tela de quem entra, e a que mais gera "onde eu vejo
 * isso?" no suporte. A jornada mostra que ela é MONTÁVEL — o resto do sistema
 * só faz sentido depois que a pessoa entende que este painel é dela.
 */
export const JORNADA_DASHBOARD: Jornada = {
  id: "dashboard-visao-geral",
  modulo: "dashboard",
  titulo: "Conheça o seu painel",
  descricao:
    "Onde ficam os números do dia, como trocar entre o seu painel e o da empresa, e como escolher os indicadores que você quer ver.",
  rota: "/dashboard",
  starsSugeridas: 5,
  passos: [
    {
      tipo: "ler",
      alvo: "dashboard-cabecalho",
      titulo: "Este é o seu painel",
      texto:
        "Tudo o que a sua operação fez hoje aparece aqui: vendas, caixa, estoque e alertas. Ele é seu — cada pessoa da empresa monta o próprio.",
    },
    {
      tipo: "ler",
      alvo: "dashboard-atalhos",
      // Some quando ninguém escolheu atalho ainda — que é o caso de toda
      // empresa nova, justamente quem faz a jornada.
      opcional: true,
      titulo: "Atalhos para o dia a dia",
      texto:
        "Estes botões levam direto às telas que você mais usa. Você escolhe quais aparecem em Configurações, então o caminho mais curto é sempre o seu.",
    },
    {
      tipo: "clicar",
      alvo: "dashboard-aba-org",
      // A aba só existe quando a gestão publicou algum indicador — não é o
      // caso de uma empresa recém-criada, que é quem faz a jornada.
      opcional: true,
      titulo: "O painel da empresa",
      texto:
        'Além do seu painel existe o da organização, montado pela gestão e igual para todo mundo. Clique em "Da organização" para ver.',
    },
    {
      tipo: "clicar",
      alvo: "dashboard-adicionar-widget",
      titulo: "Escolha o que você quer ver",
      texto:
        'Faltou um número na tela? Clique em "Adicionar widget" — é assim que você põe no painel exatamente os indicadores que interessam a você.',
    },
    {
      tipo: "ler",
      alvo: "dashboard-seletor-widgets",
      titulo: "A prateleira de indicadores",
      texto:
        "Cada item aqui é um bloco pronto: faturamento, ticket médio, produtos sem estoque, contas a vencer. Clique para adicionar, arraste no painel para reordenar.",
    },
  ],
};
