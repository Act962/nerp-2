import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { extratoFlex } from "@/features/forca-vendas/server/inicio";
import { z } from "zod";

// Saldo e extrato do flex do próprio vendedor.
export const extratoFlexFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) =>
    extratoFlex({
      organizationId: context.org.id,
      memberId: context.vendedor.memberId,
    }),
  );
