import type { MetadataRoute } from "next";
import { getSitePages } from "@/lib/api";
import { TODAS_AS_PAGINAS } from "@/lib/default-pages";
import { absoluteUrl, SECTION_ORDER, SITE_URL } from "@/lib/seo";

/**
 * O `sitemap.xml`.
 *
 * A lista é a UNIÃO de duas fontes, e as duas são necessárias:
 *
 * - **as páginas do código** (`TODAS_AS_PAGINAS`). Como o site responde 200
 *   para elas mesmo com o `apps/web` fora do ar ou com a página ainda em
 *   rascunho, todo slug daqui é um endereço vivo. Endereço vivo fora do
 *   sitemap é endereço que o buscador só acha por sorte.
 * - **as páginas do admin** (`/api/site/pages`). São as que o cliente cria, e
 *   que o código não tem como conhecer. Sem elas o sitemap ficaria eternamente
 *   preso ao catálogo do dia do deploy.
 *
 * O `apps/web` fora do ar não quebra nada: sobra a primeira fonte, que é o
 * grosso. É a mesma regra que vale para o conteúdo — ver `lib/api.ts`.
 */

/** De quanto em quanto tempo o Next remonta o arquivo. */
export const revalidate = 3600;

/**
 * As prioridades.
 *
 * São um sinal fraco (o Google diz que praticamente ignora), mas descrevem a
 * hierarquia corretamente para os outros — o Bing ainda usa — e custam nada:
 * home > trecho > página interna.
 */
const PRIORIDADE = { home: 1, secao: 0.8, pagina: 0.7 } as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
    Sem endereço público, sitemap VAZIO.

    Um sitemap com `<loc>http://localhost:3001/...</loc>` é inválido por
    definição — o protocolo exige que as URLs sejam do mesmo host que serve o
    arquivo — e o Google descarta o documento inteiro. Vazio é o mesmo
    resultado prático, sem ensinar endereço errado a ninguém. O aviso de que
    a variável falta sai de `lib/seo.ts`, uma vez, no arranque.
  */
  if (!SITE_URL) return [];

  const publicadas = await getSitePages();

  // Quando a página existe nas duas fontes, a data do admin manda: ela é a de
  // uma publicação real, e a do código é sempre a do deploy.
  const datas = new Map(
    publicadas.map((page) => [
      `${page.section}/${page.slug}`,
      new Date(page.lastModified),
    ]),
  );

  const caminhos = new Map<string, Date | undefined>();
  for (const page of TODAS_AS_PAGINAS) {
    const chave = `${page.section}/${page.slug}`;
    caminhos.set(chave, datas.get(chave));
  }
  for (const page of publicadas) {
    const chave = `${page.section}/${page.slug}`;
    if (!caminhos.has(chave)) caminhos.set(chave, new Date(page.lastModified));
  }

  const agora = new Date();

  // `absoluteUrl` devolve `string | undefined`; acima já garantimos a base,
  // então aqui o `!` é a afirmação de que ela existe — e não um palpite.
  const url = (path: string) => absoluteUrl(path) as string;

  return [
    {
      url: url("/"),
      lastModified: agora,
      changeFrequency: "weekly",
      priority: PRIORIDADE.home,
    },
    ...SECTION_ORDER.map((section) => ({
      url: url(`/${section}`),
      lastModified: agora,
      changeFrequency: "weekly" as const,
      priority: PRIORIDADE.secao,
    })),
    ...[...caminhos.entries()].map(([chave, lastModified]) => ({
      url: url(`/${chave}`),
      lastModified: lastModified ?? agora,
      changeFrequency: "monthly" as const,
      priority: PRIORIDADE.pagina,
    })),
  ];
}
