import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { z } from "zod";

export const deleteCategory = base
  .use(requireAuthMiddleware)
  .route({
    method: "DELETE",
    path: "/category/:id",
    summary: "Delete a category",
    tags: ["Category"],
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const poductExists = prisma.product.findUnique({
      where: {
        id: input.id,
      },
    });

    if (!poductExists) {
      throw errors.NOT_FOUND;
    }

    await prisma.category.delete({
      where: {
        id: input.id,
      },
    });
  });
