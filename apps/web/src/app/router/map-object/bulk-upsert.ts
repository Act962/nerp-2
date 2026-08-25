import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  MapObjectType,
  MapSpaceState,
  type Prisma,
} from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { inngest, mapSpaceStateChanged } from "@/lib/inngest/client";
import { z } from "zod";

const vec2 = z.object({ x: z.number(), y: z.number() });

const geometrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("RECT"),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rotation: z.number(),
  }),
  z.object({ kind: z.literal("POLYGON"), points: z.array(vec2) }),
  z.object({ kind: z.literal("POLYLINE"), points: z.array(vec2) }),
  z.object({ kind: z.literal("POINT"), x: z.number(), y: z.number() }),
]);

const styleSchema = z.object({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().optional(),
});

const objectSchema = z.object({
  id: z.string(),
  type: z.enum(MapObjectType),
  layerId: z.string(),
  geometry: geometrySchema,
  z: z.number().int(),
  heightM: z.number().nullable().optional(),
  style: styleSchema.optional(),
  name: z.string().nullable().optional(),
  // Obrigatório de propósito: se fosse opcional com `?? "LIVRE"` no handler, um
  // client desatualizado rebaixaria silenciosamente um espaço EXECUTADO/PENDENTE.
  spaceState: z.enum(MapSpaceState),
  // `spaceCode`/`spaceSeq` NÃO entram aqui: são escritos só pela procedure
  // `assignSpaceCode`. Fora do autosave, um arraste nunca apaga o Digital Space ID.
  status: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  responsibleName: z.string().nullable().optional(),
  lastVisitAt: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const bulkUpsertMapObjects = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      floorPlanId: z.string(),
      objects: z.array(objectSchema),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (input.objects.length === 0) return { success: true };

    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id: input.floorPlanId, organizationId: context.org.id },
      select: { id: true, layers: { select: { id: true } } },
    });

    if (!floorPlan) {
      throw errors.NOT_FOUND({ message: "Mapa não encontrado" });
    }

    const layerIds = new Set(floorPlan.layers.map((layer) => layer.id));
    for (const object of input.objects) {
      if (!layerIds.has(object.layerId)) {
        throw errors.BAD_REQUEST({
          message: "Camada inválida para este mapa",
        });
      }
    }

    // Só atualiza ids já pertencentes a este mapa; os demais são criados.
    // Isso evita que um id de outra organização seja sobrescrito. Traz também
    // o estado + spaceCode atuais para diffar as transições sem round-trip extra.
    const existing = await prisma.mapObject.findMany({
      where: { floorPlanId: input.floorPlanId, organizationId: context.org.id },
      select: { id: true, spaceState: true, spaceCode: true },
    });
    const before = new Map(existing.map((object) => [object.id, object]));

    await prisma.$transaction(
      input.objects.map((object) => {
        const shared = {
          type: object.type,
          layerId: object.layerId,
          shapeKind: object.geometry.kind,
          geometry: object.geometry as Prisma.InputJsonValue,
          z: object.z,
          heightM: object.heightM ?? null,
          style: (object.style ?? {}) as Prisma.InputJsonValue,
          name: object.name ?? null,
          spaceState: object.spaceState,
          status: object.status ?? null,
          category: object.category ?? null,
          responsibleName: object.responsibleName ?? null,
          lastVisitAt: object.lastVisitAt ? new Date(object.lastVisitAt) : null,
          supplierId: object.supplierId ?? null,
          brandId: object.brandId ?? null,
          properties: (object.properties ?? {}) as Prisma.InputJsonValue,
        };

        if (before.has(object.id)) {
          return prisma.mapObject.update({
            where: { id: object.id },
            data: shared,
          });
        }

        return prisma.mapObject.create({
          data: {
            id: object.id,
            organizationId: context.org.id,
            floorPlanId: input.floorPlanId,
            ...shared,
          },
        });
      }),
    );

    // Emite só transições reais de estado, DEPOIS do commit (evento de write
    // revertido é pior que nenhum). Falha de broker não pode derrubar o autosave.
    const events = input.objects
      .map((object) => {
        const previous = before.get(object.id);
        if (!previous || previous.spaceState === object.spaceState) return null;
        return mapSpaceStateChanged.create({
          organizationId: context.org.id,
          floorPlanId: input.floorPlanId,
          mapObjectId: object.id,
          spaceCode: previous.spaceCode,
          from: previous.spaceState,
          to: object.spaceState,
        });
      })
      .filter((event): event is NonNullable<typeof event> => event !== null);

    if (events.length > 0) {
      await inngest.send(events).catch((error) => {
        console.error("[map-object.bulkUpsert] inngest.send falhou:", error);
      });
    }

    return { success: true };
  });
