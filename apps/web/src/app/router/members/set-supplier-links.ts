import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import z from "zod";

// Indústrias de um membro (coordenação/supervisão), reaproveitando o vínculo
// `PromoterSupplier` que o promotor já usa — é a mesma pergunta ("por quais
// marcas esta pessoa responde"), e duplicar a tabela faria as duas telas
// discordarem.
//
// Só mexe em indústrias, ao contrário do `promotor.setMemberLinks`, que troca
// os TRÊS conjuntos de uma vez: chamá-lo daqui apagaria as lojas e os
// distribuidores do membro sem ninguém pedir.
export const setMemberSupplierLinks = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ memberId: z.string(), supplierIds: z.array(z.string()) }))
  .output(z.object({ supplierIds: z.array(z.string()) }))
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem editar vínculos.",
      });
    }

    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado." });

    // Só ids que realmente pertencem à org entram (evita id forjado).
    const valid = await prisma.supplier.findMany({
      where: { organizationId: context.org.id, id: { in: input.supplierIds } },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.promoterSupplier.deleteMany({ where: { memberId: member.id } }),
      prisma.promoterSupplier.createMany({
        data: valid.map((supplier) => ({
          organizationId: context.org.id,
          memberId: member.id,
          supplierId: supplier.id,
        })),
      }),
    ]);

    return { supplierIds: valid.map((row) => row.id) };
  });
