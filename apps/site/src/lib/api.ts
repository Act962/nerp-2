import "server-only";

import type {
  SiteBlock,
  SiteContent,
  SiteContentResponse,
  SitePageResponse,
  SiteSection,
} from "@nerp/site-content";
import { parseBlocks } from "@nerp/site-content";
import { DEFAULT_CONTENT } from "../orbita/data/content";
import { findDefaultPage } from "./default-pages";

/**
 * De onde o site lê o conteúdo.
 *
 * O `apps/web` é dono do banco, do login e do storage; este app é dono do
 * desenho. A conversa entre os dois é HTTP puro — mesma escolha que o
 * `apps/desktop` já faz — e por isso este app não carrega Prisma nem
 * better-auth.
 *
 * A regra que vale mais do que qualquer uma aqui: **o site nunca cai porque o
 * ERP caiu**. Toda falha — rede, 503, JSON torto, tabela ainda não migrada —
 * volta para `DEFAULT_CONTENT`, que é o catálogo que mora neste app. O
 * visitante vê o site de sempre; quem perde é só a edição feita no admin.
 */

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** Curto de propósito: uma home lenta é pior do que um menu de ontem. */
const TIMEOUT_MS = 4000;

/*
  O `apps/web` fora do ar é um estado PREVISTO, não um defeito: o site tem o
  próprio conteúdo de reserva e continua de pé. Por isso o aviso é `warn` e não
  `error` — em desenvolvimento, um `console.error` vira o painel vermelho do
  Next e passa a impressão de página quebrada quando nada quebrou.

  E ele sai uma vez por endereço: sem isto, cada visita à home repetiria a
  mesma linha e esconderia o que importa no terminal.
*/
const jaAvisado = new Set<string>();

function avisar(path: string, motivo: string) {
  if (jaAvisado.has(path)) return;
  jaAvisado.add(path);
  console.warn(
    `[site] ${path} não respondeu (${motivo}). Usando o conteúdo padrão do próprio app.`,
  );
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${APP_URL}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // A borda do próprio `apps/web` já guarda por 60s; aqui repetimos o
      // intervalo para o site não bater a cada visita.
      next: { revalidate: 60 },
    });
    // 404 é resposta legítima: a página não está publicada. Não é falha de
    // comunicação e não merece aviso nenhum.
    if (!response.ok) {
      if (response.status !== 404) avisar(path, `HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    avisar(path, error instanceof Error ? error.message : "sem conexão");
    return null;
  }
}

/** Painel vazio cai no padrão; painel com itens manda. */
function applyFallback(data: SiteContentResponse | null): SiteContent {
  if (!data) return DEFAULT_CONTENT;

  return {
    solucoes: data.solucoes.length ? data.solucoes : DEFAULT_CONTENT.solucoes,
    segmentos: data.segmentos.length
      ? data.segmentos
      : DEFAULT_CONTENT.segmentos,
    sobre: data.sobre.groups.length
      ? {
          groups: data.sobre.groups,
          highlight: data.sobre.highlight ?? DEFAULT_CONTENT.sobre.highlight,
        }
      : DEFAULT_CONTENT.sobre,
    stats: data.stats.length ? data.stats : DEFAULT_CONTENT.stats,
    contact: data.contact ?? DEFAULT_CONTENT.contact,
    whatsapp: data.whatsapp
      ? {
          number: data.whatsapp.number,
          href: `https://wa.me/${data.whatsapp.number}`,
          label: data.whatsapp.label,
        }
      : DEFAULT_CONTENT.whatsapp,
  };
}

export async function getSiteContent(): Promise<SiteContent> {
  return applyFallback(await getJson<SiteContentResponse>("/api/site/content"));
}

export type ProductPage = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  blocks: SiteBlock[];
};

export async function getProductPage(
  section: SiteSection,
  slug: string,
): Promise<ProductPage | null> {
  const data = await getJson<SitePageResponse>(
    `/api/site/page/${encodeURIComponent(slug)}?section=${section}`,
  );
  // Sem resposta do `apps/web` — desligado, sem banco, ou página ainda em
  // rascunho — vale a versão que mora no código. O que está publicado no
  // admin sempre ganha desta.
  if (!data) {
    const fallback = findDefaultPage(section, slug);
    return fallback ? { ...fallback, ogImage: "" } : null;
  }

  return {
    slug: data.slug,
    title: data.title,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    ogImage: data.ogImage,
    // Validado de novo deste lado: entre os dois apps há uma rede, e confiar
    // no formato sem conferir é o que faz uma página inteira cair por um campo.
    blocks: parseBlocks(data.blocks),
  };
}

/** Para onde "Entrar" e "Começar gratuitamente" levam: o ERP. */
export const APP_LINKS = {
  login: `${APP_URL}/login`,
  signup: `${APP_URL}/cadastro`,
};
