import type { Jornada } from "./tipos";

/**
 * O painel de pedidos é o que a cozinha olha o dia inteiro. A jornada ensina o
 * caminho completo — como o pedido entra, como ele anda e onde a cozinha vê —
 * porque o erro comum é montar as colunas e nunca abrir o painel da TV.
 */
export const JORNADA_PEDIDOS: Jornada = {
  id: "pedidos-fluxo",
  modulo: "pedidos",
  titulo: "Organize a fila da cozinha",
  descricao:
    "Como o pedido entra, como ele anda entre as colunas e como pôr a fila numa TV para a cozinha acompanhar.",
  rota: "/pedidos",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "clicar",
      alvo: "pedidos-aba-cozinha",
      titulo: "A fila da cozinha tem aba própria",
      texto:
        'O /pedidos abre nos pedidos do Catálogo Online. Clique em "Cozinha" para ver o quadro que a cozinha usa.',
    },
    {
      tipo: "ler",
      alvo: "pedidos-quadro",
      titulo: "O pedido anda da esquerda para a direita",
      texto:
        "Cada coluna é uma etapa: chegou, está sendo feito, está pronto. Arraste o cartão para mover o pedido — quem está na cozinha vê a mudança na hora.",
    },
    {
      tipo: "clicar",
      alvo: "pedidos-novo",
      titulo: "Registre um pedido",
      texto:
        'Clique em "Novo pedido". Serve para o pedido que chega por telefone ou no balcão, quando não veio pelo aplicativo do garçom.',
    },
    {
      tipo: "ler",
      alvo: "pedidos-form",
      titulo: "Mesa, garçom e os pratos",
      texto:
        "Informe a mesa, quem atendeu e os itens. Dentro desta janela também está o link do aplicativo do garçom, que é como o pedido entra sozinho. Pode fechar.",
    },
    {
      tipo: "digitar",
      alvo: "pedidos-busca",
      titulo: "Ache no meio do movimento",
      texto:
        "No pico, a busca por mesa ou por prato é mais rápida que procurar o cartão com o olho.",
    },
    {
      tipo: "clicar",
      alvo: "pedidos-gerenciar",
      titulo: "As colunas são suas",
      texto:
        'Clique em "Gerenciar" para renomear, acrescentar ou arquivar colunas. O fluxo tem que ser o da sua cozinha, não o que veio de fábrica.',
    },
    {
      tipo: "ler",
      alvo: "pedidos-painel-tv",
      titulo: "A tela da cozinha",
      texto:
        '"Abrir painel da TV" gera uma tela limpa, feita para ficar pendurada na cozinha. Ela atualiza sozinha e não precisa de login.',
    },
  ],
};
