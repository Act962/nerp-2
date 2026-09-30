import "server-only";
import prisma from "@/lib/db";

export type OfertaDaVitrine = { nome: string; shareToken: string };

/**
 * Os catálogos promocionais do botão "Ofertas", na ordem escolhida.
 *
 * Fica só o que tem link público ligado: `disable-share` apaga o
 * `shareToken` do config, e um link sem ele é 404 para o visitante.
 */
export async function ofertasDaVitrine(
  organizationId: string,
  ids: string[],
): Promise<OfertaDaVitrine[]> {
  if (ids.length === 0) return [];
  const catalogos = await prisma.promotionalCatalog.findMany({
    where: { id: { in: ids }, organizationId },
    select: { id: true, name: true, config: true },
  });
  return ids.flatMap((id) => {
    const catalogo = catalogos.find((atual) => atual.id === id);
    const config = (catalogo?.config ?? {}) as { shareToken?: unknown };
    return catalogo && typeof config.shareToken === "string"
      ? [{ nome: catalogo.name, shareToken: config.shareToken }]
      : [];
  });
}
