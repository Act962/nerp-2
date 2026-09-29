"use client";

import { type SiteMarketing, temPixel } from "@nerp/site-content";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { definirConsentimento, useConsentimento } from "./consentimento";
import { Medidor } from "./medidor";
import { iniciarPixels, pixelPageView } from "./pixels";
import "./marketing.css";

/**
 * Tudo que mede o site, montado uma vez no layout: o medidor próprio, sempre;
 * os pixels de anúncio, só com o "aceito"; e o aviso que pede esse aceite —
 * que só aparece se houver pixel cadastrado, porque sem pixel não há o que
 * consentir.
 */
export function Marketing({ marketing }: { marketing: SiteMarketing }) {
  const pathname = usePathname();
  const consentimento = useConsentimento();
  const comPixel = temPixel(marketing);
  const liberado = comPixel && consentimento === "aceito";

  useEffect(() => {
    if (liberado) iniciarPixels(marketing);
  }, [liberado, marketing]);

  useEffect(() => {
    if (liberado) pixelPageView(pathname);
  }, [liberado, pathname]);

  return (
    <>
      <Medidor />
      {comPixel && consentimento === null && <AvisoDeCookies />}
    </>
  );
}

function AvisoDeCookies() {
  return (
    <div
      className="o-cookies"
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
    >
      <p className="o-cookies__texto">
        Usamos cookies de marketing (Meta e Google) para medir nossos anúncios.
        As métricas do próprio site são anônimas e não dependem deste aceite.
      </p>
      <div className="o-cookies__acoes">
        <button
          type="button"
          className="o-cookies__botao"
          onClick={() => definirConsentimento("recusado")}
        >
          Recusar
        </button>
        <button
          type="button"
          className="o-cookies__botao o-cookies__botao--principal"
          onClick={() => definirConsentimento("aceito")}
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
