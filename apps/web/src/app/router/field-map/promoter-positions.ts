import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveFieldActor, resolveVisiblePromoters } from "./_access";

/** Teto de pessoas consultadas — uma consulta curta por promotor. */
const MAX_PROMOTERS = 40;

/**
 * Onde cada promotor foi visto por último.
 *
 * DELIBERADAMENTE fora do período do filtro. O trajeto responde "por onde ele
 * andou naquele intervalo"; isto responde "onde ele está agora" — e quem abre a
 * semana passada para conferir uma rota continua precisando saber onde a equipe
 * está hoje. Amarrar as duas coisas ao mesmo filtro apagaria a segunda.
 *
 * A posição vem da última foto capturada com coordenada, então é "visto por
 * último", não rastreamento ao vivo: sem foto, sem ponto. A tela diz há quanto
 * tempo foi, porque um pino de duas semanas atrás apresentado sem data é pior
 * do que pino nenhum.
 */
export const getPromoterPositions = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      canSeeAll: z.boolean(),
      positions: z.array(
        z.object({
          memberId: z.string(),
          name: z.string(),
          image: z.string().nullable(),
          latitude: z.number(),
          longitude: z.number(),
          at: z.string(),
          storeId: z.string().nullable(),
          storeName: z.string().nullable(),
          city: z.string().nullable(),
          state: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ context, errors }) => {
    const actor = await resolveFieldActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    // Sem `memberIds`: quem é liderança vê a equipe, quem não é vê só a si —
    // a mesma função que decide isso no trajeto decide aqui.
    const promoters = await resolveVisiblePromoters({
      organizationId: context.org.id,
      actor,
    });

    const positions = await Promise.all(
      promoters.slice(0, MAX_PROMOTERS).map(async (promoter) => {
        const photo = await prisma.pdvPhoto.findFirst({
          where: {
            organizationId: context.org.id,
            createdById: promoter.userId,
            capturedLatitude: { not: null },
            capturedLongitude: { not: null },
          },
          orderBy: { capturedAt: "desc" },
          select: {
            capturedAt: true,
            capturedLatitude: true,
            capturedLongitude: true,
            capturedCity: true,
            capturedState: true,
            storeId: true,
            store: { select: { name: true } },
          },
        });

        // O `{ not: null }` do Prisma não estreita o tipo — a checagem abaixo é
        // o que torna isto seguro sem `!` nem `any`.
        if (
          !photo ||
          photo.capturedLatitude === null ||
          photo.capturedLongitude === null
        ) {
          return null;
        }

        return {
          memberId: promoter.memberId,
          name: promoter.name,
          image: promoter.image,
          latitude: photo.capturedLatitude,
          longitude: photo.capturedLongitude,
          at: photo.capturedAt.toISOString(),
          storeId: photo.storeId,
          storeName: photo.store?.name ?? null,
          city: photo.capturedCity,
          state: photo.capturedState,
        };
      }),
    );

    return {
      canSeeAll: actor.canSeeAll,
      // Mais recente primeiro: quem está em campo agora encabeça a lista.
      positions: positions
        .filter((position) => position !== null)
        .sort((a, b) => b.at.localeCompare(a.at)),
    };
  });
