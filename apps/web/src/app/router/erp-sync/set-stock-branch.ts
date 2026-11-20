import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

// Filial cujo estoque e último preço vendido vão para o produto (tela de
// Produtos e vitrine do catálogo). Vale a partir do próximo sync — o botão
// "Atualizar agora" aplica na hora. `null` volta ao comportamento antigo.
export const setErpStockBranch = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Escolher a filial do estoque do ERP",
    tags: ["erp-sync"],
  })
  .input(z.object({ branchCode: z.string().trim().min(1).max(20).nullable() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    if (input.branchCode) {
      const isKnownBranch = await prisma.productBranchStock.findFirst({
        where: { organizationId: context.org.id, branchCode: input.branchCode },
        select: { id: true },
      });
      if (!isKnownBranch) {
        throw errors.BAD_REQUEST({
          message:
            "Filial sem estoque no último sync. Sincronize antes de escolher.",
        });
      }
    }

    const result = await prisma.erpConnection.updateMany({
      where: { organizationId: context.org.id, kind: { not: "NATIVE" } },
      data: { stockBranchCode: input.branchCode },
    });
    if (result.count === 0) {
      throw errors.NOT_FOUND({
        message: "Nenhuma conexão de ERP configurada.",
      });
    }

    return { stockBranchCode: input.branchCode };
  });
