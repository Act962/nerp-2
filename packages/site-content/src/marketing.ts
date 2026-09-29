import { z } from "zod";

/**
 * Os pixels e tags de anúncio do site, e o formato da coleta de métricas.
 *
 * Os IDs são conferidos pelo FORMATO nas duas pontas, e isso não é zelo: eles
 * acabam interpolados dentro de um `<script>` inline no site. Um ID livre é
 * uma porta para qualquer um que chegue ao admin injetar JavaScript em todo
 * visitante — o Órbita Pages aceita texto solto ali, e é o que não repetimos.
 */

export const META_PIXEL_RE = /^\d{8,20}$/;
/** GA4 (`G-`), Google Ads (`AW-`) e a tag do Google (`GT-`). */
export const GOOGLE_TAG_RE = /^(G|AW|GT)-[A-Z0-9]{4,20}$/;
export const GTM_RE = /^GTM-[A-Z0-9]{4,12}$/;

const opcional = (re: RegExp, mensagem: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || re.test(v), mensagem)
    .default("");

export const siteMarketingSchema = z.object({
  metaPixelId: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || META_PIXEL_RE.test(v),
      "O ID do pixel da Meta tem só números",
    )
    .default(""),
  googleAnalyticsId: opcional(
    GOOGLE_TAG_RE,
    "Use o ID da métrica do GA4, no formato G-XXXXXXX",
  ),
  googleAdsId: opcional(
    GOOGLE_TAG_RE,
    "Use o ID de conversão do Google Ads, no formato AW-XXXXXXX",
  ),
  gtmId: opcional(GTM_RE, "O contêiner do GTM tem o formato GTM-XXXXXXX"),
});

export type SiteMarketing = z.infer<typeof siteMarketingSchema>;

export const MARKETING_VAZIO: SiteMarketing = {
  metaPixelId: "",
  googleAnalyticsId: "",
  googleAdsId: "",
  gtmId: "",
};

/** Qualquer coisa fora do formato vira vazio: é melhor sem pixel que com XSS. */
export function lerMarketing(valor: unknown): SiteMarketing {
  const lido = siteMarketingSchema.safeParse(valor ?? {});
  return lido.success ? lido.data : MARKETING_VAZIO;
}

export function temPixel(marketing: SiteMarketing): boolean {
  return Boolean(
    marketing.metaPixelId ||
      marketing.googleAnalyticsId ||
      marketing.googleAdsId ||
      marketing.gtmId,
  );
}

/*
  A coleta.

  O navegador manda tudo o que sabe da visita a cada envio, e o servidor
  grava de forma idempotente: a visita nasce no primeiro envio e só tem o
  `lastSeenAt` renovado depois; a página vista guarda sempre o MAIOR tempo e o
  MAIOR scroll recebidos. É isso que deixa o beacon ser mandado de novo — ao
  trocar de aba, no pulso de 30s, ao sair — sem contar nada em dobro, e sem
  depender da ordem em que eles chegam.
*/

const ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
const id = z.string().regex(ID_RE);
const curto = (max: number) => z.string().trim().max(max);

export const DISPOSITIVOS = ["desktop", "tablet", "mobile"] as const;

export const coletaSchema = z.object({
  visita: z.object({
    id,
    visitanteId: id,
    entrada: curto(500),
    /** Só o domínio de quem mandou — o endereço inteiro pode trazer dado pessoal. */
    origem: curto(200).optional(),
    utmSource: curto(120).optional(),
    utmMedium: curto(120).optional(),
    utmCampaign: curto(200).optional(),
    utmContent: curto(200).optional(),
    utmTerm: curto(200).optional(),
    dispositivo: z.enum(DISPOSITIVOS),
  }),
  paginas: z
    .array(
      z.object({
        id,
        path: curto(500),
        titulo: curto(200).optional(),
        /** Tempo ATIVO: aba visível e alguém mexendo, não relógio de parede. */
        segundos: z
          .number()
          .int()
          .min(0)
          .max(24 * 60 * 60),
        scroll: z.number().int().min(0).max(100),
      }),
    )
    .max(10)
    .default([]),
  eventos: z
    .array(
      z.object({
        path: curto(500),
        rotulo: curto(120),
        destino: curto(300).optional(),
      }),
    )
    .max(20)
    .default([]),
});

export type ColetaDeVisita = z.input<typeof coletaSchema>;

/** O cabeçalho em que o proxy do site repassa a visita ao chat do Astro. */
export const CABECALHO_DA_VISITA = "x-site-visita";

export function idDeVisitaValido(valor: string | null | undefined): boolean {
  return typeof valor === "string" && ID_RE.test(valor);
}
