import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number(),
  rotation: z.number(),
});

const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const updateFloorPlan = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      widthM: z.number().positive().optional(),
      heightM: z.number().positive().optional(),
      pixelsPerMeter: z.number().positive().optional(),
      backgroundImageKey: z.string().nullable().optional(),
      backgroundOpacity: z.number().min(0).max(1).optional(),
      backgroundTransform: transformSchema.nullable().optional(),
      defaultViewport: viewportSchema.optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;

    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!floorPlan) {
      throw errors.NOT_FOUND({ message: "Mapa não encontrado" });
    }

    return prisma.floorPlan.update({
      where: { id },
      data: {
        name: data.name,
        widthM: data.widthM,
        heightM: data.heightM,
        pixelsPerMeter: data.pixelsPerMeter,
        backgroundImageKey: data.backgroundImageKey,
        backgroundOpacity: data.backgroundOpacity,
        backgroundTransform: data.backgroundTransform ?? undefined,
        defaultViewport: data.defaultViewport,
      },
      select: { id: true },
    });
  });
