import "server-only";

import { ORPCError } from "@orpc/server";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { whereVendaValida } from "@/features/sales/lib/venda-valida";
import prisma from "@/lib/db";
import { calcularCubagem } from "../lib/cubagem";
import { type ContextoVendedor, clienteVisivel } from "./escopo-equipe";
import { fonteComercialDaOrg } from "./fontes";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Tabela do cliente, quando ele está no contexto e é visível para o vendedor. */
async function tabelaDoCliente(
  organizationId: string,
  vendedor: ContextoVendedor,
  customerId?: string | null,
): Promise<{ customerId: string | null; priceListId: string | null }> {
  if (!customerId) return { customerId: null, priceListId: null };
  if (!(await clienteVisivel(organizationId, vendedor.escopo, customerId))) {
    throw new ORPCError("NOT_FOUND", {
      message: "Cliente não encontrado na sua carteira",
    });
  }
  const cliente = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { priceListId: true },
  });
  return { customerId, priceListId: cliente?.priceListId ?? null };
}

const SELECT_LISTA = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  unit: true,
  salePrice: true,
  promotionalPrice: true,
  discountPercent: true,
  discountStartsAt: true,
  discountEndsAt: true,
  thumbnail: true,
  images: true,
  packQty: true,
  brand: { select: { name: true } },
} as const;

async function montarLista(args: {
  organizationId: string;
  priceListId: string | null;
  produtos: Array<{
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unit: string;
    salePrice: unknown;
    promotionalPrice: unknown;
    discountPercent: unknown;
    discountStartsAt: Date | null;
    discountEndsAt: Date | null;
    thumbnail: string;
    images: string[];
    packQty: number | null;
    brand: { name: string } | null;
  }>;
}) {
  const ids = args.produtos.map((produto) => produto.id);
  const fonte = await fonteComercialDaOrg(args.organizationId);
  const [precos, estoque] = await Promise.all([
    resolveManyPrices({
      organizationId: args.organizationId,
      priceListId: args.priceListId,
      items: ids.map((productId) => ({ productId, quantity: 1 })),
    }),
    fonte.estoque(ids),
  ]);
  return args.produtos.map((produto, indice) => {
    const saldo = estoque.get(produto.id);
    return {
      id: produto.id,
      nome: produto.name,
      sku: produto.sku,
      codigoDeBarras: produto.barcode,
      unidade: produto.unit,
      marca: produto.brand?.name ?? null,
      imagem: produto.thumbnail || produto.images[0] || null,
      preco: precos[indice]?.unitPrice ?? Number(produto.salePrice),
      precoBase: Number(produto.salePrice),
      // Oferta é o que muda o preço do pedido: desconto vigente do produto, da
      // categoria ou faixa da tabela. O `promotionalPrice` é só de vitrine e o
      // resolvedor não o aplica — marcar oferta por ele mostraria "oferta" com
      // o mesmo preço de sempre.
      emOferta:
        (precos[indice]?.unitPrice ?? Number(produto.salePrice)) <
        Number(produto.salePrice) - 0.005,
      unidadesPorCaixa: produto.packQty,
      disponivel: saldo?.controlaEstoque ? saldo.disponivel : null,
    };
  });
}

export async function buscarProdutos(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  busca?: string | null;
  customerId?: string | null;
  apenasOfertas?: boolean;
  cursor?: string | null;
  limite: number;
}) {
  const { priceListId } = await tabelaDoCliente(
    args.organizationId,
    args.vendedor,
    args.customerId,
  );
  const busca = args.busca?.trim();
  const agora = new Date();
  // Busca e oferta são dois OR independentes: dentro de um AND para um não
  // sobrescrever o outro.
  const filtros = [
    busca
      ? {
          OR: [
            { name: { contains: busca, mode: "insensitive" as const } },
            { sku: { equals: busca, mode: "insensitive" as const } },
            { barcode: busca },
            { erpCode: busca },
            {
              brand: {
                name: { contains: busca, mode: "insensitive" as const },
              },
            },
          ],
        }
      : null,
    // Candidatos à oferta: desconto vigente do produto. O preço final (com
    // tabela e categoria) decide no `emOferta` de `montarLista`.
    args.apenasOfertas
      ? {
          discountPercent: { gt: 0 },
          AND: [
            {
              OR: [
                { discountStartsAt: null },
                { discountStartsAt: { lte: agora } },
              ],
            },
            {
              OR: [
                { discountEndsAt: null },
                { discountEndsAt: { gte: agora } },
              ],
            },
          ],
        }
      : null,
  ].filter((filtro) => filtro !== null);
  const produtos = await prisma.product.findMany({
    where: {
      organizationId: args.organizationId,
      isActive: true,
      AND: filtros,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: args.limite + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    select: SELECT_LISTA,
  });
  const temMais = produtos.length > args.limite;
  const pagina = temMais ? produtos.slice(0, args.limite) : produtos;
  const lista = await montarLista({
    organizationId: args.organizationId,
    priceListId,
    produtos: pagina,
  });
  return {
    produtos: args.apenasOfertas
      ? lista.filter((produto) => produto.emOferta)
      : lista,
    proximoCursor: temMais ? (pagina.at(-1)?.id ?? null) : null,
  };
}

export async function detalharProduto(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  productId: string;
  customerId?: string | null;
}) {
  const { customerId, priceListId } = await tabelaDoCliente(
    args.organizationId,
    args.vendedor,
    args.customerId,
  );
  const produto = await prisma.product.findFirst({
    where: { id: args.productId, organizationId: args.organizationId },
    select: {
      ...SELECT_LISTA,
      description: true,
      isActive: true,
      erpCode: true,
      widthMm: true,
      heightMm: true,
      depthMm: true,
      grossWeightG: true,
      packWidthMm: true,
      packHeightMm: true,
      packDepthMm: true,
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });
  if (!produto)
    throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado" });

  const fonte = await fonteComercialDaOrg(args.organizationId);
  const desde = new Date(Date.now() - 30 * DIA_MS);
  const [lista, estoque, compras, vendido30, precoCaixa] = await Promise.all([
    montarLista({
      organizationId: args.organizationId,
      priceListId,
      produtos: [produto],
    }),
    fonte.estoque([produto.id]),
    customerId
      ? fonte.comprasDoProduto(customerId, produto.id, 5)
      : Promise.resolve([]),
    prisma.saleItem.aggregate({
      where: {
        productId: produto.id,
        sale: whereVendaValida(args.organizationId, {
          from: desde,
          to: new Date(),
        }),
      },
      _sum: { quantity: true },
    }),
    // Faixa de quantidade da tabela pode baratear a caixa fechada.
    produto.packQty && produto.packQty > 1
      ? resolveManyPrices({
          organizationId: args.organizationId,
          priceListId,
          items: [{ productId: produto.id, quantity: produto.packQty }],
        })
      : Promise.resolve([]),
  ]);
  const resumo = lista[0];
  const saldo = estoque.get(produto.id);

  return {
    ...resumo,
    descricao: produto.description,
    ativo: produto.isActive,
    codigoErp: produto.erpCode,
    categoria: produto.category?.name ?? null,
    fornecedor: produto.supplier?.name ?? null,
    imagens: [produto.thumbnail, ...produto.images].filter(Boolean),
    precoNaCaixa: precoCaixa[0]?.unitPrice ?? null,
    estoque: saldo ?? null,
    cubagem: calcularCubagem(produto),
    comprasDoCliente: compras,
    vendido30Dias: Number(vendido30._sum.quantity ?? 0),
    origemDosDados: fonte.origem,
  };
}
