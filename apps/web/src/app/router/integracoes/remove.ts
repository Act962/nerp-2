import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

// Desinstalar apaga a credencial. O `deleteMany` com organizationId no filtro é
// o que impede remover a integração de outra organização por id adivinhado.
export const removeIntegracao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover integração instalada",
    tags: ["integracoes"],
  })
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const { count } = await prisma.financialIntegration.deleteMany({
      where: { id: input.id, organizationId: context.org.id },
    });

    if (count === 0) {
      throw errors.NOT_FOUND({ message: "Integração não encontrada." });
    }
    return { removed: true as const };
  });
