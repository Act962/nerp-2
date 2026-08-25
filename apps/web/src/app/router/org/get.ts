import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Organization } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const getOrganization = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Get a Organization",
    path: "/org",
    tags: ["Organization"],
  })
  .input(z.void())
  .output(
    z.object({
      organization: z.custom<Organization>(),
    }),
  )
  .handler(async ({ context, errors }) => {
    const organization = await prisma.organization.findUnique({
      where: {
        id: context.org.id,
      },
    });

    if (!organization) {
      throw errors.NOT_FOUND({
        message: "Organização não encontrada",
      });
    }

    return {
      organization,
    };
  });
