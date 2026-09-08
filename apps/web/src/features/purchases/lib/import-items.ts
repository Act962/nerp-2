import type { PickedProduct } from "../components/item-search";

/** Teto de linhas por planilha — o `IN` do lookup por código vai junto. */
export const MAX_LINHAS = 1000;

export type CampoItem =
  | "codigo"
  | "quantidade"
  | "custo"
  | "desconto"
  | "precoVenda";

export type LinhaPlanilha = Record<string, unknown>;
export type MapeamentoItem = Partial<Record<CampoItem, string>>;

export const CAMPOS_ITEM: {
  key: CampoItem;
  label: string;
  obrigatorio: boolean;
  apelidos: string[];
}[] = [
  {
    key: "codigo",
    label: "Código / SKU",
    obrigatorio: true,
    apelidos: ["codigo", "codigodebarras", "barcode", "ean", "sku", "gtin"],
  },
  {
    key: "quantidade",
    label: "Quantidade",
    obrigatorio: true,
    apelidos: ["quantidade", "qtd", "qtde", "quantity", "qt"],
  },
  {
    key: "custo",
    label: "Custo unitário",
    obrigatorio: false,
    apelidos: [
      "custo",
      "custounitario",
      "precodecusto",
      "valorunitario",
      "unitprice",
      "precounitario",
    ],
  },
  {
    key: "desconto",
    label: "Desconto",
    obrigatorio: false,
    apelidos: ["desconto", "discount", "desc"],
  },
  {
    key: "precoVenda",
    label: "Preço de venda",
    obrigatorio: false,
    apelidos: ["precodevenda", "precovenda", "venda", "saleprice"],
  },
];

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Pré-seleciona a coluna cujo nome bate com o rótulo ou um apelido do campo. */
export function autoMapear(colunas: string[]): MapeamentoItem {
  const mapa: MapeamentoItem = {};
  for (const campo of CAMPOS_ITEM) {
    const alvos = new Set([normalizar(campo.label), ...campo.apelidos]);
    const achou = colunas.find((coluna) => alvos.has(normalizar(coluna)));
    if (achou) mapa[campo.key] = achou;
  }
  return mapa;
}

/**
 * Número a partir do que a planilha entregou.
 *
 * Vírgula, quando existe, é separador DECIMAL e os pontos viram milhar — é como
 * o Excel em pt-BR exporta. Sem vírgula, o ponto é o decimal, que é o padrão de
 * qualquer sistema que exporte em inglês. Fica uma ambiguidade real e sem saída:
 * "1.234" pode ser mil duzentos e trinta e quatro ou um vírgula duzentos e
 * trinta e quatro. Adotamos a leitura padrão (1.234), e é por isso que a tela
 * mostra a conferência antes de aceitar.
 */
export function paraNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const semMilhar = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(semMilhar.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numero) ? numero : null;
}

export interface LinhaPronta {
  /** Linha na PLANILHA, contando o cabeçalho — é o que o operador vê no Excel. */
  numero: number;
  product: PickedProduct;
  quantity: number;
  unitPrice: number;
  discount: number;
  newSalePrice: number | null;
}

export interface LinhaIgnorada {
  numero: number;
  motivo: string;
}

/**
 * Transforma as linhas da planilha nos itens da nota.
 *
 * Linha que não resolve NÃO vira item nem produto novo: entra na lista de
 * ignoradas com o número que o operador vê na planilha, para ele corrigir a
 * origem. Inventar cadastro a partir de planilha suja é como o catálogo
 * apodrece.
 */
export function resolverLinhas(
  linhas: LinhaPlanilha[],
  mapa: MapeamentoItem,
  produtos: Map<string, PickedProduct>,
): { prontos: LinhaPronta[]; ignorados: LinhaIgnorada[] } {
  // Sem as duas colunas obrigatórias não há o que conferir — e listar cada
  // linha como "ignorada" só assustaria quem ainda está mapeando.
  if (!mapa.codigo || !mapa.quantidade) return { prontos: [], ignorados: [] };

  const prontos: LinhaPronta[] = [];
  const ignorados: LinhaIgnorada[] = [];

  linhas.forEach((linha, indice) => {
    // +2: a planilha é 1-based e a primeira linha é o cabeçalho.
    const numero = indice + 2;
    const codigo = String(linha[mapa.codigo as string] ?? "").trim();
    if (!codigo) {
      ignorados.push({ numero, motivo: "sem código" });
      return;
    }
    const product = produtos.get(codigo);
    if (!product) {
      ignorados.push({ numero, motivo: `código ${codigo} não cadastrado` });
      return;
    }
    const quantity = paraNumero(linha[mapa.quantidade as string]);
    if (quantity === null || quantity <= 0) {
      ignorados.push({ numero, motivo: "quantidade inválida" });
      return;
    }

    // Custo ausente na planilha cai no custo ATUAL do produto, que é o mesmo
    // palpite que a tela usa ao adicionar um item pelo leitor.
    const custo = mapa.custo ? paraNumero(linha[mapa.custo]) : null;
    const desconto = mapa.desconto ? paraNumero(linha[mapa.desconto]) : null;
    const venda = mapa.precoVenda ? paraNumero(linha[mapa.precoVenda]) : null;

    prontos.push({
      numero,
      product,
      quantity,
      unitPrice: custo !== null && custo >= 0 ? custo : product.costPrice,
      discount: desconto !== null && desconto > 0 ? desconto : 0,
      // Zero não é "de graça", é coluna vazia: gravar zeraria o preço de venda.
      newSalePrice: venda !== null && venda > 0 ? venda : null,
    });
  });

  return { prontos, ignorados };
}
