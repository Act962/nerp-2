"use client";

import { abrirAstro } from "@nerp/astro-widget";
import type { SiteConversao } from "@nerp/site-content";
import { useEffect } from "react";
import { registrarMetrica } from "@/features/metricas/evento";
import { jaVisto, marcarVisto } from "./memoria";

const CHAVE = "orbita:astro-automatico";

/**
 * Abre o painel do Astro sozinho, uma vez por visita.
 *
 * O relógio é da visita, não da página: montado no layout, ele sobrevive à
 * navegação — quem passeia por três páginas em 15s não recebe o painel na
 * cara a cada troca.
 */
export function AstroAutomatico({
  config,
  astroAtivo,
}: {
  config: SiteConversao["astro"];
  astroAtivo: boolean;
}) {
  useEffect(() => {
    if (!astroAtivo || !config.autoAbrir) return;
    if (jaVisto(CHAVE, "visita")) return;
    if (!config.noCelular && window.matchMedia("(max-width: 640px)").matches) {
      return;
    }

    const relogio = window.setTimeout(() => {
      // Aviso de cookies ou de saída na tela: é a vez deles.
      if (document.querySelector(".o-cookies, .o-saida")) return;
      marcarVisto(CHAVE, "visita");
      abrirAstro();
      registrarMetrica("Astro: aberto sozinho");
    }, config.aposSegundos * 1000);

    return () => window.clearTimeout(relogio);
  }, [astroAtivo, config.autoAbrir, config.aposSegundos, config.noCelular]);

  return null;
}
