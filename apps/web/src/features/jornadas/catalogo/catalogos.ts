import type { Jornada } from "./tipos";

/**
 * O catálogo promocional é a ferramenta que mais gera "como eu faço?" no
 * suporte, porque o editor é grande. A jornada para na porta do editor de
 * propósito: ensinar a criar e abrir já resolve a dúvida de entrada, e o
 * editor tem jornada própria pela frente.
 */
export const JORNADA_CATALOGO_PROMOCIONAL: Jornada = {
  id: "catalogo-promocional-criar",
  modulo: "catalogo-promocional",
  titulo: "Monte um encarte de ofertas",
  descricao:
    "Criar o catálogo da semana, abrir o editor e mandar o encarte pronto para o cliente no WhatsApp.",
  rota: "/catalogo-promocional",
  starsSugeridas: 10,
  passos: [
    {
      tipo: "clicar",
      alvo: "catalogo-promocional-novo",
      titulo: "Comece um encarte",
      texto:
        'Clique em "Novo Catálogo". Um catálogo é o encarte de uma semana, uma data ou uma campanha.',
    },
    {
      tipo: "ler",
      alvo: "catalogo-promocional-form",
      titulo: "Dê um nome que você reconheça depois",
      texto:
        '"Ofertas da semana" vira dez catálogos iguais em dois meses. "Ofertas 12 a 18 de maio" você acha de primeira. Pode fechar a janela.',
    },
    {
      tipo: "ler",
      alvo: "catalogo-promocional-editar",
      // Só existe quando há pelo menos um catálogo na lista.
      opcional: true,
      titulo: "O editor é onde o encarte nasce",
      texto:
        '"Editar" abre a tela de montagem: você arrasta produtos, escolhe o padrão de preço e monta as páginas. O sistema salva sozinho enquanto você trabalha.',
    },
  ],
};

/**
 * A loja online. A jornada evita prometer o que a empresa de teste não tem: o
 * endereço público só existe depois de a conta ser vinculada, e por isso o
 * passo do link é opcional.
 */
export const JORNADA_CATALOGO_ONLINE: Jornada = {
  id: "catalogo-online-configurar",
  modulo: "catalogo",
  titulo: "Abra a sua loja online",
  descricao:
    "O que o cliente vê, como ligar e desligar a loja e onde fica o endereço que você divulga.",
  rota: "/catalogo",
  starsSugeridas: 5,
  passos: [
    {
      tipo: "ler",
      alvo: "catalogo-abas",
      titulo: "A loja se monta por partes",
      texto:
        "Cada aba cuida de um pedaço: a aparência, as formas de pagamento, a entrega e o endereço na internet. Você mexe em uma por vez.",
    },
    {
      tipo: "ler",
      alvo: "catalogo-ativo",
      // O interruptor mora na aba Visibilidade, que não é a que abre por
      // padrão: sem isto o motor procura um alvo que ainda não foi montado.
      abrirAntes: "catalogo-aba-visibilidade",
      titulo: "O interruptor da loja",
      texto:
        "Enquanto este botão estiver desligado, ninguém de fora vê a loja. É assim que você monta com calma antes de divulgar.",
    },
    {
      tipo: "ler",
      alvo: "catalogo-salvar",
      titulo: "Salvar vale para a aba inteira",
      texto:
        'Mexeu em qualquer aba, clique em "Salvar". A loja no ar muda na hora.',
    },
  ],
};
