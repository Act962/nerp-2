import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ensureTradeCatalogs } from "@/features/trade-catalog/lib/ensure-catalogs";
import { z } from "zod";

export const ensureTradeCatalogsProc = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .output(
    z.object({
      mediaTypes: z.number(),
      negotiationTypes: z.number(),
      storeSectors: z.number(),
      total: z.number(),
    }),
  )
  .handler(async ({ context }) => {
    return ensureTradeCatalogs(context.org.id);
  });
