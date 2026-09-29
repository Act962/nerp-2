import type { SiteMarketing } from "@nerp/site-content";
import { GOOGLE_TAG_RE, GTM_RE, META_PIXEL_RE } from "@nerp/site-content";

/**
 * Os pixels da Meta e do Google, montados em código e não por `<script>`
 * inline com o ID interpolado.
 *
 * Os trechos oficiais fazem só duas coisas: criar uma fila (`fbq`, `gtag`,
 * `dataLayer`) e baixar o script de verdade. Fazendo as duas aqui, o ID nunca
 * vira texto de código — some a porta de XSS que o trecho colado abre — e a
 * fila existe ANTES do primeiro evento, sem corrida com o carregamento.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

function carregarScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

let iniciado = false;

export function iniciarPixels(marketing: SiteMarketing) {
  if (iniciado) return;
  iniciado = true;

  const gtm = GTM_RE.test(marketing.gtmId) ? marketing.gtmId : "";
  const tags = [marketing.googleAnalyticsId, marketing.googleAdsId].filter(
    (id) => GOOGLE_TAG_RE.test(id),
  );
  const meta = META_PIXEL_RE.test(marketing.metaPixelId)
    ? marketing.metaPixelId
    : "";

  if (gtm || tags.length > 0) window.dataLayer = window.dataLayer ?? [];

  if (gtm) {
    window.dataLayer?.push({ "gtm.start": Date.now(), event: "gtm.js" });
    carregarScript(`https://www.googletagmanager.com/gtm.js?id=${gtm}`);
  }

  if (tags.length > 0) {
    if (!window.gtag) {
      window.gtag = function gtag() {
        // O gtag.js só reconhece o objeto `arguments` na fila — um array com
        // os mesmos itens é ignorado em silêncio.
        // biome-ignore lint/complexity/noArguments: exigência do gtag.js
        window.dataLayer?.push(arguments);
      };
    }
    window.gtag("js", new Date());
    // O page_view sai à mão a cada navegação: o site é SPA, e o automático
    // só contaria a primeira página.
    for (const tag of tags) {
      window.gtag("config", tag, { send_page_view: false });
    }
    carregarScript(`https://www.googletagmanager.com/gtag/js?id=${tags[0]}`);
  }

  if (meta) {
    if (!window.fbq) {
      const fbq = ((...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
      }) as Fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;
    }
    window.fbq("init", meta);
    carregarScript("https://connect.facebook.net/en_US/fbevents.js");
  }
}

/** Sem pixel iniciado (sem ID, ou sem consentimento), não faz nada. */
export function pixelPageView(path: string) {
  if (!iniciado) return;
  window.fbq?.("track", "PageView");
  window.gtag?.("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
  window.dataLayer?.push({ event: "orbita_page_view", page_path: path });
}

/**
 * O Astro registrou um lead. É o evento que otimiza campanha de conversão: o
 * `Lead` na Meta e o `generate_lead` no GA4 (que o Google Ads importa como
 * conversão).
 */
export function pixelLead() {
  if (!iniciado) return;
  window.fbq?.("track", "Lead");
  window.gtag?.("event", "generate_lead", { lead_source: "astro" });
  window.dataLayer?.push({ event: "generate_lead", lead_source: "astro" });
}
