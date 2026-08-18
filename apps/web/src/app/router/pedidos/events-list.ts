import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  KitchenOrderActorType,
  KitchenOrderEventType,
} from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import z from "zod";

export const listKitchenOrderEvents = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Histórico de alterações dos pedidos",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      limit: z.number().int().positive().max(200).optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        type: z.enum(KitchenOrderEventType),
        tableNumber: z.string(),
        dishName: z.string(),
        fromColumnName: z.string().nullable(),
        toColumnName: z.string().nullable(),
        attendantName: z.string().nullable(),
        attendantPhoto: z.string().nullable(),
        actorType: z.enum(KitchenOrderActorType),
        actorName: z.string(),
        actorPhotoUrl: z.string().nullable(),
        createdAt: z.string(),
      }),
    ),
  )
  .handler(async ({ context, input }) => {
    const events = await prisma.kitchenOrderEvent.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 100,
    });

    return events.map((event) => ({
      id: event.id,
      type: event.type,
      tableNumber: event.tableNumber,
      dishName: event.dishName,
      fromColumnName: event.fromColumnName,
      toColumnName: event.toColumnName,
      attendantName: event.attendantName,
      attendantPhoto: event.attendantPhoto,
      actorType: event.actorType,
      actorName: event.actorName,
      actorPhotoUrl: event.actorPhotoUrl,
      createdAt: event.createdAt.toISOString(),
    }));
  });
