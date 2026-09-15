import type { Jornada } from "./tipos";

/**
 * O Financeiro tem dez abas, e é isso que assusta quem abre a tela pela
 * primeira vez. A jornada resolve o susto ensinando UMA coisa: lançar uma
 * conta. O resto das abas se explica depois que a primeira faz sentido.
 */
export const JORNADA_FINANCEIRO: Jornada = {
  id: "financeiro-lancamentos",
  modulo: "financeiro",
  titulo: "Lance a sua primeira conta",
  descricao:
    "Como o Financeiro se organiza, onde ver o que vence hoje e como registrar uma conta a pagar ou a receber.",
  rota: "/financeiro",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "ler",
      alvo: "financeiro-abas",
      titulo: "Dez abas, uma ideia",
      texto:
        "Tudo aqui gira em torno de Lançamentos: cada conta a pagar ou a receber é um lançamento. As outras abas só olham para eles de ângulos diferentes.",
    },
    {
      tipo: "clicar",
      alvo: "financeiro-aba-lancamentos",
      titulo: "Comece por Lançamentos",
      texto: 'Clique em "Lançamentos" para ver a lista das suas contas.',
    },
    {
      tipo: "ler",
      alvo: "financeiro-periodo",
      // Só aparece nas abas que têm período — entre elas, a de lançamentos.
      opcional: true,
      titulo: "O período manda na tela",
      texto:
        "Este filtro vale para a aba inteira. Trocar o mês aqui muda a lista, o fluxo de caixa e os relatórios.",
    },
    {
      tipo: "digitar",
      alvo: "financeiro-busca",
      titulo: "Ache pela descrição",
      texto:
        'Digite parte da descrição. É por isso que vale escrever "Aluguel loja centro" em vez de só "aluguel".',
    },
    {
      tipo: "clicar",
      alvo: "financeiro-novo-lancamento",
      titulo: "Registre uma conta",
      texto: 'Clique em "Novo lançamento" para cadastrar uma conta de verdade.',
    },
    {
      tipo: "ler",
      alvo: "financeiro-form-lancamento",
      titulo: "Pagar ou receber",
      texto:
        "Escolha o tipo, o valor e o vencimento. A categoria e o centro de custo são o que transformam esta lista num relatório útil depois. Pode fechar a janela.",
    },
  ],
};
