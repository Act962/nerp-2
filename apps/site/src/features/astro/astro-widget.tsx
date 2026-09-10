"use client";

import { AstroWidget as Widget } from "@nerp/astro-widget";
import { useMemo } from "react";
import { findToolBySlug } from "@/orbita/data/catalog";
import { useSiteContent } from "@/orbita/lib/content-context";
import type { PaginaDoAstro } from "./pagina";

/**
 * O consultor no site.
 *
 * O widget em si é o `@nerp/astro-widget`, o mesmo que o nerp monta dentro
 * do sistema. O que é do site fica aqui: ligado/desligado e a tabela de
 * preços vindos do painel, o WhatsApp como saída humana, e de que produto a
 * página fala.
 *
 * O POST vai para `/api/astro/chat` do próprio site, que repassa ao `apps/web`.
 * Mesma origem: sem CORS, sem preflight, e o segredo fica no servidor.
 */
export function AstroWidget({ pagina }: { pagina?: PaginaDoAstro }) {
  const { astro, whatsapp } = useSiteContent();

  /*
    De que produto esta página fala.

    Nem toda página é de solução: segmentos e o método não têm ferramenta, e
    aí a abertura do painel volta a ser a geral.
  */
  const produto = useMemo(() => {
    const ferramenta = pagina ? findToolBySlug(pagina.slug) : null;
    if (!ferramenta) return null;
    return {
      nome: ferramenta.name,
      funcionalidades: ferramenta.features.map((item) => item.title),
    };
  }, [pagina]);

  return (
    <Widget
      api="/api/astro/chat"
      ativo={astro.ativo}
      pagina={pagina}
      produto={produto}
      precos={Boolean(astro.precos)}
      whatsappHref={whatsapp.href}
    />
  );
}
