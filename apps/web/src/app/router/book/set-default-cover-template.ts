import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import {
  coverBackgroundSchema,
  coverLayoutSchema,
} from "./cover-layout-schema";

export const setDefaultCoverTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      coverLayout: coverLayoutSchema,
      closingLayout: coverLayoutSchema,
      coverBackground: coverBackgroundSchema,
      closingBackground: coverBackgroundSchema,
    }),
  )
  .handler(async ({ input, context }) => {
    await prisma.bookCoverTemplate.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        coverLayout: input.coverLayout,
        closingLayout: input.closingLayout,
        coverBackground: input.coverBackground,
        closingBackground: input.closingBackground,
      },
      update: {
        coverLayout: input.coverLayout,
        closingLayout: input.closingLayout,
        coverBackground: input.coverBackground,
        closingBackground: input.closingBackground,
      },
    });
    return { success: true as const };
  });
