import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";

/**
 * A agenda como o cliente a vê, sem login.
 *
 * Devolve o mínimo para desenhar a página: nome, descrição e duração. Nada de
 * funil, etapa, responsáveis ou ids internos — é uma página aberta na
 * internet.
 */
export const getPublicAgenda = base
  .route({
    method: "GET",
    summary: "Dados públicos de uma agenda",
    tags: ["Agenda pública"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      agendaSlug: z.string().min(1),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      slotDuration: z.number(),
      organizationName: z.string(),
      organizationLogo: z.string().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true, name: true, logo: true },
    });
    if (!org) {
      throw errors.NOT_FOUND({ message: "Agenda não encontrada" });
    }

    const agenda = await prisma.agenda.findUnique({
      where: {
        slug_organizationId: {
          slug: input.agendaSlug,
          organizationId: org.id,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        slotDuration: true,
        isActive: true,
      },
    });

    // Agenda desativada some da internet como se não existisse: desativar é o
    // que o operador faz para parar de receber marcação.
    if (!agenda?.isActive) {
      throw errors.NOT_FOUND({ message: "Agenda não encontrada" });
    }

    return {
      id: agenda.id,
      name: agenda.name,
      description: agenda.description,
      slotDuration: agenda.slotDuration,
      organizationName: org.name,
      organizationLogo: org.logo,
    };
  });
