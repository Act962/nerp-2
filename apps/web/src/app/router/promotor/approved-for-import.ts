import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Fotos APROVADAS de um cliente+indústria, para a coordenadora importar no book.
export const listApprovedForImport = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string().optional(),
      supplierId: z.string().optional(),
      // Quando informado, marca `usedInBook` nas fotos já usadas em qualquer
      // página deste book — pro picker avisar sobre repetição.
      bookId: z.string().optional(),
      // Só as fotos marcadas com "Gostei" pela coordenadora.
      likedOnly: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const photos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId: context.org.id,
        approvalStatus: "APPROVED",
        promoterName: { not: null },
        ...(input.storeId ? { storeId: input.storeId } : {}),
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
        ...(input.likedOnly ? { liked: true } : {}),
      },
      orderBy: { capturedAt: "desc" },
      select: {
        id: true,
        photos: true,
        code: true,
        promoterName: true,
        capturedAt: true,
        capturedCity: true,
        capturedState: true,
        mediaTypeId: true,
        mediaType: { select: { id: true, code: true, name: true } },
        liked: true,
        store: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

    // Fotos já usadas em alguma página deste book: o picker mostra
    // "Já usada - pág. N".
    //
    // O número sai da POSIÇÃO da página na lista ordenada (+2: a capa é 1 e o
    // conteúdo começa em 2), e não de `order + 2`. `order` sozinho mente:
    // apagar uma página do meio não recompacta os `order` (delete-page.ts), e
    // aí a tarja passa a citar uma página que a tela numera de outro jeito.
    //
    // E a MESMA captura pode estar em várias páginas — ela vai em todas, em
    // ordem. Antes ficava a primeira linha que o Postgres devolvesse, num
    // findMany sem `orderBy`: quem estivesse olhando outra página via a tarja
    // apontar para um lugar onde a foto também está, mas não o que ele vê.
    const usedInBook = new Set<string>();
    const usedInPages = new Map<string, number[]>();
    if (input.bookId) {
      const pages = await prisma.bookPage.findMany({
        where: {
          bookId: input.bookId,
          book: { organizationId: context.org.id },
        },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      const numeroDaPagina = new Map(pages.map((page, i) => [page.id, i + 2]));

      const used = await prisma.bookItem.findMany({
        where: {
          bookId: input.bookId,
          book: { organizationId: context.org.id },
          pdvPhotoId: { in: photos.map((p) => p.id) },
        },
        select: { pdvPhotoId: true, bookPageId: true },
      });
      for (const item of used) {
        usedInBook.add(item.pdvPhotoId);
        const numero = item.bookPageId
          ? numeroDaPagina.get(item.bookPageId)
          : undefined;
        // Item do modelo legado não tem página própria: fica só "Já usada".
        if (numero == null) continue;
        const paginas = usedInPages.get(item.pdvPhotoId) ?? [];
        if (!paginas.includes(numero)) paginas.push(numero);
        usedInPages.set(item.pdvPhotoId, paginas);
      }
      for (const paginas of usedInPages.values()) paginas.sort((a, b) => a - b);
    }

    return {
      photos: photos
        .filter((photo) => photo.photos[0])
        .map((photo) => ({
          id: photo.id,
          photoKey: photo.photos[0],
          code: photo.code,
          promoterName: photo.promoterName,
          capturedAt: photo.capturedAt.toISOString(),
          capturedCity: photo.capturedCity,
          capturedState: photo.capturedState,
          mediaTypeId: photo.mediaTypeId,
          mediaType: photo.mediaType,
          liked: photo.liked,
          storeName: photo.store.name,
          supplierName: photo.supplier?.name ?? null,
          usedInBook: usedInBook.has(photo.id),
          usedInPages: usedInPages.get(photo.id) ?? [],
        })),
    };
  });
