import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

const ANNOTATION_TYPE = z.enum(["PIN", "COMMENT", "ALERT", "PENDING"]);

export const updateMapAnnotation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      type: ANNOTATION_TYPE.optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      text: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...rest } = input;

    const annotation = await prisma.mapAnnotation.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!annotation) {
      throw errors.NOT_FOUND({ message: "Anotação não encontrada" });
    }

    return prisma.mapAnnotation.update({
      where: { id },
      data: rest,
      select: { id: true },
    });
  });
