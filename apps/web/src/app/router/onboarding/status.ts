import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { progressoDoGuia } from "@/features/onboarding/lib/trilha";
import prisma from "@/lib/db";

/**
 * O estado do onboarding: se ainda há dados de exemplo (decide o card de
 * boas-vindas) e o progresso do guia por solução de interesse — contagens
 * fixas, nenhuma IA.
 */
export const status = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Estado do onboarding",
    tags: ["Onboarding"],
  })
  .input(z.object({}))
  .output(
    z.object({
      temDadosDeExemplo: z.boolean(),
      exemplos: z.object({
        produtos: z.number(),
        clientes: z.number(),
        fornecedores: z.number(),
      }),
      sandbox: z.boolean(),
      interesses: z.array(z.string()),
      guia: z.object({
        feitos: z.number(),
        total: z.number(),
        passos: z.array(
          z.object({
            id: z.string(),
            titulo: z.string(),
            href: z.string(),
            feito: z.boolean(),
          }),
        ),
      }),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;
    const demo = { organizationId, isDemo: true };
    const real = { organizationId, isDemo: false };

    const [
      org,
      produtos,
      clientes,
      fornecedores,
      lojas,
      catalogos,
      produtosReais,
      clientesReais,
      vendasReais,
      catalogosTotal,
      conversasComAstro,
      whatsappConectado,
      campanhas,
      eventos,
      metas,
      lojasTotal,
      fotosPdv,
    ] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { verifiedAt: true, interests: true },
      }),
      prisma.product.count({ where: demo }),
      prisma.customer.count({ where: demo }),
      prisma.supplier.count({ where: demo }),
      prisma.store.count({ where: demo }),
      prisma.promotionalCatalog.count({ where: demo }),
      prisma.product.count({ where: real }),
      prisma.customer.count({ where: real }),
      prisma.sale.count({ where: real }),
      prisma.promotionalCatalog.count({ where: { organizationId } }),
      prisma.siteChatSession.count({
        where: { organizationId, channel: "APP", messageCount: { gt: 0 } },
      }),
      prisma.whatsAppConnection.count({
        where: { organizationId, status: "CONNECTED", isActive: true },
      }),
      prisma.broadcast.count({ where: { organizationId } }),
      prisma.calendarEvent.count({ where: { organizationId } }),
      prisma.salesGoalPeriod.count({ where: { organizationId } }),
      prisma.store.count({ where: { organizationId } }),
      prisma.pdvPhoto.count({ where: { organizationId } }),
    ]);

    const guia = progressoDoGuia(org.interests, {
      vendas: vendasReais,
      produtosReais,
      clientesReais,
      catalogos: catalogosTotal,
      catalogosExportados: 0,
      conversasComAstro,
      whatsappConectado: whatsappConectado > 0,
      campanhas,
      eventos,
      metas,
      lojas: lojasTotal,
      fotosPdv,
    });

    return {
      temDadosDeExemplo:
        produtos + clientes + fornecedores + lojas + catalogos > 0,
      exemplos: { produtos, clientes, fornecedores },
      sandbox: org.verifiedAt === null,
      interesses: org.interests,
      guia: {
        feitos: guia.feitos,
        total: guia.total,
        passos: guia.passos.map((p) => ({
          id: p.id,
          titulo: p.titulo,
          href: p.href,
          feito: p.feito,
        })),
      },
    };
  });
