import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Ficha do cliente que aparece ao lado da conversa.
 *
 * Traz junto o que o `Customer` do ERP sabe — últimas compras e total gasto —
 * porque é exatamente esse o ganho de o atendimento morar dentro do ERP: quem
 * responde vê, na mesma tela, se está falando com alguém que comprou ontem ou
 * com alguém que nunca comprou.
 *
 * Os valores saem como número, não `Decimal`, e as datas como ISO: conversão
 * no limite do handler, como manda a convenção do projeto.
 */
export const getLead = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Ficha do lead", tags: ["CRM"] })
  .input(z.object({ leadId: z.string().min(1) }))
  .output(
    z.object({
      id: z.string(),
      nome: z.string(),
      telefone: z.string().nullable(),
      email: z.string().nullable(),
      documento: z.string().nullable(),
      valor: z.number(),
      temperatura: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]),
      statusFlow: z.enum(["NEW", "ACTIVE", "WAITING", "FINISHED"]),
      /** Ganho, perdido ou ainda em jogo. */
      situacao: z.enum(["ACTIVE", "DELETED", "WON", "LOST"]),
      origem: z.string(),
      estagio: z.object({
        id: z.string(),
        nome: z.string(),
        cor: z.string().nullable(),
      }),
      responsavel: z.object({ id: z.string(), nome: z.string() }).nullable(),
      tags: z.array(
        z.object({
          id: z.string(),
          nome: z.string(),
          cor: z.string().nullable(),
        }),
      ),
      cliente: z
        .object({
          id: z.string(),
          nome: z.string(),
          documento: z.string().nullable(),
          totalDeCompras: z.number(),
          valorTotal: z.number(),
          ultimasCompras: z.array(
            z.object({
              id: z.string(),
              total: z.number(),
              data: z.string(),
            }),
          ),
        })
        .nullable(),
      criadoEm: z.string(),
      ultimaEntradaEm: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const lead = await prisma.crmLead.findFirst({
      where: { id: input.leadId, organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        document: true,
        amount: true,
        temperature: true,
        statusFlow: true,
        currentAction: true,
        source: true,
        createdAt: true,
        lastInboundAt: true,
        stage: { select: { id: true, name: true, color: true } },
        responsible: { select: { id: true, name: true } },
        leadTags: {
          select: { tag: { select: { id: true, name: true, color: true } } },
        },
        customer: {
          select: {
            id: true,
            name: true,
            document: true,
            sales: {
              select: { id: true, total: true, createdAt: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
    }

    const vendas = lead.customer?.sales ?? [];

    return {
      id: lead.id,
      nome: lead.name,
      telefone: lead.phone,
      email: lead.email,
      documento: lead.document,
      valor: Number(lead.amount),
      temperatura: lead.temperature,
      statusFlow: lead.statusFlow,
      situacao: lead.currentAction,
      origem: lead.source,
      estagio: {
        id: lead.stage.id,
        nome: lead.stage.name,
        cor: lead.stage.color,
      },
      responsavel: lead.responsible
        ? { id: lead.responsible.id, nome: lead.responsible.name }
        : null,
      tags: lead.leadTags.map((vinculo) => ({
        id: vinculo.tag.id,
        nome: vinculo.tag.name,
        cor: vinculo.tag.color,
      })),
      cliente: lead.customer
        ? {
            id: lead.customer.id,
            nome: lead.customer.name,
            documento: lead.customer.document,
            totalDeCompras: vendas.length,
            valorTotal: vendas.reduce(
              (soma, venda) => soma + Number(venda.total),
              0,
            ),
            ultimasCompras: vendas.slice(0, 3).map((venda) => ({
              id: venda.id,
              total: Number(venda.total),
              data: venda.createdAt.toISOString(),
            })),
          }
        : null,
      criadoEm: lead.createdAt.toISOString(),
      ultimaEntradaEm: lead.lastInboundAt?.toISOString() ?? null,
    };
  });
