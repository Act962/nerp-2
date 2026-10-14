import { base } from "@/app/middlewares/base";
import {
  buscarProdutosDaVitrine,
  carregarVitrine,
  ordemDaVitrine,
  precificar,
  semOsSemFoto,
} from "@/features/storefront/server/vitrine";
import prisma from "@/lib/db";
import z from "zod";
import { produtoDaVitrineSchema } from "./list-products";

/** A faixa é uma fila horizontal: passado disso ninguém rola até o fim. */
const MAX_OFERTAS = 60;

/**
 * A faixa "Em oferta" da vitrine. Separada da lista paginada porque ela olha
 * o catálogo inteiro — as ofertas não podem depender de quanto o cliente já
 * rolou.
 */
export const listOffers = base
  .route({
    method: "GET",
    summary: "Produtos em oferta da vitrine",
    tags: ["products"],
  })
  .input(
    z.object({
      subdomain: z.string(),
      catalogUserId: z.string().optional(),
    }),
  )
  .output(z.array(produtoDaVitrineSchema))
  .handler(async ({ input, errors }) => {
    const vitrine = await carregarVitrine(input.subdomain);
    if (!vitrine) throw errors.NOT_FOUND();

    // O banco faz a peneira grossa (promoção abaixo do preço de tabela); a
    // fina vem depois, contra o preço já resolvido para o comprador.
    const candidatos = await buscarProdutosDaVitrine({
      where: {
        ...vitrine.visiveis,
        promotionalPrice: { gt: 0, lt: prisma.product.fields.salePrice },
      },
      orderBy: ordemDaVitrine(vitrine.sortOrder),
      take: MAX_OFERTAS,
    });

    const produtos = await precificar(
      vitrine,
      await semOsSemFoto(vitrine, candidatos),
      input.catalogUserId,
    );
    return produtos.filter(
      (produto) =>
        produto.promotionalPrice !== null &&
        produto.promotionalPrice > 0 &&
        produto.promotionalPrice < produto.salePrice,
    );
  });
