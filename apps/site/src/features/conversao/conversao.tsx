"use client";

import type { SiteConversao } from "@nerp/site-content";
import { AstroAutomatico } from "./astro-automatico";
import { AvisoDeSaida } from "./aviso-de-saida";
import { BarraFixa } from "./barra-fixa";
import "./conversao.css";

/** Os recursos de conversão, montados uma vez no layout. */
export function Conversao({
  conversao,
  whatsappHref,
  astroAtivo,
}: {
  conversao: SiteConversao;
  whatsappHref: string;
  astroAtivo: boolean;
}) {
  return (
    <>
      <AvisoDeSaida
        config={conversao.saida}
        whatsappHref={whatsappHref}
        astroAtivo={astroAtivo}
      />
      <BarraFixa
        config={conversao.barra}
        whatsappHref={whatsappHref}
        astroAtivo={astroAtivo}
      />
      <AstroAutomatico config={conversao.astro} astroAtivo={astroAtivo} />
    </>
  );
}
