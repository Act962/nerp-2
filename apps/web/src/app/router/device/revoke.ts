import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Revoga um terminal (seta revokedAt). O id é revalidado contra a org antes de
// mexer — escopo de tenant manual, nunca confiar no id que chega do input.
export const revokeDevice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ deviceId: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ context, input, errors }) => {
    const device = await prisma.device.findFirst({
      where: { id: input.deviceId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!device)
      throw errors.NOT_FOUND({ message: "Dispositivo não encontrado" });

    await prisma.device.update({
      where: { id: device.id },
      data: { revokedAt: new Date() },
    });
    return { id: device.id };
  });
