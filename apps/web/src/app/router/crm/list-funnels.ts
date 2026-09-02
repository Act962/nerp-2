import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

export const listFunnels = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Lista os funis da organização",
    tags: ["CRM"],
  })
  .input(z.object({ incluirArquivados: z.boolean().optional() }))
  .output(
    z.object({
      funis: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          isArchived: z.boolean(),
          totalEstagios: z.number(),
          totalLeads: z.number(),
          /** `null` quando o funil ainda não tem número de WhatsApp ligado. */
          whatsapp: z
            .object({
              id: z.string(),
              status: z.enum(["CONNECTED", "DISCONNECTED"]),
              phoneNumber: z.string().nullable(),
            })
            .nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const funis = await prisma.crmFunnel.findMany({
      where: {
        organizationId: context.org.id,
        ...(input.incluirArquivados ? {} : { isArchived: false }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        isArchived: true,
        createdAt: true,
        _count: { select: { stages: true, leads: true } },
        whatsappConnection: {
          select: { id: true, status: true, phoneNumber: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      funis: funis.map((funil) => ({
        id: funil.id,
        name: funil.name,
        description: funil.description,
        isArchived: funil.isArchived,
        totalEstagios: funil._count.stages,
        totalLeads: funil._count.leads,
        whatsapp: funil.whatsappConnection
          ? {
              id: funil.whatsappConnection.id,
              status: funil.whatsappConnection.status,
              phoneNumber: funil.whatsappConnection.phoneNumber,
            }
          : null,
        // Data vira ISO no limite do handler, como manda a convenção.
        createdAt: funil.createdAt.toISOString(),
      })),
    };
  });
