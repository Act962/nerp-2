import type { Metadata } from "next";

/**
 * O endereço canônico de uma loja.
 *
 * Existe por causa de um problema real: **o mesmo catálogo responde em dois
 * endereços**. O `src/middleware.ts` reescreve tanto `loja.dominio.com/...`
 * quanto `dominio.com/catalogo/<slug>/...` para a mesma árvore — dois URLs,
 * uma página. Para o buscador isso é conteúdo duplicado, e ele escolhe sozinho
 * qual manter (às vezes o errado, e sempre dividindo a autoridade entre os
 * dois).
 *
 * O canonical resolve dizendo qual é o oficial. Escolhemos a forma de
 * SUBDOMÍNIO porque é o endereço próprio da loja; a forma em caminho é a
 * degradação para quem não tem subdomínio configurado no DNS.
 */

/**
 * `customDomain` NÃO entra nesta conta.
 *
 * O campo existe no `Organization` e é único, mas o middleware não roteia por
 * ele — só por subdomínio. Um canonical apontando para um domínio que ainda
 * não serve a página seria pior do que não ter canonical nenhum: mandaria o
 * Google indexar um endereço morto. Quando o roteamento por domínio próprio
 * existir, é aqui que ele entra.
 */
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";

/** Local não tem TLS; qualquer outra coisa em produção tem. */
function protocolo(host: string): string {
  const semPorta = host.split(":")[0];
  const local =
    semPorta === "localhost" ||
    semPorta.endsWith(".localhost") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(semPorta);
  return local ? "http" : "https";
}

/**
 * A raiz da loja, ou `null` quando não dá para saber.
 *
 * `null` e não um palpite: sem `NEXT_PUBLIC_BASE_DOMAIN` o melhor que se
 * conseguiria montar é `http://localhost/...`, e um canonical apontando para
 * localhost tira a página do índice. Não emitir canonical é ruim; emitir um
 * errado é pior.
 */
export function storeBaseUrl(subdomain: string): string | null {
  if (!BASE_DOMAIN || !subdomain) return null;
  return `${protocolo(BASE_DOMAIN)}://${subdomain}.${BASE_DOMAIN}`;
}

/** O endereço canônico de uma página da loja. `path` começa com "/". */
export function storeCanonical(
  subdomain: string,
  path = "/",
): string | undefined {
  const base = storeBaseUrl(subdomain);
  if (!base) return undefined;
  return path === "/" ? base : `${base}${path}`;
}

/**
 * O `robots` de uma página de loja que DEVE ser indexada.
 *
 * A raiz do app é `noindex` por padrão (ver `src/app/layout.tsx`), então a
 * vitrine precisa dizer explicitamente que é pública. É o desenho certo: o ERP
 * tem 131 páginas e só um punhado é conteúdo — o padrão protege as outras 120
 * sem depender de alguém lembrar.
 */
export const ROBOTS_VITRINE: Metadata["robots"] = {
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
 * O `robots` das telas de compra e de conta.
 *
 * Carrinho, checkout, login e conta não são conteúdo: são estado de uma
 * pessoa. Indexá-los enche o resultado de páginas vazias (o carrinho do
 * rastreador está sempre vazio) e ainda gasta o orçamento de rastreio da loja
 * em páginas que nunca trarão visita. `follow` continua ligado — os links de
 * navegação delas para o catálogo continuam valendo.
 */
export const ROBOTS_TELA_DE_APP: Metadata["robots"] = {
  index: false,
  follow: true,
};

/** Corta uma descrição no limite prático do que o buscador exibe. */
export function descricaoCurta(texto: string | null | undefined): string {
  const limpo = (texto ?? "").replace(/\s+/g, " ").trim();
  if (limpo.length <= 158) return limpo;
  const cortado = limpo.slice(0, 157);
  const espaco = cortado.lastIndexOf(" ");
  return `${(espaco > 95 ? cortado.slice(0, espaco) : cortado).replace(/[,;:.\-\s]+$/, "")}…`;
}
