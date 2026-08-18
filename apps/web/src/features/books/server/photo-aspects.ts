import "server-only";

import { constructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/db";
import { orientationFromAspect } from "./distribute-photos";
import { readPhotoAspect } from "./crop-photo";

interface PhotoRow {
  id: string;
  photos: string[];
  photoAspect: number | null;
}

// Garante que cada PdvPhoto tenha `photoAspect` cacheado. Na 1ª vez lê as dims
// via sharp (baixa a imagem) e grava; depois é instantâneo. Retorna um mapa
// pdvPhotoId → orientação, usado pelo auto-gerador/preview.
export async function ensurePhotoOrientations(
  photos: PhotoRow[],
): Promise<Map<string, "LANDSCAPE" | "PORTRAIT">> {
  const result = new Map<string, "LANDSCAPE" | "PORTRAIT">();
  const toDetect = photos.filter((p) => p.photoAspect == null && p.photos[0]);

  // Detecta em paralelo, mas com um limite pra não abrir centenas de fetches.
  const CONCURRENCY = 8;
  for (let i = 0; i < toDetect.length; i += CONCURRENCY) {
    const batch = toDetect.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (p) => {
        const aspect = await readPhotoAspect(constructUrl(p.photos[0]));
        if (aspect) {
          p.photoAspect = aspect;
          await prisma.pdvPhoto
            .update({ where: { id: p.id }, data: { photoAspect: aspect } })
            .catch(() => {});
        }
      }),
    );
  }

  for (const p of photos) {
    result.set(p.id, orientationFromAspect(p.photoAspect));
  }
  return result;
}
