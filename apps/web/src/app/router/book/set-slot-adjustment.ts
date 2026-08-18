import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Grava o enquadramento (pan/zoom/fit/backdrop) de UMA foto, mesclando no mapa
// PdvPhoto.photoAdjustments (keyed pela key da foto). Usado pelos slots do
// editor de book (modelo V2) — não sobrescreve ajustes de outras fotos do
// mesmo PdvPhoto.
export const setSlotAdjustment = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      pdvPhotoId: z.string(),
      photoKey: z.string(),
      adjustment: z.object({
        zoom: z.number(),
        posX: z.number(),
        posY: z.number(),
        objectFit: z.enum(["cover", "contain"]).optional(),
        backdrop: z.enum(["none", "blur", "color"]).optional(),
        backdropColor: z.string().optional(),
        focusPolygon: z
          .array(z.object({ x: z.number(), y: z.number() }))
          .optional(),
      }),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const photo = await prisma.pdvPhoto.findFirst({
      where: { id: input.pdvPhotoId, organizationId: context.org.id },
      select: { id: true, photoAdjustments: true },
    });
    if (!photo) throw errors.NOT_FOUND({ message: "Foto não encontrada" });

    const current =
      photo.photoAdjustments && typeof photo.photoAdjustments === "object"
        ? (photo.photoAdjustments as Record<string, unknown>)
        : {};

    const next = { ...current, [input.photoKey]: input.adjustment };

    await prisma.pdvPhoto.update({
      where: { id: photo.id },
      data: { photoAdjustments: next as Prisma.InputJsonValue },
    });

    return { success: true as const };
  });
