import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { dadosDaInicio } from "@/features/forca-vendas/server/inicio";
import { z } from "zod";

// Tudo que a home do módulo mostra: vendido, meta, flex e o aviso em destaque.
export const dadosDaInicioFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) =>
    dadosDaInicio({
      organizationId: context.org.id,
      vendedor: context.vendedor,
    }),
  );
