import type { Metadata } from "next";
import { Jornada } from "@/features/jornada/jornada";
import {
  gruposDaSecao,
  metadataDaSecao,
  SectionIndexPage,
} from "@/features/section-index";
import { APP_LINKS, getSiteContent } from "@/lib/api";
import { jsonLdScript, secaoLd, SECTION_LABEL } from "@/lib/seo";

/**
 * `/solucoes` — o índice da suíte.
 *
 * O nível que faltava entre a home e as 31 páginas de ferramenta. Ver
 * `features/section-index.tsx` para o porquê das três.
 */
export const metadata: Metadata = metadataDaSecao("solucoes");

export default async function SolucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const [content, { area }] = await Promise.all([
    getSiteContent(),
    searchParams,
  ]);

  const itens = gruposDaSecao("solucoes", content)
    .flatMap((grupo) => grupo.itens)
    .filter((item) => item.href?.startsWith("/"))
    .map((item) => ({ nome: item.name, path: item.href as string }));

  // `null` sem endereço público conhecido — ver `lib/seo.ts`.
  const grafo = secaoLd({
    section: "solucoes",
    titulo: SECTION_LABEL.solucoes,
    descricao: metadata.description as string,
    itens,
  });

  return (
    <>
      {grafo && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD é a única forma de emitir structured data; o conteúdo é serializado e escapado em `jsonLdScript`
          dangerouslySetInnerHTML={jsonLdScript(grafo)}
        />
      )}
      <SectionIndexPage
        section="solucoes"
        content={content}
        loginHref={APP_LINKS.login}
        signupHref={APP_LINKS.signup}
        initialArea={area}
        /*
          A jornada vem primeiro: ela conta POR QUE as soluções existem e em
          que momento cada uma entra. A grade abaixo continua sendo o caminho
          de quem já sabe o nome da ferramenta — e é ela que distribui link
          interno para as 31 páginas de produto. Vai por dentro do
          `SectionIndexPage` porque o cabeçalho mora lá: por fora, o menu
          desceria junto.
        */
        antesDaAbertura={<Jornada />}
        semGrade
      />
    </>
  );
}
