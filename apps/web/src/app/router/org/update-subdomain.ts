import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateSubdomain = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/update-subdomain",
    summary: "Update subdomain",
    description: "Update the subdomain of the organization",
    tags: ["Organization"],
  })
  .input(
    z.object({
      subdomain: z.string().min(3).max(63),
    }),
  )
  .output(
    z.object({
      organizationId: z.string(),
      subdomain: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.organization.findUnique({
      where: {
        subdomain: input.subdomain,
      },
    });

    const isAvailableToUse = !existing || existing.id === context.org.id;

    if (!isAvailableToUse) {
      throw errors.BAD_REQUEST({
        message: "Subdomínio indisponível",
      });
    }

    const updated = await prisma.organization.update({
      where: {
        id: context.org.id,
      },
      data: {
        subdomain: input.subdomain,
      },
    });

    return {
      organizationId: updated.id,
      subdomain: input.subdomain,
    };
  });
