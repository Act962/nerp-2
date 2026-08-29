import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Estado do pareamento para a tela do PDV: mostra se o celular já abriu o QR
// e se continua vivo.
export const scannerStatus = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ token: z.string() }))
  .output(
    z.object({
      status: z.enum(["PENDING", "ACTIVE", "REVOKED", "EXPIRED", "UNKNOWN"]),
      lastSeenAt: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const pairing = await prisma.scannerPairing.findFirst({
      where: { token: input.token, organizationId: context.org.id },
      select: {
        status: true,
        expiresAt: true,
        lastSeenAt: true,
        claimedAt: true,
      },
    });
    if (!pairing) return { status: "UNKNOWN" as const, lastSeenAt: null };

    const expirado =
      pairing.status === "PENDING" && pairing.expiresAt < new Date();

    return {
      status: expirado ? ("EXPIRED" as const) : pairing.status,
      lastSeenAt: pairing.lastSeenAt?.toISOString() ?? null,
    };
  });
