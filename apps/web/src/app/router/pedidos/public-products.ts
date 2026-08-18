import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

// Rota pública (sem requireAuth): lista mínima de produtos da org para o app
// do garçom. Confiança vem do orgSlug. Nada sensível — apenas id, nome e
// tempo de preparo. Sem preços ou estoque.
export const publicProducts = base
  .route({
    method: "GET",
    summary: "Produtos ativos da org (kiosk do garçom)",
    tags: ["kitchen"],
  })
  .input(z.object({ orgSlug: z.string().min(1) }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        prepTimeMinutes: z.number().nullable(),
      }),
    ),
  )
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true },
    });

    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const products = await prisma.product.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, prepTimeMinutes: true },
    });

    return products;
  });
