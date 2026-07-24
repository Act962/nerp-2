import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Molde do map-object/bulk-upsert: escopo por org, valida o pai antes de
// escrever, tudo numa transação. A diferença é que aqui a hierarquia tem 4
// níveis, então a validação de posse precisa subir a árvore inteira — gravar um
// item cujo shelfId é de outra organização seria vazamento cross-tenant.

const fixtureSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "GONDOLA",
    "PONTA_GONDOLA",
    "ILHA",
    "CHECKOUT",
    "GELADEIRA",
    "EXPOSITOR",
    "CLIP_STRIP",
  ]),
  name: z.string(),
  order: z.number().int(),
  widthMm: z.number().int().min(1),
  heightMm: z.number().int().min(1),
  depthMm: z.number().int().min(1),
  baseHeightMm: z.number().int().min(0),
  colorHex: z.string().nullable(),
  mapObjectId: z.string().nullable(),
});

const moduleSchema = z.object({
  id: z.string(),
  fixtureId: z.string(),
  index: z.number().int().min(0),
  widthMm: z.number().int().min(1),
  label: z.string().nullable(),
});

const shelfSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  index: z.number().int().min(0),
  yMm: z.number().int().min(0),
  widthMm: z.number().int().min(1),
  depthMm: z.number().int().min(1),
  thicknessMm: z.number().int().min(1),
  kind: z.enum(["PRATELEIRA", "GANCHEIRA", "CESTO", "CAIXARIA"]),
  layoutMode: z.enum(["PACKED", "FREE"]),
  maxWeightKg: z.number().nullable(),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  dividers: z.array(z.object({ xMm: z.number().int() })),
});

const itemSchema = z.object({
  id: z.string(),
  shelfId: z.string(),
  productId: z.string(),
  position: z.number().int().min(0),
  xMm: z.number().int().nullable(),
  facings: z.number().int().min(1),
  facingsDeep: z.number().int().min(1),
  facingsHigh: z.number().int().min(1),
  orientation: z.enum(["FRENTE", "LADO", "TOPO"]),
  isBoxed: z.boolean(),
  widthMm: z.number().int().min(0),
  heightMm: z.number().int().min(0),
  depthMm: z.number().int().min(0),
  note: z.string().nullable(),
});

export const bulkSavePlanogram = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      planogramId: z.string(),
      fixtures: z.array(fixtureSchema).default([]),
      modules: z.array(moduleSchema).default([]),
      shelves: z.array(shelfSchema).default([]),
      items: z.array(itemSchema).default([]),
      deletes: z
        .object({
          fixtureIds: z.array(z.string()).default([]),
          moduleIds: z.array(z.string()).default([]),
          shelfIds: z.array(z.string()).default([]),
          itemIds: z.array(z.string()).default([]),
        })
        .default({
          fixtureIds: [],
          moduleIds: [],
          shelfIds: [],
          itemIds: [],
        }),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    const planogram = await prisma.planogram.findFirst({
      where: { id: input.planogramId, organizationId },
      select: { id: true },
    });
    if (!planogram) {
      throw errors.NOT_FOUND({ message: "Planograma não encontrado" });
    }

    // Toda FK que vem do cliente é verificada contra a org antes de gravar.
    // Sem isso, um id forjado de outra organização entraria no banco — foi
    // exatamente esse buraco que existia no pdv-photo.
    const [ownedFixtures, ownedModules, ownedShelves, ownedProducts] =
      await Promise.all([
        prisma.planogramFixture.findMany({
          where: { organizationId, planogramId: planogram.id },
          select: { id: true },
        }),
        prisma.planogramModule.findMany({
          where: { organizationId },
          select: { id: true },
        }),
        prisma.planogramShelf.findMany({
          where: { organizationId },
          select: { id: true },
        }),
        input.items.length > 0
          ? prisma.product.findMany({
              where: {
                organizationId,
                id: { in: [...new Set(input.items.map((i) => i.productId))] },
              },
              select: { id: true },
            })
          : Promise.resolve([]),
      ]);

    const fixtureIds = new Set(ownedFixtures.map((row) => row.id));
    const moduleIds = new Set(ownedModules.map((row) => row.id));
    const shelfIds = new Set(ownedShelves.map((row) => row.id));
    const productIds = new Set(ownedProducts.map((row) => row.id));

    // Ids novos entram no conjunto de "válidos" porque estão sendo criados
    // agora, nesta mesma transação.
    for (const fixture of input.fixtures) fixtureIds.add(fixture.id);
    for (const moduleNode of input.modules) moduleIds.add(moduleNode.id);
    for (const shelf of input.shelves) shelfIds.add(shelf.id);

    for (const moduleNode of input.modules) {
      if (!fixtureIds.has(moduleNode.fixtureId)) {
        throw errors.BAD_REQUEST({
          message: "Módulo aponta para gôndola inválida",
        });
      }
    }
    for (const shelf of input.shelves) {
      if (!moduleIds.has(shelf.moduleId)) {
        throw errors.BAD_REQUEST({
          message: "Prateleira aponta para módulo inválido",
        });
      }
    }
    for (const item of input.items) {
      if (!shelfIds.has(item.shelfId)) {
        throw errors.BAD_REQUEST({
          message: "Item aponta para prateleira inválida",
        });
      }
      if (!productIds.has(item.productId)) {
        throw errors.BAD_REQUEST({
          message: "Item aponta para produto inválido",
        });
      }
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    // Ordem importa: cria/atualiza de cima para baixo, apaga de baixo para cima.
    for (const fixture of input.fixtures) {
      const { id, ...data } = fixture;
      operations.push(
        prisma.planogramFixture.upsert({
          where: { id },
          create: { id, organizationId, planogramId: planogram.id, ...data },
          update: data,
        }),
      );
    }
    for (const moduleNode of input.modules) {
      const { id, ...data } = moduleNode;
      operations.push(
        prisma.planogramModule.upsert({
          where: { id },
          create: { id, organizationId, ...data },
          update: data,
        }),
      );
    }
    for (const shelf of input.shelves) {
      const { id, dividers, ...data } = shelf;
      const dividersJson = dividers as unknown as Prisma.InputJsonValue;
      operations.push(
        prisma.planogramShelf.upsert({
          where: { id },
          create: { id, organizationId, ...data, dividers: dividersJson },
          update: { ...data, dividers: dividersJson },
        }),
      );
    }
    for (const item of input.items) {
      const { id, ...data } = item;
      operations.push(
        prisma.planogramItem.upsert({
          where: { id },
          create: { id, organizationId, planogramId: planogram.id, ...data },
          update: data,
        }),
      );
    }

    // Deletes sempre com escopo triplo (id + org), nunca por id solto.
    if (input.deletes.itemIds.length > 0) {
      operations.push(
        prisma.planogramItem.deleteMany({
          where: { id: { in: input.deletes.itemIds }, organizationId },
        }),
      );
    }
    if (input.deletes.shelfIds.length > 0) {
      operations.push(
        prisma.planogramShelf.deleteMany({
          where: { id: { in: input.deletes.shelfIds }, organizationId },
        }),
      );
    }
    if (input.deletes.moduleIds.length > 0) {
      operations.push(
        prisma.planogramModule.deleteMany({
          where: { id: { in: input.deletes.moduleIds }, organizationId },
        }),
      );
    }
    if (input.deletes.fixtureIds.length > 0) {
      operations.push(
        prisma.planogramFixture.deleteMany({
          where: { id: { in: input.deletes.fixtureIds }, organizationId },
        }),
      );
    }

    if (operations.length === 0) return { success: true };

    await prisma.$transaction(operations);
    await prisma.planogram.update({
      where: { id: planogram.id },
      data: { updatedAt: new Date() },
    });

    return { success: true };
  });
