import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireMemberOfOrgSlug } from "@/app/router/pedidos/_require-member-of-org-slug";
import { generateShareToken } from "@/lib/share-token";
import z from "zod";

const orgProcedure = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

/**
 * Estado da mesa — derivado, nunca coluna.
 *
 * Guardar `status` obrigaria a mantê-lo em sincronia com a cozinha, e a
 * primeira escrita que falhasse deixaria a mesa ocupada para sempre, sem
 * ninguém sentado nela.
 */
export const ESTADOS = ["LIVRE", "CONSUMINDO", "FECHANDO"] as const;
export type EstadoDaMesa = (typeof ESTADOS)[number];

const mesaSchema = z.object({
  id: z.string(),
  number: z.number(),
  name: z.string().nullable(),
  seats: z.number().nullable(),
  qrToken: z.string(),
  isActive: z.boolean(),
  estado: z.enum(ESTADOS),
  total: z.number(),
  itens: z.number(),
  abertaDesde: z.string().nullable(),
  atendente: z.string().nullable(),
});

/** Mesas com o estado e a conta já resolvidos — uma consulta, não N. */
export const listTables = orgProcedure
  .route({ method: "GET", summary: "Mesas do salão", tags: ["mesa"] })
  .input(z.object({ incluirInativas: z.boolean().optional() }))
  .output(z.array(mesaSchema))
  .handler(async ({ context, input }) =>
    listarMesas(context.org.id, input.incluirInativas ?? false),
  );

/**
 * Cria uma faixa de mesas de uma vez ("da 1 até a 20").
 *
 * Criar de uma em uma é o tipo de tarefa que faz o dono desistir do sistema na
 * primeira tarde. Número que já existe é pulado em silêncio — repetir a
 * operação não pode dar erro nem duplicar.
 */
export const createTables = orgProcedure
  .route({ method: "POST", summary: "Criar mesas", tags: ["mesa"] })
  .input(
    z.object({
      de: z.number().int().min(1).max(999),
      ate: z.number().int().min(1).max(999),
      seats: z.number().int().min(1).max(50).optional(),
    }),
  )
  .output(z.object({ criadas: z.number(), puladas: z.number() }))
  .handler(async ({ context, input, errors }) => {
    if (input.ate < input.de) {
      throw errors.BAD_REQUEST({
        message: "O número final precisa ser maior ou igual ao inicial.",
      });
    }
    if (input.ate - input.de >= 200) {
      throw errors.BAD_REQUEST({ message: "No máximo 200 mesas por vez." });
    }

    const existentes = await prisma.serviceTable.findMany({
      where: {
        organizationId: context.org.id,
        number: { gte: input.de, lte: input.ate },
      },
      select: { number: true },
    });
    const jaTem = new Set(existentes.map((m) => m.number));

    const novas = [];
    for (let n = input.de; n <= input.ate; n++) {
      if (jaTem.has(n)) continue;
      novas.push({
        organizationId: context.org.id,
        number: n,
        seats: input.seats ?? null,
        qrToken: generateShareToken(),
      });
    }

    if (novas.length > 0) {
      await prisma.serviceTable.createMany({ data: novas });
    }

    return { criadas: novas.length, puladas: jaTem.size };
  });

export const updateTable = orgProcedure
  .route({ method: "POST", summary: "Editar mesa", tags: ["mesa"] })
  .input(
    z.object({
      id: z.string(),
      name: z.string().trim().max(60).nullable().optional(),
      seats: z.number().int().min(1).max(50).nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    const { id, ...dados } = input;
    const resultado = await prisma.serviceTable.updateMany({
      where: { id, organizationId: context.org.id },
      data: dados,
    });
    if (resultado.count === 0) {
      throw errors.NOT_FOUND({ message: "Mesa não encontrada" });
    }
    return { success: true };
  });

/** Pede a conta: a mesa fica "Fechando" e o caixa sabe que vem gente pagar. */
export const requestBill = orgProcedure
  .route({ method: "POST", summary: "Pedir a conta da mesa", tags: ["mesa"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    const resultado = await prisma.serviceTable.updateMany({
      where: { id: input.id, organizationId: context.org.id },
      data: { closingRequestedAt: new Date() },
    });
    if (resultado.count === 0) {
      throw errors.NOT_FOUND({ message: "Mesa não encontrada" });
    }
    return { success: true };
  });

/**
 * Libera a mesa: arquiva os pedidos e devolve para Livre.
 *
 * A VENDA NÃO É TOCADA — ela continua na fila do caixa para ser recebida.
 * Arquivar o pedido tira o card da cozinha; quem dá baixa no dinheiro é o PDV.
 */
export const releaseTable = orgProcedure
  .route({ method: "POST", summary: "Liberar mesa", tags: ["mesa"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ arquivados: z.number() }))
  .handler(async ({ context, input, errors }) => {
    const mesa = await prisma.serviceTable.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!mesa) throw errors.NOT_FOUND({ message: "Mesa não encontrada" });

    const agora = new Date();
    const [arquivados] = await prisma.$transaction([
      prisma.kitchenOrder.updateMany({
        where: { tableId: mesa.id, archivedAt: null },
        data: { archivedAt: agora },
      }),
      prisma.serviceTable.update({
        where: { id: mesa.id },
        data: { closingRequestedAt: null },
      }),
    ]);

    return { arquivados: arquivados.count };
  });

/**
 * Resolve o adesivo colado na mesa.
 *
 * Autenticada: só quem atende naquela organização abre a mesa pela câmera. O
 * token é credencial de ENDEREÇO, não de identidade — quem fotografa o adesivo
 * não vira garçom.
 */
export const resolveTableQr = base
  .use(requireAuthMiddleware)
  .route({ method: "GET", summary: "Resolver QR da mesa", tags: ["mesa"] })
  .input(z.object({ orgSlug: z.string().min(1), qrToken: z.string().min(1) }))
  .output(z.object({ id: z.string(), number: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const org = await requireMemberOfOrgSlug({
      orgSlug: input.orgSlug,
      userId: context.user.id,
      errors,
    });

    const mesa = await prisma.serviceTable.findFirst({
      where: { qrToken: input.qrToken, organizationId: org.id, isActive: true },
      select: { id: true, number: true },
    });

    if (!mesa) {
      throw errors.NOT_FOUND({
        message: "Este QR não é de uma mesa desta loja.",
      });
    }

    return mesa;
  });

/** Mesas para o app do garçom — mesma leitura, resolvida pelo slug da URL. */
export const listTablesForWaiter = base
  .use(requireAuthMiddleware)
  .route({ method: "GET", summary: "Mesas (app do garçom)", tags: ["mesa"] })
  .input(z.object({ orgSlug: z.string().min(1) }))
  .output(z.array(mesaSchema))
  .handler(async ({ input, context, errors }) => {
    const org = await requireMemberOfOrgSlug({
      orgSlug: input.orgSlug,
      userId: context.user.id,
      errors,
    });
    return listarMesas(org.id);
  });

export const mesaRoutes = {
  list: listTables,
  listForWaiter: listTablesForWaiter,
  create: createTables,
  update: updateTable,
  requestBill,
  release: releaseTable,
  resolveQr: resolveTableQr,
};

/**
 * A leitura da mesa em um lugar só: estado, conta e tempo.
 *
 * O painel e o app do garçom precisam responder a mesma coisa. Duplicar a
 * regra é como as duas telas começam a discordar sobre qual mesa está livre.
 */
async function listarMesas(organizationId: string, incluirInativas = false) {
  const mesas = await prisma.serviceTable.findMany({
    where: { organizationId, ...(incluirInativas ? {} : { isActive: true }) },
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { archivedAt: null },
        select: {
          createdAt: true,
          attendantName: true,
          sale: { select: { id: true, total: true } },
        },
      },
    },
  });

  return mesas.map((mesa) => {
    const vendas = new Map<string, number>();
    for (const pedido of mesa.orders) {
      if (pedido.sale) vendas.set(pedido.sale.id, Number(pedido.sale.total));
    }
    const abertaDesde = mesa.orders.reduce<Date | null>((menor, pedido) => {
      if (!menor) return pedido.createdAt;
      return pedido.createdAt < menor ? pedido.createdAt : menor;
    }, null);

    return {
      id: mesa.id,
      number: mesa.number,
      name: mesa.name,
      seats: mesa.seats,
      qrToken: mesa.qrToken,
      isActive: mesa.isActive,
      estado: (mesa.orders.length === 0
        ? "LIVRE"
        : mesa.closingRequestedAt
          ? "FECHANDO"
          : "CONSUMINDO") as EstadoDaMesa,
      total: [...vendas.values()].reduce((soma, v) => soma + v, 0),
      itens: mesa.orders.length,
      abertaDesde: abertaDesde ? abertaDesde.toISOString() : null,
      atendente:
        mesa.orders.find((p) => p.attendantName)?.attendantName ?? null,
    };
  });
}
