import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ICONES_DE_CATEGORIA } from "@/features/storefront/lib/icones-de-categoria";
import prisma from "@/lib/db";
import z from "zod";

/** Ícone e imagem de uma categoria na vitrine. `null` apaga a escolha. */
export const updateCategoryAppearance = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PUT",
    summary: "Aparência da categoria na vitrine",
    tags: ["settings-catalog"],
  })
  .input(
    z.object({
      id: z.string(),
      icon: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const categoria = await prisma.category.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!categoria) {
      throw errors.NOT_FOUND({ message: "Categoria não encontrada." });
    }
    if (input.icon && !ICONES_DE_CATEGORIA[input.icon]) {
      throw errors.BAD_REQUEST({ message: "Ícone desconhecido." });
    }

    await prisma.category.update({
      where: { id: categoria.id },
      data: {
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.image !== undefined && { image: input.image }),
      },
    });
    return { id: categoria.id };
  });
