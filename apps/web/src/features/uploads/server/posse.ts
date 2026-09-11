import "server-only";

import prisma from "@/lib/db";

/**
 * De quem é um objeto do bucket.
 *
 * Objetos novos nascem com o id da organização como prefixo
 * (`<orgId>/<uuid>-<nome>`), e a posse é só o prefixo. Os antigos não têm
 * prefixo nenhum — a única prova de posse é a chave estar gravada em alguma
 * linha da organização. A lista abaixo é dos campos que guardam chave do R2;
 * chave que não aparece em nenhum deles não é de ninguém e não se apaga por
 * esta rota.
 */

export function prefixoDaOrg(organizationId: string): string {
  return `${organizationId}/`;
}

export function chaveTemPrefixoDaOrg(
  key: string,
  organizationId: string,
): boolean {
  return key.startsWith(prefixoDaOrg(organizationId));
}

export async function chavePertenceAOrg(
  organizationId: string,
  key: string,
): Promise<boolean> {
  if (chaveTemPrefixoDaOrg(key, organizationId)) return true;
  // Chave com prefixo de OUTRA organização nunca é desta, seja qual for a
  // referência: prefixo é a prova mais forte.
  if (key.includes("/") && !key.startsWith(`${organizationId}/`)) return false;

  const where = { organizationId };
  const contagens = await Promise.all([
    prisma.organization.count({ where: { id: organizationId, logo: key } }),
    prisma.product.count({
      where: { ...where, OR: [{ thumbnail: key }, { images: { has: key } }] },
    }),
    prisma.category.count({ where: { ...where, image: key } }),
    prisma.supplier.count({
      where: { ...where, OR: [{ logo: key }, { actionCodeImage: key }] },
    }),
    prisma.brand.count({ where: { ...where, logo: key } }),
    prisma.distributor.count({ where: { ...where, logo: key } }),
    prisma.store.count({ where: { ...where, coverImageKey: key } }),
    prisma.pdvPhoto.count({ where: { ...where, photos: { has: key } } }),
  ]);

  return contagens.some((n) => n > 0);
}
