import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

// Chamada pelo CELULAR ao abrir o link do QR. Público de propósito: o token é
// a credencial — é justamente ele que dispensa a digitação de senha no balcão.
export const claimScannerPairing = base
  .input(z.object({ token: z.string().min(1) }))
  .output(
    z.object({
      ok: z.boolean(),
      organizationName: z.string().nullable(),
      reason: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const pairing = await prisma.scannerPairing.findUnique({
      where: { token: input.token },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        claimedAt: true,
        organization: { select: { name: true } },
      },
    });

    if (!pairing) {
      return { ok: false, organizationName: null, reason: "QR inválido" };
    }
    if (pairing.status === "REVOKED") {
      return { ok: false, organizationName: null, reason: "QR encerrado" };
    }
    if (pairing.expiresAt < new Date()) {
      return {
        ok: false,
        organizationName: null,
        reason: "QR expirado — gere outro no PDV",
      };
    }
    // Uso único: o segundo aparelho não entra com o mesmo código.
    if (pairing.claimedAt) {
      return {
        ok: false,
        organizationName: null,
        reason: "Este QR já está em uso em outro aparelho",
      };
    }

    await prisma.scannerPairing.update({
      where: { id: pairing.id },
      data: { status: "ACTIVE", claimedAt: new Date(), lastSeenAt: new Date() },
    });

    return { ok: true, organizationName: pairing.organization.name };
  });
