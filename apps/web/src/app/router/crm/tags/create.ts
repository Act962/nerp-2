import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { comoSlug } from "@/app/router/agenda/_access";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import prisma from "@/lib/db";

export const createTag = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Cria etiqueta", tags: ["CRM"] })
  .input(
    z.object({
      nome: z.string().trim().min(1, "Informe o nome da etiqueta").max(40),
      cor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
        .default("#1447e6"),
      /** Deixe vazio para a etiqueta valer na organização inteira. */
      funnelId: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string(), nome: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (input.funnelId) {
      await requireFunnelDaOrg(input.funnelId, organizationId);
    }

    const slug = comoSlug(input.nome) || "etiqueta";
    const funnelId = input.funnelId ?? null;

    // A unique é (nome, org, funil) e (slug, org, funil): duas etiquetas com o
    // mesmo nome no mesmo escopo seriam indistinguíveis no seletor.
    const repetida = await prisma.crmTag.findFirst({
      where: {
        organizationId,
        funnelId,
        OR: [{ name: input.nome }, { slug }],
      },
      select: { id: true, archivedAt: true },
    });

    if (repetida) {
      // Recriar uma etiqueta arquivada é reativá-la: o histórico que aponta
      // para ela volta a fazer sentido, em vez de ganhar uma segunda com o
      // mesmo nome.
      if (repetida.archivedAt) {
        const revivida = await prisma.crmTag.update({
          where: { id: repetida.id },
          data: { archivedAt: null, archivedById: null, color: input.cor },
          select: { id: true, name: true },
        });
        return { id: revivida.id, nome: revivida.name };
      }
      throw errors.BAD_REQUEST({
        message: "Já existe uma etiqueta com esse nome.",
      });
    }

    const criada = await prisma.crmTag.create({
      data: {
        organizationId,
        funnelId,
        name: input.nome,
        slug,
        color: input.cor,
      },
      select: { id: true, name: true },
    });

    return { id: criada.id, nome: criada.name };
  });
