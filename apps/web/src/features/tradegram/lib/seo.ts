import type { Metadata } from "next";

/**
 * O SEO do TradeGram público.
 *
 * O TradeGram é o único pedaço do `apps/web`, fora das lojas, que é conteúdo
 * de verdade: "o mapa do trade marketing do Brasil", aberto e sem login. A
 * raiz do app é `noindex` por padrão (ver `src/app/layout.tsx`), então é aqui
 * que ele diz que é público — e é aqui que se separa o que é conteúdo (o mapa,
 * o perfil de um grupo, de uma loja, de uma empresa) do que é tela de app (a
 * busca, o login, os favoritos, o leitor de código de barras).
 *
 * **Limite conhecido, e ele é grande.** Todas essas páginas são renderizadas no
 * cliente: o HTML que o rastreador recebe tem `<title>` e `<meta>`, e mais
 * nada. O Google executa JavaScript, mas numa segunda passada, mais lenta e
 * menos confiável — e o Bing quase não executa. Enquanto o conteúdo não vier
 * do servidor, o metadata correto é o teto do que dá para conseguir aqui.
 */

/** O `robots` de uma página pública do TradeGram que é conteúdo. */
export const ROBOTS_PUBLICO: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

/**
 * O `robots` das telas de app do TradeGram.
 *
 * Busca, login, favoritos, leitor de código: não têm conteúdo próprio — o
 * resultado da busca muda a cada consulta, os favoritos são de uma pessoa e o
 * leitor precisa de uma câmera. `follow` fica ligado porque os links delas
 * levam a perfis, que são conteúdo.
 */
export const ROBOTS_TELA_DE_APP: Metadata["robots"] = {
  index: false,
  follow: true,
};

/**
 * O endereço público do TradeGram.
 *
 * Sai de `NEXT_PUBLIC_DOMAIN` — o mesmo que o resto do app já usa para montar
 * link absoluto. Sem ele, nada de canonical: um canonical apontando para
 * `localhost` tira a página do índice, o que é pior do que não ter nenhum.
 */
export function tradegramCanonical(path: string): string | undefined {
  const base = (process.env.NEXT_PUBLIC_DOMAIN ?? "").replace(/\/$/, "");
  if (!base || base.includes("localhost")) return undefined;
  return `${base}${path}`;
}
