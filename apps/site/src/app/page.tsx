import type { Metadata } from "next";
import { APP_LINKS, getSiteContent, getSitePartners } from "@/lib/api";
import { PARTNERS_PREVIEW } from "@/lib/partners-preview";
import { absoluteUrl, homeLd, jsonLdScript } from "@/lib/seo";
import { OrbitaHome } from "./_components/orbita-home";

/**
 * A home é a experiência 3D da ÓRBITA HUB.
 *
 * O conteúdo dos painéis vem do `apps/web` pelo servidor, e não pelo
 * navegador: o menu tem de estar no HTML que chega, tanto para quem lê a
 * página quanto para quem a indexa.
 *
 * O que o rastreador recebe é a versão SEM WebGL (`orbita/fallback/`): a cena
 * 3D só assume depois que o navegador confirma que tem WebGL, e essa checagem
 * não existe no servidor. O HTML de saída é, portanto, o catálogo inteiro em
 * texto, com um H1 e um link para cada uma das 40 páginas internas — que é
 * exatamente o que se quer que seja rastreado.
 */

/**
 * Só o canonical é declarado aqui.
 *
 * Título, descrição e Open Graph da home já são os do layout — repetir seria
 * criar dois lugares para a mesma frase mudar. O canonical, esse não pode
 * morar no layout: lá ele valeria para toda página que não o sobrescrevesse.
 */
export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [content, partners, params] = await Promise.all([
    getSiteContent(),
    getSitePartners(),
    searchParams,
  ]);

  /*
    `?parceiros=demo` mostra a seção com conteúdo de ensaio, só em
    desenvolvimento. Sem isso não há como conferir o leiaute antes de o
    cliente cadastrar o primeiro parceiro — a seção, corretamente, some
    quando as listas estão vazias.
  */
  const ensaio =
    process.env.NODE_ENV !== "production" && params.parceiros === "demo";

  return (
    <>
      {/* Organization + WebSite + WebPage. É na home que a empresa é
          declarada uma vez; as páginas internas só referenciam o `@id`. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD é a única forma de emitir structured data; o conteúdo é serializado e escapado em `jsonLdScript`
        dangerouslySetInnerHTML={jsonLdScript(homeLd(content))}
      />
      <OrbitaHome
        content={content}
        partners={ensaio ? PARTNERS_PREVIEW : partners}
        loginHref={APP_LINKS.login}
        signupHref={APP_LINKS.signup}
      />
    </>
  );
}
