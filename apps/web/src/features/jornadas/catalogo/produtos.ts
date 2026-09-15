import type { Jornada } from "./tipos";

/**
 * Cadastrar produto é o primeiro trabalho de verdade de qualquer empresa nova,
 * e o que mais volta como chamado ("meu produto não aparece no PDV"). A jornada
 * vai até o fim — cadastra um produto real — porque cadastro pela metade é
 * justamente o que gera o chamado.
 */
export const JORNADA_PRODUTOS: Jornada = {
  id: "produtos-cadastro",
  modulo: "produtos",
  titulo: "Cadastre o seu primeiro produto",
  descricao:
    "Buscar no catálogo, cadastrar um produto do começo ao fim e organizar tudo em categorias.",
  rota: "/produtos",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "digitar",
      alvo: "produtos-busca",
      titulo: "Ache qualquer produto",
      texto:
        "A busca aceita nome, SKU e código de barras — o mesmo código que o leitor do caixa manda. Digite qualquer coisa para experimentar.",
    },
    {
      tipo: "ler",
      alvo: "produtos-painel",
      titulo: "O que está faltando",
      texto:
        "Este painel mostra os buracos do catálogo: produto sem foto, sem preço, sem estoque. É a lista de pendências que evita surpresa no caixa.",
    },
    {
      tipo: "clicar",
      alvo: "produtos-novo",
      titulo: "Vamos cadastrar um",
      texto:
        'Clique em "Adicionar Produto". Pode ser um produto de verdade do seu negócio — ele fica salvo ao final.',
    },
    {
      tipo: "digitar",
      alvo: "produto-nome",
      rota: "/produtos/novo",
      titulo: "O nome que aparece no caixa",
      texto:
        "Escreva o nome como o operador vai procurar: marca e tamanho ajudam mais do que a descrição da nota fiscal.",
    },
    {
      tipo: "digitar",
      alvo: "produto-preco-venda",
      rota: "/produtos/novo",
      titulo: "O preço de venda",
      texto:
        "É o preço que vale no PDV e no catálogo. Mais abaixo dá para informar o custo, e o sistema calcula a sua margem sozinho.",
    },
    {
      tipo: "clicar",
      alvo: "produto-salvar",
      rota: "/produtos/novo",
      titulo: "Salve o produto",
      texto:
        'Clique em "Salvar Produto". Se faltar algum campo obrigatório, o formulário avisa em vermelho e você corrige antes de seguir.',
    },
    {
      tipo: "navegar",
      destino: "/produtos",
      titulo: "Pronto, ele já existe",
      texto:
        "Salvou, o sistema volta para a lista e o produto já está disponível no PDV, no catálogo e no estoque.",
    },
    {
      tipo: "clicar",
      alvo: "sidebar-categorias",
      rota: "/produtos",
      precisaDaSidebar: true,
      abrirAntes: "sidebar-grupo-produtos",
      titulo: "Agora organize",
      texto:
        'Categoria é o que faz o PDV ter atalho por seção e o catálogo ter menu. Clique em "Categorias" no menu lateral.',
    },
    {
      tipo: "ler",
      alvo: "categorias-nova",
      rota: "/produtos/categorias",
      titulo: "Crie as suas seções",
      texto:
        "Crie as categorias do seu negócio (bebidas, limpeza, hortifruti) e depois marque cada produto em uma. É rápido e muda a vida de quem opera o caixa.",
    },
  ],
};
