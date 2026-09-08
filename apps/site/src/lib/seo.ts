import type { Metadata } from "next";
import type { SiteBlock, SiteContent, SiteSection } from "@nerp/site-content";
import { assetUrl } from "./assets";

/**
 * O núcleo de SEO do site.
 *
 * Existe porque quatro rotas precisam concordar sobre a mesma coisa — qual é o
 * endereço canônico, de onde sai a descrição, o que vai no Open Graph — e
 * repetir isso rota a rota é como as três acabam divergindo. Aqui nada é
 * inventado: título, descrição e imagem saem do que a página realmente mostra.
 */

const CONFIGURADO = (process.env.NEXT_PUBLIC_SITE_URL ?? "")
  .trim()
  .replace(/\/$/, "");

/**
 * O endereço público do site — ou `null` quando ninguém disse qual é.
 *
 * É a base de TUDO que precisa ser absoluto: canonical, `og:url`, a imagem de
 * compartilhamento, o sitemap e o `robots.txt`.
 *
 * **Por que `null` em vez de cair em `localhost`.** Esta função já teve um
 * fallback para `http://localhost:3001`, e ele foi ao ar: por semanas o site
 * publicado serviu `<link rel="canonical" href="http://localhost:3001/...">`
 * em todas as páginas, além de um sitemap inteiro de endereços `localhost`.
 * Canonical é uma AFIRMAÇÃO — "a versão oficial desta página é aquela" — e
 * apontá-la para um host que o buscador não alcança é pior do que não afirmar
 * nada: sem canonical a página é indexada normalmente; com um canonical
 * inalcançável ela pode sair do índice.
 *
 * Em DESENVOLVIMENTO o fallback continua, porque ali `localhost:3001` é a
 * resposta certa e é o que permite conferir canonical e Open Graph na máquina.
 * Em PRODUÇÃO, sem a variável, o valor é `null` e quem consome simplesmente
 * não emite a tag — ver `metadataDaPagina`, `robots.ts` e `sitemap.ts`.
 */
export const SITE_URL: string | null =
  CONFIGURADO ||
  (process.env.NODE_ENV === "production" ? null : "http://localhost:3001");

/*
  E o silêncio não pode ser silencioso.

  A degradação acima é segura, mas segue sendo um deploy mal configurado: sem
  canonical, sem sitemap e sem prévia de link. O aviso existe para aparecer no
  log do build, que é onde alguém tem chance de ver.

  A marca no `globalThis` limita o aviso a uma vez POR PROCESSO. Ela não o
  reduz a uma linha só no build: o Next gera as páginas em vários workers, cada
  um com o próprio `globalThis`, então a mensagem aparece algumas vezes. Isso é
  aceitável — é um erro de configuração, e ele deve ser difícil de ignorar. O
  que a trava evita é a repetição dentro de um mesmo processo, que é o caso do
  servidor em execução.
*/
const MARCA_DO_AVISO = Symbol.for("orbita.site.aviso-site-url");
type ComAviso = typeof globalThis & { [MARCA_DO_AVISO]?: true };

if (!SITE_URL && !(globalThis as ComAviso)[MARCA_DO_AVISO]) {
  (globalThis as ComAviso)[MARCA_DO_AVISO] = true;
  console.error(
    "[site] NEXT_PUBLIC_SITE_URL não está definida. Canonical, Open Graph, " +
      "sitemap, robots.txt e JSON-LD NÃO serão emitidos — é degradação " +
      "deliberada, porque apontá-los para localhost tira as páginas do índice. " +
      "ATENÇÃO: é uma variável `NEXT_PUBLIC_*`, então o Next a embute no " +
      "bundle em tempo de BUILD; defini-la só no runtime do container não " +
      "resolve, é preciso rebuildar.",
  );
}

export const SITE_NAME = "ÓRBITA HUB";
export const SITE_LOCALE = "pt_BR";

/**
 * O endereço absoluto de um caminho interno, ou `undefined` sem base conhecida.
 *
 * O `undefined` é proposital e atravessa todo o arquivo: quem monta metadata
 * usa spread condicional para OMITIR o campo, em vez de preenchê-lo com uma
 * URL inventada.
 */
export function absoluteUrl(path: string): string | undefined {
  if (!SITE_URL) return undefined;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/* ------------------------------------------------------------------ seções */

/** O rótulo humano de cada trecho — o mesmo que aparece na barra. */
export const SECTION_LABEL: Record<SiteSection, string> = {
  solucoes: "Soluções",
  segmentos: "Segmentos",
  sobre: "Sobre nós",
};

export const SECTION_ORDER: SiteSection[] = ["solucoes", "segmentos", "sobre"];

/* -------------------------------------------------------------- descrições */

/**
 * O limite prático de uma meta description.
 *
 * O Google não corta em número de caracteres, e sim em pixels, mas ~160 é a
 * medida que na prática cabe na maioria dos resultados. Acima disso o texto
 * não é penalizado — só não é lido.
 */
const DESCRICAO_MAX = 158;

/**
 * O piso do que já é uma descrição de verdade.
 *
 * Abaixo disto o campo é um slogan, não uma descrição — e o buscador troca por
 * um trecho da página, que é justamente o que a função abaixo antecipa.
 */
const DESCRICAO_BOA = 110;

/** Corta na última palavra inteira, com reticências, em vez de no meio dela. */
function encurtar(texto: string, limite = DESCRICAO_MAX): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  const cortado = limpo.slice(0, limite - 1);
  const ultimoEspaco = cortado.lastIndexOf(" ");
  return `${(ultimoEspaco > limite * 0.6 ? cortado.slice(0, ultimoEspaco) : cortado).replace(/[,;:.\-\s]+$/, "")}…`;
}

/** O texto do primeiro herói habilitado — o parágrafo de abertura da página. */
function textoDoHeroi(blocks: SiteBlock[]): string {
  const heroi = blocks.find(
    (block) => block.type === "hero" && block.enabled !== false,
  );
  return heroi && heroi.type === "hero" ? heroi.text.trim() : "";
}

/**
 * A descrição de uma página.
 *
 * A ordem é deliberada: o que o admin escreveu no campo de SEO manda, DESDE
 * QUE seja uma descrição e não um slogan. As páginas que nascem do código
 * trazem taglines de 20 a 50 caracteres ali — o buscador descartaria e
 * montaria a dele a partir do texto da página. Então é esse mesmo texto (o
 * parágrafo do herói, conteúdo visível, escrito por gente) que entra quando o
 * campo é curto demais. Nada é gerado: só se escolhe entre dois textos que já
 * existem.
 */
export function descricaoDaPagina(
  seoDescription: string,
  blocks: SiteBlock[],
): string {
  const campo = seoDescription.replace(/\s+/g, " ").trim();
  if (campo.length >= DESCRICAO_BOA) return encurtar(campo);

  const heroi = textoDoHeroi(blocks);
  if (heroi.length > campo.length) return encurtar(heroi);
  return encurtar(campo);
}

/* ------------------------------------------------------ imagem de partilha */

/**
 * A imagem de compartilhamento de uma página.
 *
 * Se o admin subiu uma, é ela. Senão, o cartão é DESENHADO em `/og` com o
 * título da própria página — 1200×630, a proporção que o Facebook, o LinkedIn
 * e o X esperam. Um cartão gerado é melhor do que nenhum: sem `og:image` o
 * link compartilhado vira uma linha de texto.
 *
 * A imagem do admin sobrevive sem `SITE_URL` — ela já é uma URL absoluta do
 * bucket. O cartão gerado, não: ele mora em `/og` deste site, e sem saber o
 * endereço do site não há como apontar para ele. Aí a lista volta vazia.
 */
export function ogImage(opcoes: {
  ogImageKey?: string;
  titulo: string;
  chapeu?: string;
}): NonNullable<NonNullable<Metadata["openGraph"]>["images"]> {
  const doAdmin = opcoes.ogImageKey ? assetUrl(opcoes.ogImageKey) : "";
  if (doAdmin) {
    return [{ url: doAdmin, alt: opcoes.titulo }];
  }

  const params = new URLSearchParams({ titulo: opcoes.titulo });
  if (opcoes.chapeu) params.set("chapeu", opcoes.chapeu);

  const cartao = absoluteUrl(`/og?${params.toString()}`);
  if (!cartao) return [];

  return [
    {
      url: cartao,
      width: 1200,
      height: 630,
      alt: opcoes.titulo,
      type: "image/png",
    },
  ];
}

/* ---------------------------------------------------------------- metadata */

/**
 * O `robots` das páginas que devem ser indexadas.
 *
 * `max-image-preview: large` é o que libera a miniatura grande no resultado; e
 * `max-snippet: -1` deixa o Google escolher o tamanho do trecho em vez de
 * cortar em 160 caracteres. Ambos são opt-in — o padrão é mais restrito.
 */
export const ROBOTS_INDEXAVEL: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

/**
 * O título com a marca no fim, uma vez só.
 *
 * Os títulos das páginas internas vêm do campo de SEO do admin e a maioria já
 * termina em "— ÓRBITA HUB"; os das páginas de trecho, não. Um `template` do
 * Next aplicaria o sufixo aos dois e o primeiro grupo ficaria com a marca
 * duplicada — daí a normalização ser uma função e não uma configuração.
 *
 * Acima de 60 caracteres o Google corta na exibição. Não é penalidade, mas um
 * título cortado no meio de uma palavra perde a única chance de dizer o que a
 * página é, então o sufixo é omitido quando ele passaria do limite: a marca é
 * a parte dispensável, o assunto não.
 */
const TITULO_LIMITE = 60;

function comMarca(titulo: string): string {
  const limpo = titulo.replace(/\s+/g, " ").trim();
  if (/ÓRBITA\s*HUB/i.test(limpo)) return limpo;
  const comSufixo = `${limpo} — ${SITE_NAME}`;
  return comSufixo.length <= TITULO_LIMITE ? comSufixo : limpo;
}

/**
 * O metadata de uma página pública do site.
 *
 * Uma função só para as quatro rotas: é o que garante que canonical, Open
 * Graph e Twitter Card contem a MESMA história em todas elas.
 */
export function metadataDaPagina(opcoes: {
  titulo: string;
  descricao: string;
  path: string;
  ogImageKey?: string;
  chapeu?: string;
  tipo?: "website" | "article";
}): Metadata {
  const url = absoluteUrl(opcoes.path);
  const titulo = comMarca(opcoes.titulo);
  const imagens = ogImage({
    ogImageKey: opcoes.ogImageKey,
    // No cartão vai o título SEM a marca: o logotipo já está desenhado nele, e
    // repetir "ÓRBITA HUB" na frase rouba espaço do que a página tem a dizer.
    titulo: opcoes.titulo.replace(/\s*[—-]\s*ÓRBITA\s*HUB\s*$/i, ""),
    chapeu: opcoes.chapeu,
  });

  /*
    O corte vale para TODA descrição que sai daqui, não só para a das páginas
    de bloco. As páginas de trecho passam um parágrafo inteiro, e sem isto
    saíam com 199 caracteres — quarenta a mais do que o resultado mostra.
  */
  const descricao = encurtar(opcoes.descricao);

  return {
    title: titulo,
    description: descricao,
    /*
      Canonical e `og:url` só existem se o endereço público for conhecido.

      O spread condicional é o ponto do arquivo inteiro: sem `SITE_URL` o campo
      SOME, em vez de sair apontando para `localhost`. Canonical é uma
      afirmação sobre qual é a versão oficial da página — errada, ela tira a
      página do índice; ausente, ela só deixa de ajudar.

      Sem query no canonical, de propósito: é ele que diz ao buscador que
      `/solucoes/chat?utm_source=x` e `/solucoes/chat` são a mesma página.
    */
    ...(url ? { alternates: { canonical: url } } : {}),
    robots: ROBOTS_INDEXAVEL,
    openGraph: {
      type: opcoes.tipo ?? "website",
      ...(url ? { url } : {}),
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title: titulo,
      description: descricao,
      images: imagens,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descricao,
      images: imagens,
    },
  };
}

/* -------------------------------------------------------------- structured */

/**
 * Os `@id` do grafo — `null` sem endereço público conhecido.
 *
 * Um `@id` é um identificador GLOBAL: `http://localhost:3001/#organizacao`
 * declara ao buscador que a ÓRBITA HUB é a entidade que vive num endereço
 * inalcançável. Structured data errado não é neutro; é uma afirmação falsa
 * sobre quem a empresa é. Sem base, os construtores abaixo devolvem `null` e
 * quem chama simplesmente não emite o `<script>`.
 */
export const ORG_ID = SITE_URL ? `${SITE_URL}/#organizacao` : null;
export const SITE_ID = SITE_URL ? `${SITE_URL}/#site` : null;

/**
 * Telefone e e-mail de exemplo não entram no structured data.
 *
 * `data/site.ts` avisa que os contatos do rodapé ainda são placeholders. Um
 * `+55 (85) 0000-0000` no JSON-LD não é só inútil: é o Google aprendendo um
 * telefone errado da empresa, e depois exibindo ele. Enquanto for exemplo,
 * fica de fora — e volta sozinho no dia em que o admin trocar.
 */
function ehExemplo(valor: string): boolean {
  return !valor || /0000|exemplo|example|@teste\./i.test(valor);
}

type Json = Record<string, unknown>;

/**
 * A ÓRBITA HUB, em JSON-LD.
 *
 * Sem `sameAs`: os links de rede social do rodapé ainda são `#`, e apontar
 * `sameAs` para nada é pior do que não declarar. Sem `address`: o site não
 * mostra endereço nenhum, e o schema tem de descrever o que está na página.
 */
export function organizationLd(content: SiteContent): Json | null {
  if (!SITE_URL) return null;
  const contatos: Json[] = [];

  if (!ehExemplo(content.contact.phone) || !ehExemplo(content.contact.email)) {
    contatos.push({
      "@type": "ContactPoint",
      contactType: "sales",
      areaServed: "BR",
      availableLanguage: "Portuguese",
      ...(ehExemplo(content.contact.email)
        ? {}
        : { email: content.contact.email }),
      ...(ehExemplo(content.contact.phone)
        ? {}
        : { telephone: content.contact.phone }),
    });
  }

  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: absoluteUrl("/orbita/brand/orbita-symbol.webp"),
    image: absoluteUrl("/orbita/brand/orbita-lockup.webp"),
    description:
      "Conectamos tecnologia, gestão, dados e inovação para transformar negócios.",
    ...(contatos.length ? { contactPoint: contatos } : {}),
  };
}

/**
 * O site em si.
 *
 * Sem `potentialAction`/`SearchAction`: a busca do painel filtra a lista no
 * navegador, não existe endereço de resultado para o Google chamar. Declarar
 * uma caixa de busca que não responde por URL é exatamente o schema artificial
 * que não se deve escrever.
 */
export function webSiteLd(): Json | null {
  if (!SITE_URL) return null;
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    inLanguage: "pt-BR",
    publisher: { "@id": ORG_ID },
  };
}

/** A trilha de navegação, na mesma ordem em que ela aparece na página. */
export function breadcrumbLd(
  trilha: Array<{ nome: string; path?: string }>,
): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trilha.map((passo, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: passo.nome,
      // O último item é a página atual: o Google pede que ele NÃO tenha
      // `item`, senão a trilha aponta para si mesma.
      ...(passo.path ? { item: absoluteUrl(passo.path) } : {}),
    })),
  };
}

/**
 * O grafo de uma página interna.
 *
 * `WebPage` sempre; `AboutPage` quando a página é a institucional; e `Service`
 * só nas soluções, porque ali a página descreve mesmo um serviço que a empresa
 * presta — nos segmentos ela descreve para quem, o que não é a mesma coisa.
 */
export function paginaInternaLd(opcoes: {
  section: SiteSection;
  slug: string;
  titulo: string;
  descricao: string;
  path: string;
  imagem?: string;
}): Json | null {
  const url = absoluteUrl(opcoes.path);
  // Sem endereço público não há grafo: `@id` e `url` seriam identificadores
  // globais apontando para um host que ninguém alcança.
  if (!url) return null;
  const tipo =
    opcoes.section === "sobre" && opcoes.slug === "sobre-o-orbita-hub"
      ? "AboutPage"
      : "WebPage";

  const trilha = [
    { nome: "Início", path: "/" },
    { nome: SECTION_LABEL[opcoes.section], path: `/${opcoes.section}` },
    { nome: opcoes.titulo },
  ];

  const grafo: Json[] = [
    {
      "@type": tipo,
      "@id": `${url}#pagina`,
      url,
      name: opcoes.titulo,
      description: opcoes.descricao,
      inLanguage: "pt-BR",
      isPartOf: { "@id": SITE_ID },
      about: { "@id": ORG_ID },
      breadcrumb: { "@id": `${url}#trilha` },
      ...(opcoes.imagem ? { primaryImageOfPage: opcoes.imagem } : {}),
    },
    { ...breadcrumbLd(trilha), "@id": `${url}#trilha` },
  ];

  if (opcoes.section === "solucoes") {
    grafo.push({
      "@type": "Service",
      "@id": `${url}#servico`,
      name: opcoes.titulo,
      description: opcoes.descricao,
      url,
      provider: { "@id": ORG_ID },
      serviceType: "Software",
    });
  }

  return { "@context": "https://schema.org", "@graph": grafo };
}

/** O grafo da home. */
export function homeLd(content: SiteContent): Json | null {
  const organizacao = organizationLd(content);
  const site = webSiteLd();
  if (!SITE_URL || !organizacao || !site) return null;
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizacao,
      site,
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#pagina`,
        url: `${SITE_URL}/`,
        name: `${SITE_NAME} — Tecnologia que orbita possibilidades`,
        inLanguage: "pt-BR",
        isPartOf: { "@id": SITE_ID },
        about: { "@id": ORG_ID },
      },
    ],
  };
}

/** O grafo de uma página de trecho (`/solucoes`, `/segmentos`, `/sobre`). */
export function secaoLd(opcoes: {
  section: SiteSection;
  titulo: string;
  descricao: string;
  itens: Array<{ nome: string; path: string }>;
}): Json | null {
  const url = absoluteUrl(`/${opcoes.section}`);
  if (!url) return null;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#pagina`,
        url,
        name: opcoes.titulo,
        description: opcoes.descricao,
        inLanguage: "pt-BR",
        isPartOf: { "@id": SITE_ID },
        breadcrumb: { "@id": `${url}#trilha` },
        // A lista é o conteúdo da página: cada item existe, visível, com link.
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: opcoes.itens.length,
          itemListElement: opcoes.itens.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.nome,
            url: absoluteUrl(item.path),
          })),
        },
      },
      {
        ...breadcrumbLd([
          { nome: "Início", path: "/" },
          { nome: SECTION_LABEL[opcoes.section] },
        ]),
        "@id": `${url}#trilha`,
      },
    ],
  };
}

/**
 * O `<script>` do JSON-LD.
 *
 * `</script>` dentro de uma string do JSON fecharia a tag no meio do conteúdo
 * — escapar a barra é o que impede isso de virar injeção de HTML.
 */
export function jsonLdScript(dados: Json): { __html: string } {
  return { __html: JSON.stringify(dados).replace(/</g, "\\u003c") };
}
