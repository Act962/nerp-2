import type { Metadata } from "next";
import Link from "next/link";
import type { MenuEntry, SiteContent, SiteSection } from "@nerp/site-content";
import { metadataDaPagina, SECTION_LABEL } from "@/lib/seo";
import { SiteHeaderNav } from "./site-header-nav";
import { SiteFooter, Trilha } from "./site-chrome";
import "./product-page.css";

/**
 * A página de um trecho do site — `/solucoes`, `/segmentos`, `/sobre`.
 *
 * Ela não existia, e a falta se pagava em três lugares ao mesmo tempo:
 *
 * - **arquitetura.** As 40 páginas internas só eram alcançáveis pelo painel da
 *   barra. Painel é navegação, não hierarquia: para o buscador, `/solucoes/chat`
 *   pendurava direto na home, sem nível intermediário que dissesse do que
 *   aquilo é parte.
 * - **trilha.** Um `BreadcrumbList` com "Início › Soluções › Chat" precisa que
 *   "Soluções" seja um endereço. Sem a página, ou a trilha mentia ou não existia.
 * - **ligação interna.** Uma página de trecho concentra os links de uma família
 *   inteira num lugar só, e distribui entre irmãs o que antes só chegava da home.
 *
 * O conteúdo é o MESMO do painel da barra — vem de `SiteContent`, então o que o
 * admin publica aparece aqui também. Nada foi escrito para esta tela: se um
 * item some do menu, some daqui junto.
 */

const ABERTURA: Record<SiteSection, { titulo: string; texto: string }> = {
  solucoes: {
    titulo: "As ferramentas da suíte",
    texto:
      "Uma suíte só faz sentido se as peças se conhecerem. Cada ferramenta abaixo escreve no mesmo cadastro, no mesmo funil e no mesmo histórico — não é um pacote de sistemas separados com a mesma cor.",
  },
  segmentos: {
    titulo: "Cada operação tem o seu jeito de funcionar",
    texto:
      "Nossos produtos e serviços são inspirados nos desafios e nas oportunidades de cada operação. Escolha a sua para ver o que muda na prática.",
  },
  sobre: {
    titulo: "Quem orbita com você",
    texto:
      "A empresa, as parcerias e os treinamentos: o que sustenta a suíte além do software.",
  },
};

/**
 * O título de busca de cada trecho.
 *
 * Separado do `ABERTURA.titulo` de propósito: o H1 é uma frase, feita para
 * quem já está na página; o title é uma etiqueta, feita para quem está lendo
 * uma lista de dez resultados e precisa saber, em três palavras, o que é isto.
 */
const TITULO_SEO: Record<SiteSection, string> = {
  // Dois-pontos e não travessão: `comMarca()` acrescenta " — ÓRBITA HUB" no
  // fim, e dois travessões no mesmo título deixam a frase sem eixo.
  solucoes: "Soluções: as 28 ferramentas da suíte",
  segmentos: "Segmentos: para quem a suíte foi feita",
  sobre: "Sobre nós: a empresa, as parcerias e os treinamentos",
};

export function metadataDaSecao(section: SiteSection): Metadata {
  return metadataDaPagina({
    titulo: TITULO_SEO[section],
    descricao: ABERTURA[section].texto,
    path: `/${section}`,
    chapeu: SECTION_LABEL[section],
  });
}

/** Um item vira card; sem destino, vira texto — nunca um link para lugar nenhum. */
function Card({ item }: { item: MenuEntry }) {
  const conteudo = (
    <>
      <h3>{item.name}</h3>
      <p>{item.summary}</p>
    </>
  );

  if (!item.href) {
    return <article className="sp-card">{conteudo}</article>;
  }

  // `http…` sai do site; `/…` navega dentro dele. A mesma regra dos painéis.
  if (/^https?:\/\//.test(item.href)) {
    return (
      <a
        className="sp-card sp-card--link"
        href={item.href}
        target="_blank"
        rel="noreferrer noopener"
      >
        {conteudo}
      </a>
    );
  }

  return (
    <Link className="sp-card sp-card--link" href={item.href}>
      {conteudo}
    </Link>
  );
}

function Grupo({ titulo, itens }: { titulo?: string; itens: MenuEntry[] }) {
  if (itens.length === 0) return null;
  return (
    <div className="sp-secao__grupo">
      {titulo && <h2>{titulo}</h2>}
      <div className="sp-cards">
        {itens.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

/** Os grupos de cada trecho, já achatados no formato que o card espera. */
export function gruposDaSecao(
  section: SiteSection,
  content: SiteContent,
): Array<{ titulo?: string; itens: MenuEntry[] }> {
  if (section === "solucoes") {
    return content.solucoes.map((grupo) => ({
      titulo: grupo.title,
      itens: grupo.items,
    }));
  }
  if (section === "segmentos") {
    return [{ itens: content.segmentos }];
  }
  return [
    ...content.sobre.groups.map((grupo) => ({
      titulo: grupo.title,
      itens: grupo.items,
    })),
    { titulo: "Treinamentos", itens: [content.sobre.highlight] },
  ];
}

export function SectionIndexPage({
  section,
  content,
  loginHref,
  signupHref,
}: {
  section: SiteSection;
  content: SiteContent;
  loginHref: string;
  signupHref: string;
}) {
  const abertura = ABERTURA[section];
  const grupos = gruposDaSecao(section, content);

  // As outras duas famílias, no rodapé: é o que liga trecho a trecho em vez de
  // fazer todo caminho passar pela home.
  const irmas = (["solucoes", "segmentos", "sobre"] as SiteSection[])
    .filter((outra) => outra !== section)
    .map((outra) => ({ nome: SECTION_LABEL[outra], href: `/${outra}` }));

  return (
    <div className="sp-root">
      <SiteHeaderNav
        content={content}
        loginHref={loginHref}
        signupHref={signupHref}
      />

      <Trilha
        passos={[
          { nome: "Início", href: "/" },
          { nome: SECTION_LABEL[section] },
        ]}
      />

      <div className="sp-band sp-band--base">
        <section className="sp-hero sp-hero--secao">
          <div>
            <p className="sp-hero__eyebrow">{SECTION_LABEL[section]}</p>
            <h1>{abertura.titulo}</h1>
            <p>{abertura.texto}</p>
          </div>
        </section>
      </div>

      <div className="sp-band sp-band--claro">
        <section className="sp-section sp-secao">
          {grupos.map((grupo, index) => (
            <Grupo
              key={grupo.titulo ?? `grupo-${index}`}
              titulo={grupo.titulo}
              itens={grupo.itens}
            />
          ))}
        </section>
      </div>

      <SiteFooter links={irmas} />
    </div>
  );
}
