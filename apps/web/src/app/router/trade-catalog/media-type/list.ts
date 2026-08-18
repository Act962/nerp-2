import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { MediaKind } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const listMediaType = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      kind: z.enum(MediaKind).optional(),
      includeInactive: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const items = await prisma.mediaType.findMany({
      where: {
        organizationId: context.org.id,
        kind: input.kind,
        isActive: input.includeInactive ? undefined : true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        kind: true,
        code: true,
        name: true,
        description: true,
        examples: true,
        occupancyRules: true,
        defaultPhotos: true,
        isActive: true,
        sortOrder: true,
        isSystemDefault: true,
      },
    });

    return { items };
  });
