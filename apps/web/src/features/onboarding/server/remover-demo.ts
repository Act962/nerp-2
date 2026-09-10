import "server-only";

import prisma from "@/lib/db";

export interface ResultadoDaRemocao {
  produtos: number;
  categorias: number;
  clientes: number;
  fornecedores: number;
  lojas: number;
  catalogos: number;
  /** Registros de exemplo que ganharam vínculo real e por isso só perderam a marca. */
  mantidos: number;
}

/**
 * Tira os dados de exemplo da organização.
 *
 * Apaga só o que continua sendo exemplo puro. Produto que já foi vendido,
 * cliente que já comprou, fornecedor que já tem produto de verdade: esses
 * perdem a marca `isDemo` e ficam — apagar levaria junto a venda, e a venda é
 * real. É a mesma regra do `Restrict` que o schema já impõe em `SaleItem`.
 */
export async function removerDadosDeExemplo(
  organizationId: string,
): Promise<ResultadoDaRemocao> {
  return prisma.$transaction(async (tx) => {
    const catalogos = await tx.promotionalCatalog.deleteMany({
      where: { organizationId, isDemo: true },
    });

    const produtos = await tx.product.deleteMany({
      where: {
        organizationId,
        isDemo: true,
        saleItems: { none: {} },
        purchaseItems: { none: {} },
      },
    });
    const produtosMantidos = await tx.product.updateMany({
      where: { organizationId, isDemo: true },
      data: { isDemo: false },
    });

    const categorias = await tx.category.deleteMany({
      where: { organizationId, isDemo: true, products: { none: {} } },
    });
    const categoriasMantidas = await tx.category.updateMany({
      where: { organizationId, isDemo: true },
      data: { isDemo: false },
    });

    const clientes = await tx.customer.deleteMany({
      where: { organizationId, isDemo: true, sales: { none: {} } },
    });
    const clientesMantidos = await tx.customer.updateMany({
      where: { organizationId, isDemo: true },
      data: { isDemo: false },
    });

    const fornecedores = await tx.supplier.deleteMany({
      where: { organizationId, isDemo: true, products: { none: {} } },
    });
    const fornecedoresMantidos = await tx.supplier.updateMany({
      where: { organizationId, isDemo: true },
      data: { isDemo: false },
    });

    const lojas = await tx.store.deleteMany({
      where: {
        organizationId,
        isDemo: true,
        pdvPhotos: { none: {} },
        bookPages: { none: {} },
        floorPlans: { none: {} },
      },
    });
    const lojasMantidas = await tx.store.updateMany({
      where: { organizationId, isDemo: true },
      data: { isDemo: false },
    });

    return {
      produtos: produtos.count,
      categorias: categorias.count,
      clientes: clientes.count,
      fornecedores: fornecedores.count,
      lojas: lojas.count,
      catalogos: catalogos.count,
      mantidos:
        produtosMantidos.count +
        categoriasMantidas.count +
        clientesMantidos.count +
        fornecedoresMantidos.count +
        lojasMantidas.count,
    };
  });
}
