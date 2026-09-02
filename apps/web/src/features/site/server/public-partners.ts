import "server-only";

import type { SitePartnersResponse } from "@nerp/site-content";
import prisma from "@/lib/db";

/**
 * Os parceiros e as marcas publicados, do jeito que saem do banco.
 *
 * Sem fallback: lista vazia volta vazia. É o `apps/site` que decide o que
 * fazer com o vazio — e o que ele faz é tirar a seção da viagem, porque quadro
 * de logotipo em branco parece site inacabado.
 *
 * As duas listas vão na mesma resposta para o site não pagar duas viagens de
 * rede numa página que precisa estar montada no HTML que chega.
 */
export async function getPublicSitePartners(): Promise<SitePartnersResponse> {
  const [partners, brands] = await Promise.all([
    prisma.sitePartner.findMany({
      where: { visible: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        photo: true,
        logo: true,
        story: true,
        href: true,
      },
    }),
    prisma.siteBrand.findMany({
      where: { visible: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, logo: true, href: true },
    }),
  ]);

  // `null` no banco vira string vazia no contrato: o site testa presença, e
  // um campo que às vezes é null e às vezes "" obrigaria a testar as duas.
  return {
    partners: partners.map((partner) => ({
      ...partner,
      photo: partner.photo ?? "",
      logo: partner.logo ?? "",
      href: partner.href ?? "",
    })),
    brands: brands.map((brand) => ({ ...brand, href: brand.href ?? "" })),
  };
}
