import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

const DEFAULT_LAYERS = [
  "Estrutura",
  "Gôndolas",
  "Promoções",
  "Empresas",
  "Elétrica",
  "Hidráulica",
  "Auditorias",
];

export const createFloorPlan = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string(),
      name: z.string().min(1, "Informe o nome do mapa"),
      widthM: z.number().positive().optional(),
      heightM: z.number().positive().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true },
    });

    if (!store) {
      throw errors.NOT_FOUND({ message: "Loja não encontrada" });
    }

    const floorPlan = await prisma.floorPlan.create({
      data: {
        organizationId: context.org.id,
        storeId: input.storeId,
        name: input.name,
        widthM: input.widthM,
        heightM: input.heightM,
        layers: {
          create: DEFAULT_LAYERS.map((name, index) => ({
            organizationId: context.org.id,
            name,
            order: index,
          })),
        },
      },
      select: { id: true },
    });

    return { id: floorPlan.id };
  });
