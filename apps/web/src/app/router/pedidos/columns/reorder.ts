import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const reorderKitchenColumns = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Reordenar colunas da cozinha",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      order: z.array(
        z.object({
          id: z.string(),
          position: z.number().int(),
        }),
      ),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input }) => {
    const organizationId = context.org.id;

    await prisma.$transaction(
      input.order.map((item) =>
        prisma.kitchenColumn.updateMany({
          where: { id: item.id, organizationId },
          data: { position: item.position },
        }),
      ),
    );

    return { success: true };
  });
