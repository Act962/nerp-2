import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { resyncBooksAfterPhotoChange } from "@/features/books/server/resync-book";
import { z } from "zod";

// Troca a foto pela versão já com o selo da indústria e limpa a marcação de
// "sem selo". A composição roda no navegador da coordenadora (mesmo caminho de
// canvas da captura) e chega aqui só como a nova chave do R2 — desenhar de novo
// no servidor exigiria uma segunda implementação do carimbo, com risco das duas
// divergirem.
export const applyPromotorSeal = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      photoId: z.string(),
      photoKey: z.string().min(1),
      /** Aprovar na mesma ação — é o fluxo normal de quem acabou de conferir. */
      approve: z.boolean().default(false),
    }),
  )
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true, permissions: true },
    });
    if (!memberCan(member, "books-aprovar")) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para aprovar fotos",
      });
    }

    const photo = await prisma.pdvPhoto.findFirst({
      where: { id: input.photoId, organizationId: context.org.id },
      select: { id: true, photos: true },
    });
    if (!photo) throw errors.NOT_FOUND({ message: "Foto não encontrada" });

    await prisma.pdvPhoto.update({
      where: { id: photo.id },
      data: {
        // Substitui a primeira foto (a do promotor) preservando as demais.
        photos: [input.photoKey, ...photo.photos.slice(1)],
        sealMissing: false,
        ...(input.approve
          ? {
              approvalStatus: "APPROVED" as const,
              approvalNote: null,
              reviewedById: context.user.id,
              reviewedByName: context.user.name ?? null,
              reviewedAt: new Date(),
            }
          : {}),
      },
    });

    // Book vivo: aprovar junto com o selo insere a foto nos books do escopo.
    if (input.approve) {
      await resyncBooksAfterPhotoChange(context.org.id, [photo.id]);
    }

    return { success: true as const };
  });
