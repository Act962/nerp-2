import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Poll do PDV: o caixa acompanha o status da própria solicitação.
export const getCancelRequest = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
      approvedByName: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const request = await prisma.cancellationRequest.findFirst({
      where: {
        id: input.id,
        organizationId: context.org.id,
        requestedById: context.user.id,
      },
      select: { status: true, approvedByName: true },
    });
    if (!request)
      throw errors.NOT_FOUND({ message: "Solicitação não encontrada" });
    return { status: request.status, approvedByName: request.approvedByName };
  });
