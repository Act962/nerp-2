import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveCalendarActor } from "./_access";

/**
 * Lojas, indústrias e UFs para os filtros e para o formulário de evento.
 *
 * Aplica o mesmo recorte da audiência: quem não gerencia recebe só as lojas e
 * marcas às quais está vinculado. As UFs saem daí, então o promotor de Teresina
 * não recebe o aniversário de Santa Catarina.
 */
export const getCalendarFilterOptions = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      canManage: z.boolean(),
      stores: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          state: z.string().nullable(),
          isFavorite: z.boolean(),
        }),
      ),
      suppliers: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          isFavorite: z.boolean(),
        }),
      ),
      /** Promotores para escalar numa ação. Vazio para quem não gerencia — a
       * lista de membros não precisa vazar para o campo. */
      members: z.array(z.object({ id: z.string(), name: z.string() })),
      ufs: z.array(z.string()),
    }),
  )
  .handler(async ({ context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    // Favoritos alimentam as sugestões de ação das datas comemorativas: a ideia
    // só é útil se citar as marcas e as lojas que ESTA pessoa atende.
    const [stores, suppliers, organization, favStores, favSuppliers, members] =
      await Promise.all([
        prisma.store.findMany({
          where: {
            organizationId: context.org.id,
            ...(actor.canManage
              ? {}
              : { promoterLinks: { some: { memberId: actor.memberId } } }),
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, state: true },
        }),
        prisma.supplier.findMany({
          where: {
            organizationId: context.org.id,
            isActive: true,
            ...(actor.canManage
              ? {}
              : { promoterLinks: { some: { memberId: actor.memberId } } }),
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.organization.findUnique({
          where: { id: context.org.id },
          select: { state: true },
        }),
        prisma.promoterFavoriteStore.findMany({
          where: { organizationId: context.org.id, memberId: actor.memberId },
          select: { storeId: true },
        }),
        prisma.promoterFavoriteSupplier.findMany({
          where: { organizationId: context.org.id, memberId: actor.memberId },
          select: { supplierId: true },
        }),
        // Só para quem gerencia: a lista de membros da empresa não precisa
        // descer para o campo.
        actor.canManage
          ? prisma.member.findMany({
              where: { organizationId: context.org.id },
              orderBy: { createdAt: "asc" },
              select: { id: true, user: { select: { name: true } } },
            })
          : Promise.resolve([]),
      ]);

    const favoriteStoreIds = new Set(favStores.map((row) => row.storeId));
    const favoriteSupplierIds = new Set(
      favSuppliers.map((row) => row.supplierId),
    );

    // UFs onde a organização de fato opera. O estado da matriz é só fallback
    // para org que ainda não cadastrou loja — usá-lo sozinho faria uma rede em
    // 5 estados enxergar um aniversário só.
    const ufs = [
      ...new Set(
        stores
          .map((store) => store.state)
          .filter((state): state is string => Boolean(state)),
      ),
    ];
    if (ufs.length === 0 && organization?.state) ufs.push(organization.state);

    return {
      canManage: actor.canManage,
      stores: stores.map((store) => ({
        ...store,
        isFavorite: favoriteStoreIds.has(store.id),
      })),
      suppliers: suppliers.map((supplier) => ({
        ...supplier,
        isFavorite: favoriteSupplierIds.has(supplier.id),
      })),
      members: members.map((member) => ({
        id: member.id,
        name: member.user.name,
      })),
      ufs,
    };
  });
