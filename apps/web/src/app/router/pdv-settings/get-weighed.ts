import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { resolveWeighedConfig } from "@/features/pdv-weighed/weighed-barcode";
import prisma from "@/lib/db";
import { z } from "zod";

// Config do código de barras pesável da org (resolvida com os padrões).
export const getPdvWeighed = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      config: z.object({
        enabled: z.boolean(),
        prefix: z.string(),
        kind: z.enum(["PRICE", "WEIGHT"]),
        codeStart: z.number(),
        codeLength: z.number(),
        valueStart: z.number(),
        valueLength: z.number(),
        valueDecimals: z.number(),
      }),
    }),
  )
  .handler(async ({ context }) => {
    const org = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: { pdvWeighedBarcode: true },
    });
    const raw = org?.pdvWeighedBarcode;
    const config = resolveWeighedConfig(
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null,
    );
    return { config };
  });
