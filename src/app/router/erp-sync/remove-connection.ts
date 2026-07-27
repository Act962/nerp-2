import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

// Remove a conexão (credenciais cifradas incluídas). O espelho já sincronizado
// (SalesFactDaily/ExternalSeller) fica: sem ErpConnection, a agregação do
// ranking volta a tratar a org como NATIVE, mas o histórico não some. Reconfigurar
// e ressincronizar reescreve tudo.
export const removeErpConnection = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover a conexão de ERP",
    tags: ["erp-sync"],
  })
  .handler(async ({ context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const result = await prisma.erpConnection.deleteMany({
      where: { organizationId: context.org.id },
    });
    if (result.count === 0) {
      throw errors.NOT_FOUND({
        message: "Nenhuma conexão de ERP configurada.",
      });
    }

    return { removed: true };
  });
