import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { randomBytes } from "node:crypto";
import { z } from "zod";

/**
 * Janela do QR. Curta de propósito: o token dispensa senha, então quem
 * fotografar a tela dentro da validade também parearia. Poucos minutos é o
 * bastante para apontar o celular e ainda deixa a foto inútil depois.
 */
const TTL_MINUTES = 3;

export const createScannerPairing = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .output(
    z.object({
      token: z.string(),
      expiresAt: z.string(),
      ttlSeconds: z.number(),
    }),
  )
  .handler(async ({ context, errors }) => {
    // Só dono e administrador geram o QR. Sem senha no meio, o crachá de quem
    // pode transformar um celular em leitor é este.
    const member = await prisma.member.findFirst({
      where: {
        organizationId: context.org.id,
        userId: context.user.id,
      },
      select: { role: true },
    });
    if (!hasFullAccess(member?.role)) {
      throw errors.FORBIDDEN({
        message: "Só o dono ou um administrador pode parear um leitor",
      });
    }

    // Encerra pareamentos anteriores do mesmo usuário: um QR novo na tela
    // significa que o anterior não deve mais valer.
    await prisma.scannerPairing.updateMany({
      where: {
        organizationId: context.org.id,
        createdById: context.user.id,
        status: { in: ["PENDING", "ACTIVE"] },
      },
      data: { status: "REVOKED" },
    });

    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000);
    const pairing = await prisma.scannerPairing.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        token: randomBytes(24).toString("base64url"),
        expiresAt,
      },
      select: { token: true },
    });

    return {
      token: pairing.token,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: TTL_MINUTES * 60,
    };
  });
