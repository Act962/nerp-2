import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Normaliza um slug simples (varejo/atacado/revendedor/loja-online...).
function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Cria uma nova tabela de preço. Se `isDefault=true`, remove o default anterior
// (só pode haver uma default por org) — mesmo padrão usado em contas bancárias.
export const createPriceList = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome"),
      description: z.string().optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const baseSlug = slugify(input.name);
    if (!baseSlug) {
      throw errors.BAD_REQUEST({ message: "Nome inválido para gerar slug" });
    }

    // Slug único por org — se colidir, sufixa com número.
    let slug = baseSlug;
    let n = 1;
    while (
      await prisma.priceList.findFirst({
        where: { organizationId: context.org.id, slug },
        select: { id: true },
      })
    ) {
      n += 1;
      slug = `${baseSlug}-${n}`;
    }

    const created = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.priceList.updateMany({
          where: { organizationId: context.org.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.priceList.create({
        data: {
          organizationId: context.org.id,
          name: input.name,
          slug,
          description: input.description,
          isDefault: input.isDefault ?? false,
          isActive: input.isActive ?? true,
        },
        select: { id: true },
      });
    });

    return { id: created.id };
  });
