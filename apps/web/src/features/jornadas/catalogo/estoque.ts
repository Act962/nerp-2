import type { Jornada } from "./tipos";

/**
 * Estoque é onde a conta fecha ou não fecha, e é o assunto que mais volta como
 * chamado: "meu saldo está errado". A jornada ensina as duas formas de mexer
 * nele — o ajuste manual e a entrada de nota — porque quem só conhece a
 * primeira acaba lançando nota à mão, item por item.
 *
 * A rota é `/estoque/movimentacoes`: `/estoque` só redireciona.
 */
export const JORNADA_ESTOQUE: Jornada = {
  id: "estoque-movimentacao",
  modulo: "estoque",
  titulo: "Controle o seu estoque",
  descricao:
    "As quatro telas do estoque, como corrigir um saldo à mão e como dar entrada na nota do fornecedor.",
  rota: "/estoque/movimentacoes",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "ler",
      alvo: "estoque-abas",
      titulo: "O estoque tem quatro telas",
      texto:
        "Movimentações é o histórico de tudo que entrou e saiu. Entradas é a nota do fornecedor. Coletor é a contagem no celular, e Inventários guarda o resultado dela.",
    },
    {
      tipo: "digitar",
      alvo: "estoque-busca",
      titulo: "Ache um produto",
      texto:
        "Busque por nome ou SKU para ver a vida daquele item: cada venda, cada ajuste, cada entrada, com data e autor.",
    },
    {
      tipo: "ler",
      alvo: "estoque-tipos",
      titulo: "Entrada, saída e ajuste",
      texto:
        "Venda gera saída sozinha. Entrada vem da nota. Ajuste é quando a contagem não bate — e é o que você deve olhar quando o saldo parecer errado.",
    },
    {
      tipo: "clicar",
      alvo: "estoque-nova-movimentacao",
      titulo: "Corrija um saldo à mão",
      texto:
        'Quebrou, venceu, sumiu: clique em "Nova Movimentação" para acertar o saldo sem esconder o motivo.',
    },
    {
      tipo: "ler",
      alvo: "estoque-form-movimentacao",
      titulo: "O motivo é o que importa",
      texto:
        "Escolha o produto, o tipo e a quantidade. O campo de observação é o que vai explicar esse número para quem olhar o histórico daqui a três meses. Pode fechar a janela.",
    },
    {
      tipo: "clicar",
      alvo: "estoque-aba-entradas",
      titulo: "Agora a nota do fornecedor",
      texto:
        'Clique em "Entradas". É por aqui que a mercadoria comprada entra — e é o caminho certo, não o ajuste manual.',
    },
    {
      tipo: "navegar",
      destino: "/estoque/entradas",
      titulo: "Chegamos",
      texto: "Esta é a lista das notas que você já lançou.",
    },
    {
      tipo: "ler",
      alvo: "estoque-nova-entrada",
      rota: "/estoque/entradas",
      titulo: "Uma nota, vários itens",
      texto:
        '"Nova entrada" abre o lançamento da nota inteira: ela soma o estoque, atualiza o custo, sugere o preço de venda e ainda gera a conta a pagar.',
    },
  ],
};
