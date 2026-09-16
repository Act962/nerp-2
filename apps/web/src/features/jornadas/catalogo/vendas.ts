import type { Jornada } from "./tipos";

/**
 * A venda no PDV. A jornada para no diálogo de pagamento, sem exigir
 * confirmar: fechar venda de mentira sujaria o faturamento da empresa, e o
 * caixa pode nem estar aberto na hora em que a pessoa resolve aprender.
 */
export const JORNADA_PDV: Jornada = {
  id: "pdv-primeira-venda",
  modulo: "vendas",
  titulo: "Faça uma venda no PDV",
  descricao:
    "Buscar o produto, montar o carrinho e chegar até as formas de pagamento — o caminho completo de um atendimento no caixa.",
  rota: "/vendas/novo",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "digitar",
      alvo: "pdv-busca",
      titulo: "Comece pela busca",
      texto:
        "O cursor já nasce aqui, então o leitor de código de barras funciona sem clicar em nada. Digite parte do nome de um produto.",
    },
    {
      tipo: "clicar",
      alvo: "pdv-produto",
      titulo: "Clique no produto",
      texto:
        "Um clique põe o item no carrinho. Produto sem estoque aparece apagado e não deixa vender — é a trava que evita vender o que não existe.",
    },
    {
      tipo: "ler",
      alvo: "pdv-carrinho",
      titulo: "O carrinho",
      texto:
        "Aqui você muda a quantidade, aplica desconto no item e remove o que entrou errado. O total acompanha cada mudança.",
    },
    {
      tipo: "clicar",
      alvo: "pdv-finalizar",
      titulo: "Fechar a venda",
      texto:
        'Com o carrinho pronto, clique em "Finalizar Venda". Repare no atalho de teclado ao lado: no movimento, ele poupa o mouse.',
    },
    {
      tipo: "ler",
      alvo: "pdv-pagamento",
      titulo: "As formas de pagamento",
      texto:
        "Dá para dividir a mesma venda em várias formas, informar o valor recebido e o sistema calcula o troco. Pode fechar esta janela: sua jornada acaba aqui, sem registrar venda de teste.",
    },
  ],
};
