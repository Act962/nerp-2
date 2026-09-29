"use client";

import type { ColetaDeVisita } from "@nerp/site-content";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { gravarLocal, lerLocal } from "./armazenamento";
import { COOKIE_DA_VISITA } from "./cookie";
import { type DetalheDeMetrica, EVENTO_DE_METRICA } from "./evento";

/**
 * O medidor de visitas do site — o que alimenta a aba Marketing do admin.
 *
 * Próprio, anônimo e sem terceiro: não depende do aviso de cookies. O que ele
 * guarda neste navegador é um número aleatório de visitante e a visita atual.
 *
 * Três decisões que diferem do Órbita Pages, de onde a ideia veio:
 *  - TEMPO ATIVO, não relógio: só conta com a aba à frente e alguém mexendo
 *    no último minuto. A aba esquecida aberta a tarde toda não vira "8h na
 *    página".
 *  - VISITA de verdade: termina após 30 min parada ou quando chega por outra
 *    campanha. Sem ela não há rejeição, visitante único nem página de saída.
 *  - REENVIO idempotente: o mesmo estado sai ao trocar de aba, a cada 30s e
 *    ao sair; o servidor fica com o maior valor. Perder um beacon custa uns
 *    segundos, nunca a página inteira.
 */

const CHAVE_VISITANTE = "orbita:visitante";
const CHAVE_VISITA = "orbita:visita";
const CHAVE_DESLIGADO = "orbita:nao-medir";

const INATIVIDADE_DA_VISITA = 30 * 60 * 1000;
/** Sem mexer por mais que isto, o relógio da página para. */
const OCIOSO = 60 * 1000;
const PULSO = 30 * 1000;

type Visita = ColetaDeVisita["visita"] & { ultimo: number };
type Pagina = ColetaDeVisita["paginas"] extends Array<infer P> | undefined
  ? P
  : never;
type Evento = ColetaDeVisita["eventos"] extends Array<infer E> | undefined
  ? E
  : never;

function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function dispositivo(): Visita["dispositivo"] {
  const largura = window.innerWidth;
  if (largura < 640) return "mobile";
  if (largura < 1024) return "tablet";
  return "desktop";
}

/** Quem pediu para não ser medido — o time, abrindo o site com `?nao-medir=1`. */
function desligado(): boolean {
  const pedido = new URLSearchParams(window.location.search).get("nao-medir");
  if (pedido === "1") gravarLocal(CHAVE_DESLIGADO, "1");
  if (pedido === "0") gravarLocal(CHAVE_DESLIGADO, null);
  return lerLocal(CHAVE_DESLIGADO) === "1" || navigator.webdriver === true;
}

function visitante(): string {
  const salvo = lerLocal(CHAVE_VISITANTE);
  if (salvo) return salvo;
  const novo = novoId();
  gravarLocal(CHAVE_VISITANTE, novo);
  return novo;
}

/** A campanha da URL. Clique de anúncio sem UTM ainda diz de onde veio. */
function campanhaDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const valor = (nome: string) => params.get(nome)?.trim() || undefined;
  const utm = {
    utmSource: valor("utm_source"),
    utmMedium: valor("utm_medium"),
    utmCampaign: valor("utm_campaign"),
    utmContent: valor("utm_content"),
    utmTerm: valor("utm_term"),
  };
  if (!utm.utmSource && params.has("gclid")) {
    return { ...utm, utmSource: "google", utmMedium: utm.utmMedium ?? "cpc" };
  }
  if (!utm.utmSource && params.has("fbclid")) {
    return {
      ...utm,
      utmSource: "facebook",
      utmMedium: utm.utmMedium ?? "social",
    };
  }
  return utm;
}

/** Só o domínio de quem mandou, e só se não for o próprio site. */
function origemExterna(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).host;
    if (!host || host === window.location.host) return undefined;
    return host.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function lerVisita(): Visita | null {
  try {
    const salva = JSON.parse(lerLocal(CHAVE_VISITA) ?? "null") as Visita | null;
    return salva?.id ? salva : null;
  } catch {
    return null;
  }
}

function visitaAtual(): Visita {
  const agora = Date.now();
  const campanha = campanhaDaUrl();
  const salva = lerVisita();

  // Chegar por outra campanha abre visita nova, como no GA: senão o clique no
  // anúncio de hoje seria creditado à busca orgânica de 10 minutos atrás.
  const outraCampanha =
    campanha.utmSource !== undefined &&
    (campanha.utmSource !== salva?.utmSource ||
      campanha.utmCampaign !== salva?.utmCampaign);

  if (salva && agora - salva.ultimo < INATIVIDADE_DA_VISITA && !outraCampanha) {
    return salva;
  }

  const nova: Visita = {
    id: novoId(),
    visitanteId: visitante(),
    entrada: window.location.pathname,
    origem: origemExterna(),
    ...campanha,
    dispositivo: dispositivo(),
    ultimo: agora,
  };
  gravarLocal(CHAVE_VISITA, JSON.stringify(nova));
  return nova;
}

function renovar(visita: Visita) {
  visita.ultimo = Date.now();
  gravarLocal(CHAVE_VISITA, JSON.stringify(visita));
  // A validade do cookie acompanha a da visita: expirou uma, expirou a outra.
  // biome-ignore lint/suspicious/noDocumentCookie: a Cookie Store API não existe no Safari nem no Firefox
  document.cookie = `${COOKIE_DA_VISITA}=${visita.id}; path=/; max-age=${INATIVIDADE_DA_VISITA / 1000}; samesite=lax`;
}

/** Quanto da página já passou pela tela, de 0 a 100. */
function scrollAtual(): number {
  const total = document.documentElement.scrollHeight;
  if (total <= 0) return 100;
  const visto = ((window.scrollY + window.innerHeight) / total) * 100;
  // Rodapé de 1–2% que nunca aparece inteiro não pode impedir o "chegou ao fim".
  return visto >= 98 ? 100 : Math.max(0, Math.round(visto));
}

/** O texto que a pessoa viu no botão ou link, ou o rótulo explícito. */
function rotuloDoClique(elemento: HTMLElement): string {
  const texto =
    elemento.dataset.metrica ||
    elemento.getAttribute("aria-label") ||
    elemento.innerText ||
    elemento.getAttribute("title") ||
    "";
  return texto.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Para onde o link leva, sem dado pessoal: e-mail e telefone viram só o tipo,
 * e de endereço externo fica o domínio e o caminho, sem a query.
 */
function destinoDoClique(elemento: HTMLElement): string | undefined {
  if (!(elemento instanceof HTMLAnchorElement) || !elemento.href) {
    return undefined;
  }
  const href = elemento.href;
  if (href.startsWith("mailto:")) return "e-mail";
  if (href.startsWith("tel:")) return "telefone";
  try {
    const url = new URL(href);
    if (url.host === window.location.host) return `${url.pathname}${url.hash}`;
    return `${url.host.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return undefined;
  }
}

function enviarAgora(coleta: ColetaDeVisita) {
  const corpo = JSON.stringify(coleta);
  try {
    if (
      navigator.sendBeacon?.(
        "/api/metricas",
        new Blob([corpo], { type: "application/json" }),
      )
    ) {
      return;
    }
  } catch {
    // cai no fetch
  }
  fetch("/api/metricas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: corpo,
    keepalive: true,
  }).catch(() => {});
}

export function Medidor() {
  const pathname = usePathname();

  const estado = useRef<{
    ativo: boolean;
    visita: Visita | null;
    pagina: Pagina | null;
    eventos: Evento[];
    ultimaInteracao: number;
    ultimoEnvio: string;
  }>({
    ativo: false,
    visita: null,
    pagina: null,
    eventos: [],
    ultimaInteracao: 0,
    ultimoEnvio: "",
  });

  const enviar = useRef((forcar = false) => {
    const atual = estado.current;
    if (!atual.ativo || !atual.pagina) return;

    // A visita pode ter expirado com a aba parada: a mesma página, voltando
    // uma hora depois, é o começo de outra visita.
    const visita =
      atual.visita && Date.now() - atual.visita.ultimo < INATIVIDADE_DA_VISITA
        ? atual.visita
        : visitaAtual();
    if (visita !== atual.visita) {
      atual.visita = visita;
      atual.pagina = { ...atual.pagina, id: novoId(), segundos: 0 };
    }

    const assinatura = `${atual.pagina.id}:${atual.pagina.segundos}:${atual.pagina.scroll}`;
    if (
      !forcar &&
      atual.eventos.length === 0 &&
      assinatura === atual.ultimoEnvio
    ) {
      return;
    }
    atual.ultimoEnvio = assinatura;

    const { ultimo: _ultimo, ...dadosDaVisita } = visita;
    renovar(visita);
    enviarAgora({
      visita: dadosDaVisita,
      paginas: [{ ...atual.pagina }],
      eventos: atual.eventos.splice(0, 20),
    });
  });

  // Os ouvintes da janela: montados uma vez, valem para todas as páginas.
  useEffect(() => {
    const atual = estado.current;
    if (desligado()) return;
    atual.ativo = true;
    atual.visita = visitaAtual();
    atual.ultimaInteracao = Date.now();

    const mexeu = () => {
      atual.ultimaInteracao = Date.now();
    };

    const relogio = window.setInterval(() => {
      const pagina = atual.pagina;
      if (!pagina || document.visibilityState !== "visible") return;
      if (Date.now() - atual.ultimaInteracao > OCIOSO) return;
      pagina.segundos += 1;
      // O título chega depois da navegação (o Next troca no commit); pegar no
      // primeiro segundo é o que garante o título da página certa.
      if (!pagina.titulo && document.title) {
        pagina.titulo = document.title.slice(0, 200);
      }
    }, 1000);

    const pulso = window.setInterval(() => {
      if (document.visibilityState === "visible") enviar.current();
    }, PULSO);

    const aoRolar = () => {
      mexeu();
      if (atual.pagina) {
        atual.pagina.scroll = Math.max(atual.pagina.scroll, scrollAtual());
      }
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") enviar.current();
      else mexeu();
    };

    const aoSair = () => enviar.current();

    let envioDeClique: number | undefined;
    const aoClicar = (evento: MouseEvent) => {
      mexeu();
      const alvo = (evento.target as HTMLElement | null)?.closest<HTMLElement>(
        "a, button, [data-metrica]",
      );
      if (!alvo || !atual.pagina) return;
      const rotulo = rotuloDoClique(alvo);
      if (!rotulo) return;
      atual.eventos.push({
        path: atual.pagina.path,
        rotulo,
        destino: destinoDoClique(alvo),
      });
      // Um link externo tira a pessoa do site: o clique sai já, não no pulso.
      window.clearTimeout(envioDeClique);
      envioDeClique = window.setTimeout(() => enviar.current(), 1500);
      if (alvo instanceof HTMLAnchorElement && alvo.target !== "_blank") {
        enviar.current();
      }
    };

    const aoRegistrar = (evento: Event) => {
      const { rotulo, destino } = (evento as CustomEvent<DetalheDeMetrica>)
        .detail;
      if (!atual.pagina || !rotulo) return;
      atual.eventos.push({ path: atual.pagina.path, rotulo, destino });
      window.clearTimeout(envioDeClique);
      envioDeClique = window.setTimeout(() => enviar.current(), 1500);
    };

    const opcoes = { passive: true } as const;
    window.addEventListener("scroll", aoRolar, opcoes);
    window.addEventListener("pointermove", mexeu, opcoes);
    window.addEventListener("pointerdown", mexeu, opcoes);
    window.addEventListener("keydown", mexeu, opcoes);
    window.addEventListener("touchstart", mexeu, opcoes);
    window.addEventListener("wheel", mexeu, opcoes);
    window.addEventListener("pagehide", aoSair);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    document.addEventListener("click", aoClicar, true);
    window.addEventListener(EVENTO_DE_METRICA, aoRegistrar);

    return () => {
      window.clearInterval(relogio);
      window.clearInterval(pulso);
      window.clearTimeout(envioDeClique);
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("pointermove", mexeu);
      window.removeEventListener("pointerdown", mexeu);
      window.removeEventListener("keydown", mexeu);
      window.removeEventListener("touchstart", mexeu);
      window.removeEventListener("wheel", mexeu);
      window.removeEventListener("pagehide", aoSair);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      document.removeEventListener("click", aoClicar, true);
      window.removeEventListener(EVENTO_DE_METRICA, aoRegistrar);
    };
  }, []);

  // Cada rota é uma página vista: fecha a anterior com o que ela acumulou e
  // registra a nova na hora — a visita conta mesmo se a pessoa sair já.
  useEffect(() => {
    const atual = estado.current;
    if (!atual.ativo || atual.pagina?.path === pathname) return;

    if (atual.pagina) enviar.current(true);
    atual.pagina = {
      id: novoId(),
      path: pathname,
      segundos: 0,
      scroll: scrollAtual(),
    };
    atual.ultimaInteracao = Date.now();
    enviar.current(true);
  }, [pathname]);

  return null;
}
