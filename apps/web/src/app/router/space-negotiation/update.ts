import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { NegotiationStatus } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateSpaceNegotiation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      supplierId: z.string().nullable().optional(),
      brandId: z.string().nullable().optional(),
      negotiationTypeId: z.string().nullable().optional(),
      distributor: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      amount: z.number().nonnegative().nullable().optional(),
      status: z.enum(NegotiationStatus).optional(),
      notes: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { id, startDate, endDate, ...rest } = input;

    const existing = await prisma.spaceNegotiation.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Negociação não encontrada" });
    }

    await prisma.spaceNegotiation.update({
      where: { id },
      data: {
        ...rest,
        startDate:
          startDate === undefined
            ? undefined
            : startDate
              ? new Date(startDate)
              : null,
        endDate:
          endDate === undefined
            ? undefined
            : endDate
              ? new Date(endDate)
              : null,
      },
    });

    return { id };
  });
