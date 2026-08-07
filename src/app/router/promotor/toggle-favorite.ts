import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Marca/desmarca uma loja ou indústria como favorita do promotor. É preferência
// pessoal, não permissão: favoritar só reordena a lista, não autoriza nada —
// a captura em si é escopada pela organização, não por este vínculo.
export const togglePromotorFavorite = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      type: z.enum(["store", "supplier"]),
      id: z.string().min(1),
      favorite: z.boolean(),
    }),
  )
  .output(z.object({ favorite: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    if (input.type === "store") {
      const store = await prisma.store.findFirst({
        where: { id: input.id, organizationId: context.org.id },
        select: { id: true },
      });
      if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

      const where = {
        memberId_storeId: { memberId: member.id, storeId: store.id },
      };
      if (input.favorite) {
        await prisma.promoterFavoriteStore.upsert({
          where,
          create: {
            organizationId: context.org.id,
            memberId: member.id,
            storeId: store.id,
          },
          update: {},
        });
      } else {
        await prisma.promoterFavoriteStore.deleteMany({
          where: { memberId: member.id, storeId: store.id },
        });
      }
      return { favorite: input.favorite };
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!supplier) {
      throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
    }

    if (input.favorite) {
      await prisma.promoterFavoriteSupplier.upsert({
        where: {
          memberId_supplierId: {
            memberId: member.id,
            supplierId: supplier.id,
          },
        },
        create: {
          organizationId: context.org.id,
          memberId: member.id,
          supplierId: supplier.id,
        },
        update: {},
      });
    } else {
      await prisma.promoterFavoriteSupplier.deleteMany({
        where: { memberId: member.id, supplierId: supplier.id },
      });
    }
    return { favorite: input.favorite };
  });
