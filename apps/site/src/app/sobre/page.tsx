import type { Metadata } from "next";
import {
  gruposDaSecao,
  metadataDaSecao,
  SectionIndexPage,
} from "@/features/section-index";
import { APP_LINKS, getSiteContent } from "@/lib/api";
import { jsonLdScript, secaoLd, SECTION_LABEL } from "@/lib/seo";

/**
 * `/sobre` — o índice institucional.
 *
 * O nível que faltava entre a home e as páginas da empresa. Ver
 * `features/section-index.tsx` para o porquê das três.
 */
export const metadata: Metadata = metadataDaSecao("sobre");

export default async function SobrePage() {
  const content = await getSiteContent();

  const itens = gruposDaSecao("sobre", content)
    .flatMap((grupo) => grupo.itens)
    .filter((item) => item.href?.startsWith("/"))
    .map((item) => ({ nome: item.name, path: item.href as string }));

  // `null` sem endereço público conhecido — ver `lib/seo.ts`.
  const grafo = secaoLd({
    section: "sobre",
    titulo: SECTION_LABEL.sobre,
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
        section="sobre"
        content={content}
        loginHref={APP_LINKS.login}
      />
    </>
  );
}
