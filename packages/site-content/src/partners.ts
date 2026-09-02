import { z } from "zod";

/**
 * Os parceiros e as marcas do site institucional.
 *
 * São duas listas, e não uma com um campo de tipo, porque são duas coisas:
 *
 * - **parceiro** é um case. Tem história, e é a história que ocupa a tela nos
 *   cartões que aparecem sobre o planeta.
 * - **marca** é um logotipo num quadro de vidro sobre o mar. Não tem texto.
 *
 * Uma tabela só com `kind` pareceria mais econômica e deixaria metade dos
 * campos nulos em metade das linhas.
 *
 * Nada aqui tem valor padrão de conteúdo, e isso é deliberado: logotipo de
 * terceiro num site comercial afirma uma relação que só existe com
 * autorização. Lista vazia é o estado inicial correto, e quem consome trata o
 * vazio tirando a seção do ar — não desenhando quadros em branco.
 */

/** Foto e logo são opcionais: o cartão se vira com o que tiver. */
export const sitePartner = z.object({
  id: z.string(),
  name: z.string(),
  /** Key do R2 do retrato/foto do case. */
  photo: z.string().default(""),
  /** Key do R2 do logotipo. */
  logo: z.string().default(""),
  /** O parágrafo do case. Curto: ele vive dentro da viagem, não numa página. */
  story: z.string().default(""),
  href: z.string().default(""),
});

export const siteBrand = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().default(""),
  href: z.string().default(""),
});

export type SitePartner = z.infer<typeof sitePartner>;
export type SiteBrand = z.infer<typeof siteBrand>;

/** O que `/api/site/partners` devolve — as duas listas numa viagem só. */
export const sitePartnersResponse = z.object({
  partners: z.array(sitePartner).default([]),
  brands: z.array(siteBrand).default([]),
});

export type SitePartnersResponse = z.infer<typeof sitePartnersResponse>;

/** Entre os dois apps há uma rede: o formato é conferido dos dois lados. */
export function parsePartners(data: unknown): SitePartnersResponse {
  const parsed = sitePartnersResponse.safeParse(data);
  if (!parsed.success) return { partners: [], brands: [] };
  return {
    // Parceiro sem nome não desenha cartão nenhum; marca sem logo não desenha
    // quadro. Descartar aqui evita um buraco no meio da grade.
    partners: parsed.data.partners.filter((partner) => partner.name),
    brands: parsed.data.brands.filter((brand) => brand.logo && brand.name),
  };
}

/** A sequência inteira só existe se houver o que mostrar nela. */
export function hasPartnerContent(data: SitePartnersResponse) {
  return data.partners.length > 0 || data.brands.length > 0;
}
