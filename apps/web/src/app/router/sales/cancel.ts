import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isAuthorizer } from "@/app/router/cancel-request/_access";
import { traduzirErroFiscal } from "@/app/router/fiscal/_shared";
import {
  VendaNaoCancelavelError,
  cancelarVenda,
} from "@/features/sales/server/cancel-sale";
import prisma from "@/lib/db";

/**
 * Cancela uma venda concluída: NFC-e na SEFAZ (dentro do prazo), estoque,
 * caixa e financeiro. Quem pode é quem autoriza cancelamento no PDV
 * (owner/admin ou a permissão `autorizar-cancelamento`).
 */
export const cancelSale = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      saleId: z.string(),
      justificativa: z.string(),
    }),
  )
  .output(
    z.object({
      saleNumber: z.number(),
      notaCancelada: z
        .object({ numero: z.number(), serie: z.number() })
        .nullable(),
      caixa: z.enum(["SESSAO_DA_VENDA", "SESSAO_ATUAL", "SEM_CAIXA"]),
      devolverDinheiroManualmente: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const membro = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true, role: true, permissions: true },
    });
    if (!membro || !isAuthorizer(membro))
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para cancelar vendas",
      });
    try {
      return await cancelarVenda({
        organizationId: context.org.id,
        saleId: input.saleId,
        userId: context.user.id,
        memberId: membro.id,
        justificativa: input.justificativa,
      });
    } catch (erro) {
      if (erro instanceof VendaNaoCancelavelError)
        throw errors.BAD_REQUEST({ message: erro.message });
      traduzirErroFiscal(erro, errors);
    }
  });
