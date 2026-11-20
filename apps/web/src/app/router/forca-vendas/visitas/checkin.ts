import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { fazerCheckin } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Check-in no cliente com a distância conferida contra o raio da empresa.
export const fazerCheckinFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      customerId: z.string().min(1),
      clientOperationId: z.string().uuid().nullish(),
      latitude: z.number().min(-90).max(90).nullish(),
      longitude: z.number().min(-180).max(180).nullish(),
      precisaoM: z.number().min(0).nullish(),
      justificativa: z.string().max(500).nullish(),
    }),
  )
  .handler(async ({ input, context }) =>
    fazerCheckin({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    }),
  );
