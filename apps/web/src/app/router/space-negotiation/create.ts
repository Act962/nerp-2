import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { NegotiationStatus } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { inngest, negotiationCreated } from "@/lib/inngest/client";
import { z } from "zod";

export const createSpaceNegotiation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      mapObjectId: z.string(),
      supplierId: z.string().nullable().optional(),
      brandId: z.string().nullable().optional(),
      negotiationTypeId: z.string().nullable().optional(),
      distributor: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      amount: z.number().nonnegative().nullable().optional(),
      status: z.enum(NegotiationStatus).default("RASCUNHO"),
      notes: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const object = await prisma.mapObject.findFirst({
      where: { id: input.mapObjectId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!object) {
      throw errors.NOT_FOUND({ message: "Elemento não encontrado" });
    }

    const negotiation = await prisma.spaceNegotiation.create({
      data: {
        organizationId: context.org.id,
        mapObjectId: input.mapObjectId,
        supplierId: input.supplierId ?? null,
        brandId: input.brandId ?? null,
        negotiationTypeId: input.negotiationTypeId ?? null,
        distributor: input.distributor ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        amount: input.amount ?? null,
        status: input.status,
        notes: input.notes ?? null,
        createdById: context.user.id,
      },
      select: { id: true, endDate: true },
    });

    // Prepara o terreno pro Forge: evento inerte hoje (sem consumidor).
    await inngest
      .send(
        negotiationCreated.create({
          organizationId: context.org.id,
          mapObjectId: input.mapObjectId,
          negotiationId: negotiation.id,
          supplierId: input.supplierId ?? null,
          endDate: negotiation.endDate?.toISOString() ?? null,
        }),
      )
      .catch((error) => {
        console.error("[space-negotiation.create] inngest.send falhou:", error);
      });

    return { id: negotiation.id };
  });
