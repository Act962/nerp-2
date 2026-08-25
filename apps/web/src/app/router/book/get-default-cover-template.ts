import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const getDefaultCoverTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const template = await prisma.bookCoverTemplate.findUnique({
      where: { organizationId: context.org.id },
    });
    if (!template) return null;
    return {
      coverLayout: template.coverLayout,
      closingLayout: template.closingLayout,
      coverBackground: template.coverBackground,
      closingBackground: template.closingBackground,
    };
  });
