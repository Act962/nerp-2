import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Lista os terminais pareados da organização (para o admin ver/revogar).
export const listDevices = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.void())
  .output(
    z.object({
      devices: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          platform: z.string(),
          scopes: z.array(z.string()),
          lastSeenAt: z.string().nullable(),
          revokedAt: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const devices = await prisma.device.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        platform: true,
        scopes: true,
        lastSeenAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    return {
      devices: devices.map((device) => ({
        ...device,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        revokedAt: device.revokedAt?.toISOString() ?? null,
        createdAt: device.createdAt.toISOString(),
      })),
    };
  });
