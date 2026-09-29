"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GOOGLE_TAG_RE, GTM_RE, META_PIXEL_RE } from "@nerp/site-content";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSaveSiteMarketing,
  useSiteMarketing,
} from "../hooks/use-site-admin";

/*
  As mesmas regras do `siteMarketingSchema` de `@nerp/site-content`, que o
  servidor aplica de novo. Refeitas aqui porque o pacote traz a própria cópia
  do zod, e o `zodResolver` não aceita schema de outra instância.
*/
const idOpcional = (re: RegExp, mensagem: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || re.test(v), mensagem);

const pixelsSchema = z.object({
  metaPixelId: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || META_PIXEL_RE.test(v),
      "O ID do pixel da Meta tem só números",
    ),
  googleAnalyticsId: idOpcional(
    GOOGLE_TAG_RE,
    "Use o ID da métrica do GA4, no formato G-XXXXXXX",
  ),
  googleAdsId: idOpcional(
    GOOGLE_TAG_RE,
    "Use o ID de conversão do Google Ads, no formato AW-XXXXXXX",
  ),
  gtmId: idOpcional(GTM_RE, "O contêiner do GTM tem o formato GTM-XXXXXXX"),
});

type Valores = z.input<typeof pixelsSchema>;
type Saida = z.output<typeof pixelsSchema>;

const CAMPOS: Array<{
  nome: keyof Valores;
  rotulo: string;
  exemplo: string;
  ajuda: string;
}> = [
  {
    nome: "metaPixelId",
    rotulo: "Pixel da Meta (Facebook e Instagram)",
    exemplo: "123456789012345",
    ajuda:
      "Gerenciador de Eventos → Fontes de dados → o número do pixel. Dispara PageView a cada página e Lead quando o Astro registra um interessado.",
  },
  {
    nome: "googleAnalyticsId",
    rotulo: "Google Analytics 4",
    exemplo: "G-XXXXXXXXXX",
    ajuda:
      "Administrador → Fluxos de dados → ID da métrica. Recebe page_view a cada página e generate_lead na conversão.",
  },
  {
    nome: "googleAdsId",
    rotulo: "Google Ads (tag de conversão)",
    exemplo: "AW-XXXXXXXXXX",
    ajuda:
      "Ferramentas → Conversões → a tag do Google. Usa o mesmo gtag do Analytics; não precisa do GTM.",
  },
  {
    nome: "gtmId",
    rotulo: "Google Tag Manager",
    exemplo: "GTM-XXXXXXX",
    ajuda:
      "Para quem gerencia as tags pelo GTM. O site empurra orbita_page_view (a cada página) e generate_lead no dataLayer — use como gatilhos de evento personalizado.",
  },
];

/**
 * Os pixels e tags de anúncio do site.
 *
 * Só carregam no visitante que aceitou o aviso de cookies — as métricas da
 * aba ao lado são próprias e anônimas, e seguem valendo para quem recusou.
 */
export function SiteMarketingPixels() {
  const { marketing, isLoading } = useSiteMarketing();
  const save = useSaveSiteMarketing();

  const form = useForm<Valores, unknown, Saida>({
    resolver: zodResolver(pixelsSchema),
    defaultValues: {
      metaPixelId: "",
      googleAnalyticsId: "",
      googleAdsId: "",
      gtmId: "",
    },
  });

  useEffect(() => {
    if (marketing) form.reset(marketing);
  }, [marketing, form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pixels e tags de anúncio</CardTitle>
        <p className="text-sm text-muted-foreground">
          Preencha só o que usa. Os scripts entram em todas as páginas do site,
          mas apenas para quem aceitar os cookies de marketing no aviso do
          rodapé — é o que a LGPD pede para rastreamento de terceiros.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72" />
        ) : (
          <form
            onSubmit={form.handleSubmit((valores) =>
              save.mutate({ marketing: valores }),
            )}
            className="flex flex-col gap-6"
          >
            <FieldGroup className="grid gap-6 md:grid-cols-2">
              {CAMPOS.map((campo) => (
                <Controller
                  key={campo.nome}
                  name={campo.nome}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`pixel-${campo.nome}`}>
                        {campo.rotulo}
                      </FieldLabel>
                      <Input
                        {...field}
                        id={`pixel-${campo.nome}`}
                        placeholder={campo.exemplo}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldDescription>{campo.ajuda}</FieldDescription>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              ))}
            </FieldGroup>
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar pixels"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
