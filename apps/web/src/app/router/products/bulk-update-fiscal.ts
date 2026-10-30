import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  mensagemDasPendencias,
  prepararCamposFiscais,
} from "@/features/fiscal/server/cadastro-fiscal";
import prisma from "@/lib/db";
import { z } from "zod";

// Edição fiscal em lote — ninguém preenche o NCM de 2.000 produtos um a um.
//
// Separado do `bulkUpdate` porque aqui cada valor passa pela validação fiscal
// antes de gravar. No `patch`, campo ausente não muda; `null` LIMPA (o produto
// volta a usar o padrão da empresa).
const campo = z.string().nullable().optional();

export const bulkUpdateProductsFiscal = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      productIds: z.array(z.string()).min(1).max(1000),
      patch: z
        .object({
          ncm: campo,
          cest: campo,
          cfop: campo,
          origem: campo,
          cstIcms: campo,
          cstPis: campo,
          cstCofins: campo,
          cClassTrib: campo,
          cstIbsCbs: campo,
        })
        .refine((p) => Object.values(p).some((v) => v !== undefined), {
          message: "Informe pelo menos um campo",
        }),
    }),
  )
  .output(z.object({ updated: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const fiscal = await prepararCamposFiscais(context.org.id, input.patch);
    if (fiscal.pendencias.length > 0)
      throw errors.BAD_REQUEST({
        message: mensagemDasPendencias(fiscal.pendencias),
      });

    const result = await prisma.product.updateMany({
      where: { organizationId: context.org.id, id: { in: input.productIds } },
      data: fiscal.dados,
    });
    return { updated: result.count };
  });
