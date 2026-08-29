import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

// O celular envia um código lido. Público pelo token, como o `claim`.
export const pushScannerScan = base
  .input(
    z.object({
      token: z.string().min(1),
      code: z.string().min(1).max(64),
    }),
  )
  .output(z.object({ ok: z.boolean(), reason: z.string().optional() }))
  .handler(async ({ input }) => {
    const pairing = await prisma.scannerPairing.findUnique({
      where: { token: input.token },
      select: { id: true, status: true, expiresAt: true },
    });

    if (!pairing || pairing.status !== "ACTIVE") {
      return { ok: false, reason: "Leitor não está pareado" };
    }
    // A validade do QR limita o PAREAMENTO, não a sessão: uma vez pareado, o
    // celular continua lendo. Encerrar é ação explícita no PDV.
    await prisma.$transaction([
      prisma.scannerScan.create({
        data: { pairingId: pairing.id, code: input.code.trim() },
      }),
      prisma.scannerPairing.update({
        where: { id: pairing.id },
        data: { lastSeenAt: new Date() },
      }),
    ]);

    return { ok: true };
  });
