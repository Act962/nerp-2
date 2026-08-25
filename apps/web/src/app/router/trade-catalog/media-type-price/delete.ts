import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Remove o preço manual — o Catálogo PDV volta a exibir MediaType.basePrice
// ou a sugestão calculada pra essa loja+mídia.
export const deleteMediaTypePrice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.mediaTypePrice.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Preço não encontrado" });
    }

    return prisma.mediaTypePrice.delete({ where: { id: input.id } });
  });
