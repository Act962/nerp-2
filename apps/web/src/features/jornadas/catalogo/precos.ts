import type { Jornada } from "./tipos";

/**
 * Tabela de preço é o recurso que quase ninguém descobre sozinho, e é
 * exatamente o que resolve "o atacado paga diferente". A jornada existe mais
 * para revelar a ferramenta do que para ensinar a clicar nela.
 */
export const JORNADA_PRECOS: Jornada = {
  id: "precos-tabelas",
  modulo: "precos",
  titulo: "Cobre preços diferentes por cliente",
  descricao:
    "Como criar uma tabela de atacado ou de revenda e fazer o PDV cobrar o preço certo de cada cliente.",
  rota: "/precos",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "ler",
      alvo: "precos-tabelas",
      titulo: "Cada tabela é um tipo de cliente",
      texto:
        "Varejo é o preço do balcão. Atacado e Revendedor são outros preços para os mesmos produtos. O cliente cadastrado na tabela paga o preço dela no PDV.",
    },
    {
      tipo: "ler",
      alvo: "precos-nova-tabela",
      titulo: "Crie a sua própria",
      texto:
        '"Nova tabela" serve para o que o seu negócio tem de diferente: preço de funcionário, de convênio, de feira.',
    },
    {
      tipo: "clicar",
      alvo: "precos-adicionar-faixa",
      // A coluna da direita só existe com uma tabela selecionada.
      opcional: true,
      titulo: "Ponha um produto na tabela",
      texto:
        'Clique em "Adicionar faixa". Você escolhe o produto e diz o preço — ou o desconto em porcentagem sobre o preço de balcão.',
    },
    {
      tipo: "ler",
      alvo: "precos-opcoes",
      opcional: true,
      titulo: "Ligar, desligar e definir a padrão",
      texto:
        'Em "Opções" você ativa a tabela, define qual é a padrão da loja ou apaga a que não usa mais.',
    },
  ],
};
