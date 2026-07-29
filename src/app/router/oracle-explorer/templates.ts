import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { oracleQueryConfigSchema } from "@/features/dashboard-widgets/lib/oracle-query-config";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "../erp-sync/_access";

// Modelos de consulta salvos pelo usuário ("padrões de busca").
//
// Escopo é a ORGANIZAÇÃO: quem salva compartilha com os outros admins, em vez
// de cada um remontar a mesma consulta. Mesmo gate de admin do resto do
// explorador — quem não pode criar widget Oracle não mexe nos modelos.

export const listOracleQueryTemplates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar modelos de consulta salvos",
    tags: ["oracle-explorer"],
  })
  .input(z.object({}))
  .handler(async ({ context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const templates = await prisma.oracleQueryTemplate.findMany({
      where: { organizationId: context.org.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        config: true,
        displayType: true,
        createdBy: { select: { user: { select: { name: true } } } },
      },
    });

    return {
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        config: template.config,
        displayType: template.displayType,
        authorName: template.createdBy?.user.name ?? null,
      })),
    };
  });

export const saveOracleQueryTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Salvar uma consulta como modelo",
    tags: ["oracle-explorer"],
  })
  .input(
    z.object({
      name: z.string().min(1, "Dê um nome ao modelo").max(60),
      description: z.string().max(160).nullable().optional(),
      config: oracleQueryConfigSchema,
      displayType: z.enum(["STAT", "CHART", "LIST", "TABLE"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    const name = input.name.trim();
    const existing = await prisma.oracleQueryTemplate.findFirst({
      where: { organizationId: context.org.id, name },
      select: { id: true },
    });
    if (existing) {
      throw errors.BAD_REQUEST({
        message: `Já existe um modelo chamado "${name}".`,
      });
    }

    const template = await prisma.oracleQueryTemplate.create({
      data: {
        organizationId: context.org.id,
        name,
        description: input.description?.trim() || null,
        config: input.config,
        displayType: input.displayType,
        createdById: member?.id ?? null,
      },
      select: { id: true },
    });

    return { id: template.id };
  });

export const deleteOracleQueryTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover um modelo de consulta",
    tags: ["oracle-explorer"],
  })
  .input(z.object({ templateId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    // Confere a organização antes de apagar — id vindo do client nunca é
    // confiável por si só.
    const template = await prisma.oracleQueryTemplate.findFirst({
      where: { id: input.templateId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!template) {
      throw errors.NOT_FOUND({ message: "Modelo não encontrado." });
    }

    await prisma.oracleQueryTemplate.delete({ where: { id: template.id } });
    return { deleted: true };
  });
