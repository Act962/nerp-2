import type { Jornada } from "./tipos";

/**
 * Clientes e Fornecedores são duas telas quase gêmeas, mas a jornada é
 * separada de propósito: quem vende no balcão precisa de uma, quem compra
 * precisa da outra, e juntar as duas faria metade do caminho ser irrelevante
 * para cada pessoa.
 */
export const JORNADA_CLIENTES: Jornada = {
  id: "clientes-cadastro",
  modulo: "clientes",
  titulo: "Cadastre os seus clientes",
  descricao:
    "Onde vive a sua carteira, como cadastrar um cliente e como trazer a lista inteira de uma planilha.",
  rota: "/clientes",
  starsSugeridas: 5,
  passos: [
    {
      tipo: "ler",
      alvo: "clientes-tabela",
      titulo: "A sua carteira",
      texto:
        "Todo cliente cadastrado aparece aqui. É esta lista que alimenta a venda no PDV, o crediário e as campanhas de WhatsApp.",
    },
    {
      tipo: "clicar",
      alvo: "clientes-novo",
      titulo: "Cadastre um cliente",
      texto:
        'Clique em "Novo Cliente". No balcão dá para cadastrar na hora da venda, mas quem já tem a carteira ganha tempo fazendo aqui.',
    },
    {
      tipo: "ler",
      alvo: "clientes-form",
      titulo: "O mínimo e o que rende",
      texto:
        "Só o nome é obrigatório. Mas é o telefone que permite mandar a oferta pelo WhatsApp, e o CPF que liga a compra à pessoa. Pode fechar a janela.",
    },
    {
      tipo: "ler",
      alvo: "clientes-importar",
      titulo: "Ou traga todos de uma vez",
      texto:
        '"Importar" recebe uma planilha com a carteira inteira. Vale a pena quando você está saindo de outro sistema.',
    },
  ],
};

export const JORNADA_FORNECEDORES: Jornada = {
  id: "fornecedores-cadastro",
  modulo: "fornecedores",
  titulo: "Cadastre os seus fornecedores",
  descricao:
    "Quem te abastece, como cadastrar e por que o fornecedor certo economiza tempo na entrada de nota.",
  rota: "/fornecedores",
  starsSugeridas: 5,
  passos: [
    {
      tipo: "digitar",
      alvo: "fornecedores-busca",
      titulo: "Busque por nome ou documento",
      texto:
        "A busca aceita nome, CNPJ e e-mail — útil quando a nota chega com a razão social que ninguém usa no dia a dia.",
    },
    {
      tipo: "ler",
      alvo: "fornecedores-tabela",
      titulo: "Quem te abastece",
      texto:
        "Cada fornecedor aqui pode ser escolhido na entrada de nota, e é o que liga a mercadoria a quem vendeu para você.",
    },
    {
      tipo: "clicar",
      alvo: "fornecedores-novo",
      // Some para quem só tem acesso de leitura nesta tela.
      opcional: true,
      titulo: "Cadastre um fornecedor",
      texto: 'Clique em "Novo Fornecedor" para cadastrar quem te abastece.',
    },
    {
      tipo: "ler",
      alvo: "fornecedores-form",
      opcional: true,
      titulo: "O CNPJ faz o trabalho",
      texto:
        "Informe o CNPJ e boa parte do cadastro se preenche sozinha. Pode fechar a janela.",
    },
    {
      tipo: "ler",
      alvo: "fornecedores-importar",
      opcional: true,
      titulo: "Ou traga a lista pronta",
      texto:
        '"Importar" aceita uma planilha com todos os fornecedores de uma vez.',
    },
  ],
};
