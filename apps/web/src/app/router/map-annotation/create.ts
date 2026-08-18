import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

const ANNOTATION_TYPE = z.enum(["PIN", "COMMENT", "ALERT", "PENDING"]);

export const createMapAnnotation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      floorPlanId: z.string(),
      mapObjectId: z.string().optional(),
      type: ANNOTATION_TYPE.default("PIN"),
      x: z.number(),
      y: z.number(),
      text: z.string().optional(),
      status: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id: input.floorPlanId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!floorPlan) {
      throw errors.NOT_FOUND({ message: "Planta não encontrada" });
    }

    const annotation = await prisma.mapAnnotation.create({
      data: {
        organizationId: context.org.id,
        floorPlanId: input.floorPlanId,
        mapObjectId: input.mapObjectId,
        type: input.type,
        x: input.x,
        y: input.y,
        text: input.text,
        status: input.status,
        authorId: context.user.id,
      },
      select: {
        id: true,
        type: true,
        x: true,
        y: true,
        text: true,
        status: true,
        mapObjectId: true,
      },
    });

    return annotation;
  });
