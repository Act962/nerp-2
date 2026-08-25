import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import {
  SpaceFlowLevel,
  SpaceTier,
  SpaceVisibility,
} from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

// Campos da "Biblioteca Nacional" (classificação comercial do espaço). FORA do
// bulkUpsert de propósito: aquele escreve `object.x ?? null` pra todo campo
// opcional a cada autosave/arraste — um client desatualizado no celular do
// promotor apagaria silenciosamente revenuePotential/avgSalesAmount (é
// dinheiro, não pixel). Aqui cada campo ausente do input não é tocado.
export const updateSpaceParams = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      mediaTypeId: z.string().nullable().optional(),
      sectorId: z.string().nullable().optional(),
      tier: z.enum(SpaceTier).nullable().optional(),
      flowLevel: z.enum(SpaceFlowLevel).nullable().optional(),
      visibility: z.enum(SpaceVisibility).nullable().optional(),
      isExclusive: z.boolean().optional(),
      revenuePotential: z.number().nonnegative().nullable().optional(),
      avgSalesAmount: z.number().nonnegative().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { id, ...rest } = input;

    const object = await prisma.mapObject.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!object) {
      throw errors.NOT_FOUND({ message: "Elemento não encontrado" });
    }

    if (rest.mediaTypeId) {
      const mediaType = await prisma.mediaType.findFirst({
        where: { id: rest.mediaTypeId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!mediaType) {
        throw errors.BAD_REQUEST({ message: "Tipo de mídia inválido" });
      }
    }
    if (rest.sectorId) {
      const sector = await prisma.storeSector.findFirst({
        where: { id: rest.sectorId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!sector) {
        throw errors.BAD_REQUEST({ message: "Setor inválido" });
      }
    }

    const data: Prisma.MapObjectUncheckedUpdateInput = rest;

    await prisma.mapObject.update({
      where: { id },
      data,
    });

    return { id };
  });
