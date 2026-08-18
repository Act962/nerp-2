import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveFieldActor, resolveVisiblePromoters } from "./_access";
import { trailSchema } from "./_schemas";
import { type RawPoint, collapseStops, summarizeTrail } from "./_trail";

/**
 * Teto POR PROMOTOR, não global.
 *
 * Com um `take` único e ordenação por promotor, um dia movimentado devolveria o
 * trajeto completo dos primeiros e nada dos últimos — uma falha invisível que
 * faz parecer que a pessoa não trabalhou.
 */
const MAX_POINTS_PER_PROMOTER = 400;
/** Acima disto o seletor de promotor vira obrigatório na tela. */
const MAX_PROMOTERS = 20;

export const getFieldTrail = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
      /** `Member.id`, nunca `User.id` — ver `_access.ts`. */
      memberIds: z.array(z.string()).optional(),
      storeId: z.string().optional(),
    }),
  )
  .output(
    z.object({
      canSeeAll: z.boolean(),
      truncated: z.boolean(),
      trails: z.array(trailSchema),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveFieldActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const promoters = await resolveVisiblePromoters({
      organizationId: context.org.id,
      actor,
      memberIds: input.memberIds,
    });

    const from = new Date(input.from);
    const to = new Date(input.to);
    const selected = promoters.slice(0, MAX_PROMOTERS);
    let truncated = promoters.length > selected.length;

    // Uma consulta por promotor para o teto valer por pessoa. Com o índice
    // `(organizationId, createdById, capturedAt)` cada uma é uma varredura curta.
    const results = await Promise.all(
      selected.map(async (promoter) => {
        const photos = await prisma.pdvPhoto.findMany({
          where: {
            organizationId: context.org.id,
            createdById: promoter.userId,
            capturedAt: { gte: from, lte: to },
            capturedLatitude: { not: null },
            capturedLongitude: { not: null },
            ...(input.storeId ? { storeId: input.storeId } : {}),
          },
          orderBy: { capturedAt: "asc" },
          take: MAX_POINTS_PER_PROMOTER + 1,
          select: {
            id: true,
            capturedAt: true,
            capturedLatitude: true,
            capturedLongitude: true,
            capturedCity: true,
            capturedState: true,
            storeId: true,
            // Só o tamanho interessa, mas o Prisma não conta elementos de array
            // — vêm as chaves e o comprimento sai aqui.
            photos: true,
            store: { select: { name: true } },
          },
        });

        if (photos.length > MAX_POINTS_PER_PROMOTER) truncated = true;

        // O `{ not: null }` do Prisma não estreita o tipo — o predicado abaixo é
        // o que torna isso seguro sem `!` nem `any`.
        const points: RawPoint[] = photos
          .slice(0, MAX_POINTS_PER_PROMOTER)
          .filter(
            (
              photo,
            ): photo is typeof photo & {
              capturedLatitude: number;
              capturedLongitude: number;
            } =>
              photo.capturedLatitude !== null &&
              photo.capturedLongitude !== null,
          )
          .map((photo) => ({
            id: photo.id,
            at: photo.capturedAt,
            latitude: photo.capturedLatitude,
            longitude: photo.capturedLongitude,
            storeId: photo.storeId,
            storeName: photo.store?.name ?? null,
            city: photo.capturedCity,
            state: photo.capturedState,
            imageCount: photo.photos.length,
          }));

        const stops = collapseStops(points);
        const summary = summarizeTrail(stops);

        return {
          memberId: promoter.memberId,
          name: promoter.name,
          image: promoter.image,
          points: stops,
          firstAt: stops[0]?.at ?? null,
          lastAt:
            stops[stops.length - 1]?.endAt ??
            stops[stops.length - 1]?.at ??
            null,
          ...summary,
        };
      }),
    );

    return {
      canSeeAll: actor.canSeeAll,
      truncated,
      // Só quem de fato andou: promotor sem ponto no dia vira ruído na legenda.
      trails: results.filter((trail) => trail.points.length > 0),
    };
  });
