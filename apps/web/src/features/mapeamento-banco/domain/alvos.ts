import type { TipoDeDado } from "./estrutura";

// O que o NERP precisa de cada tipo de dado do ERP — o contrato do lado de cá.
//
// O mapeamento só diz DE ONDE vem cada campo; QUAIS campos existem e quais são
// obrigatórios é decisão do NERP e mora aqui. Assim um cliente com tabela
// própria preenche o mesmo formulário que um Winthor padrão, e o sync (próxima
// entrega) lê sempre o mesmo formato, venha de onde vier.

export const TIPOS_DO_NERP = [
  "produto",
  "estoque",
  "categoria",
  "cliente",
  "preco",
  "promocao",
] as const;
export type TipoDoNerp = (typeof TIPOS_DO_NERP)[number];

export type TipoDoCampo = "texto" | "numero" | "data" | "booleano";

/**
 * Conversões aplicadas ao valor da coluna antes de chegar ao NERP. Lista
 * fechada de propósito: cobre o que os ERPs fazem de "estranho" sem abrir
 * espaço para expressão livre (que viraria SQL ou código por configuração).
 *
 * Booleano EXIGE uma das de booleano (o ERP raramente tem coluna sim/não):
 * - `vazioEhVerdadeiro`: Winthor marca produto fora de linha com DATA DE
 *   EXCLUSÃO; sem data = ativo.
 * Texto ACEITA, opcionalmente:
 * - `gtinValido`: só passa código de barras com dígito verificador certo. Há
 *   ERP que repete o código interno no campo do EAN (no Winthor do Armazém,
 *   125 de 200 produtos) — sem isto o NERP gravaria EAN falso.
 * - `somenteDigitos`: tira máscara de CPF/CNPJ/telefone/CEP.
 */
export const CONVERSOES = [
  "vazioEhVerdadeiro",
  "preenchidoEhVerdadeiro",
  "simEhVerdadeiro",
  "gtinValido",
  "somenteDigitos",
] as const;
export type Conversao = (typeof CONVERSOES)[number];

export const ROTULO_DA_CONVERSAO: Record<Conversao, string> = {
  vazioEhVerdadeiro: "Vazio = sim",
  preenchidoEhVerdadeiro: "Preenchido = sim",
  simEhVerdadeiro: "S / SIM / 1 = sim",
  gtinValido: "Só código de barras válido",
  somenteDigitos: "Só dígitos (tira a máscara)",
};

export const CONVERSOES_POR_TIPO: Record<TipoDoCampo, readonly Conversao[]> = {
  booleano: ["vazioEhVerdadeiro", "preenchidoEhVerdadeiro", "simEhVerdadeiro"],
  texto: ["gtinValido", "somenteDigitos"],
  numero: [],
  data: [],
};

export interface CampoDoAlvo {
  chave: string;
  rotulo: string;
  descricao: string;
  tipo: TipoDoCampo;
  obrigatorio: boolean;
}

export interface Alvo {
  tipo: TipoDoNerp;
  rotulo: string;
  descricao: string;
  campos: CampoDoAlvo[];
  /**
   * Quando a origem tem várias linhas por item (preço vindo do histórico de
   * vendas: uma por pedido), fica só a mais recente de cada partição. Só se
   * aplica se o campo de ordem estiver mapeado.
   */
  ultimoPor?: { particao: string[]; ordem: string };
  /**
   * Campos que identificam UMA linha do tipo no ERP. É por eles que a leitura
   * completa pagina (sem OFFSET, que relê tudo a cada página) e que a
   * importação casa o que veio com o que já existe.
   */
  chave: string[];
}

const campo = (
  chave: string,
  rotulo: string,
  tipo: TipoDoCampo,
  obrigatorio: boolean,
  descricao: string,
): CampoDoAlvo => ({ chave, rotulo, tipo, obrigatorio, descricao });

export const ALVOS: Record<TipoDoNerp, Alvo> = {
  produto: {
    tipo: "produto",
    chave: ["codigo"],
    rotulo: "Produto",
    descricao: "Cadastro de produtos: código no ERP, nome, código de barras.",
    campos: [
      campo("codigo", "Código", "texto", true, "Código do produto no ERP."),
      campo("nome", "Nome", "texto", true, "Descrição do produto."),
      campo(
        "ean",
        "Código de barras",
        "texto",
        false,
        "EAN/GTIN da unidade. Use a conversão 'só código de barras válido'.",
      ),
      campo("unidade", "Unidade", "texto", false, "UN, KG, CX…"),
      campo(
        "ativo",
        "Ativo",
        "booleano",
        false,
        "Se o produto está em linha. Precisa de uma conversão.",
      ),
      campo(
        "unidadesPorCaixa",
        "Unidades por caixa",
        "numero",
        false,
        "Quantas unidades vêm na embalagem de compra.",
      ),
      campo(
        "codigoCategoria",
        "Código da categoria",
        "texto",
        false,
        "Liga o produto à categoria mapeada.",
      ),
    ],
  },
  estoque: {
    tipo: "estoque",
    chave: ["codigoProduto", "filial"],
    rotulo: "Estoque",
    descricao: "Saldo de cada produto por filial.",
    campos: [
      campo(
        "codigoProduto",
        "Código do produto",
        "texto",
        true,
        "O mesmo código mapeado em Produto.",
      ),
      campo("filial", "Filial", "texto", true, "Código da filial."),
      campo(
        "quantidade",
        "Quantidade",
        "numero",
        true,
        "Saldo total (gerencial) da filial.",
      ),
      campo(
        "reservada",
        "Reservada",
        "numero",
        false,
        "Já comprometida em pedido. Disponível = quantidade − reservada − bloqueada.",
      ),
      campo(
        "bloqueada",
        "Bloqueada",
        "numero",
        false,
        "Fora de venda (avaria, quarentena). Sai do disponível.",
      ),
      campo("nomeFilial", "Nome da filial", "texto", false, "Para exibir."),
    ],
  },
  categoria: {
    tipo: "categoria",
    chave: ["codigo"],
    rotulo: "Categoria",
    descricao:
      "Árvore de categorias. Um nível por linha, com o pai opcional (ex.: seção dentro de departamento).",
    campos: [
      campo("codigo", "Código", "texto", true, "Código da categoria."),
      campo("nome", "Nome", "texto", true, "Nome da categoria."),
      campo(
        "codigoPai",
        "Código do pai",
        "texto",
        false,
        "Categoria de cima (ex.: departamento).",
      ),
      campo(
        "nomePai",
        "Nome do pai",
        "texto",
        false,
        "Nome da categoria de cima, quando vem por junção.",
      ),
    ],
  },
  cliente: {
    tipo: "cliente",
    chave: ["codigo"],
    rotulo: "Cliente",
    descricao:
      "Cadastro de clientes: código no ERP, razão social, documento e contato.",
    campos: [
      campo("codigo", "Código", "texto", true, "Código do cliente no ERP."),
      campo("nome", "Razão social / nome", "texto", true, "Nome do cliente."),
      campo("fantasia", "Nome fantasia", "texto", false, "Nome comercial."),
      campo(
        "documento",
        "CPF/CNPJ",
        "texto",
        false,
        "Documento, com ou sem máscara.",
      ),
      campo("telefone", "Telefone", "texto", false, "Telefone principal."),
      campo("celular", "Celular", "texto", false, "Celular / WhatsApp."),
      campo("email", "E-mail", "texto", false, "E-mail de contato."),
      campo(
        "cidade",
        "Cidade",
        "texto",
        false,
        "Cidade do endereço principal.",
      ),
      campo("uf", "UF", "texto", false, "Estado."),
      campo(
        "ativo",
        "Ativo",
        "booleano",
        false,
        "Se o cliente está ativo (não excluído). Precisa de uma conversão.",
      ),
      campo(
        "bloqueado",
        "Bloqueado para venda",
        "booleano",
        false,
        "Bloqueio de crédito/cadastro — diferente de inativo. Precisa de uma conversão.",
      ),
      campo(
        "vendedor",
        "Código do vendedor",
        "texto",
        false,
        "Vendedor/RCA responsável pela carteira.",
      ),
    ],
  },
  preco: {
    tipo: "preco",
    chave: ["codigoProduto", "regiao"],
    rotulo: "Preço",
    descricao:
      "Preço de venda vigente por região ou tabela de preço. Pode vir de uma tabela de preço ou do histórico de vendas.",
    campos: [
      campo(
        "codigoProduto",
        "Código do produto",
        "texto",
        true,
        "O mesmo código mapeado em Produto.",
      ),
      campo("preco", "Preço", "numero", true, "Preço de venda unitário."),
      campo(
        "regiao",
        "Região / tabela",
        "texto",
        true,
        "Região ou tabela de preço à qual o preço pertence.",
      ),
      campo(
        "data",
        "Data",
        "data",
        false,
        "Quando a origem tem histórico, fica o preço mais recente.",
      ),
    ],
    ultimoPor: { particao: ["codigoProduto", "regiao"], ordem: "data" },
  },
  promocao: {
    tipo: "promocao",
    chave: ["codigoProduto", "regiao"],
    rotulo: "Promoção",
    descricao: "Preço promocional com vigência.",
    campos: [
      campo(
        "codigoProduto",
        "Código do produto",
        "texto",
        true,
        "O mesmo código mapeado em Produto.",
      ),
      campo(
        "precoPromocional",
        "Preço promocional",
        "numero",
        true,
        "Preço durante a promoção.",
      ),
      campo("inicio", "Início", "data", false, "Começo da vigência."),
      campo("fim", "Fim", "data", false, "Fim da vigência."),
      campo("regiao", "Região / tabela", "texto", false, "Onde vale."),
    ],
  },
};

export type Compatibilidade = "ok" | "aviso" | "erro";

/**
 * Uma coluna deste tipo serve para um campo daquele tipo? `aviso` é "dá, mas a
 * conversão pode falhar linha a linha" — o Testar mostra onde.
 */
export function compatibilidade(
  campoTipo: TipoDoCampo,
  colunaTipo: TipoDeDado,
): Compatibilidade {
  if (campoTipo === "booleano") return "ok";
  if (campoTipo === "texto") return colunaTipo === "outro" ? "aviso" : "ok";
  if (campoTipo === "numero") {
    if (colunaTipo === "numero") return "ok";
    return colunaTipo === "texto" ? "aviso" : "erro";
  }
  if (colunaTipo === "data") return "ok";
  return colunaTipo === "texto" ? "aviso" : "erro";
}
