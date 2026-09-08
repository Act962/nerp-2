import Link from "next/link";
import {
  blockStyleVars,
  resolveBackgrounds,
  type SiteBlock,
  youtubeId,
} from "@nerp/site-content";
import type { SiteContent } from "@nerp/site-content";
import { assetUrl } from "@/lib/assets";
import type { PaginaDoAstro } from "./astro/pagina";
import { SiteHeaderNav } from "./site-header-nav";
import { ScrollToBlockListener } from "./scroll-to-block";
import { BRAND } from "@/orbita/ui/brand";
import "./product-page.css";

/**
 * A página interna de uma solução, montada a partir dos blocos publicados.
 *
 * É um Server Component puro: nenhum bloco tem estado, e a página precisa
 * chegar pronta no HTML por causa da busca. A barra e o rodapé aqui são
 * simples de propósito — os painéis da barra vivem na home, que é onde a cena
 * 3D existe; repetir aquele menu aqui traria a experiência inteira junto.
 */
export function SiteProductPage({
  blocks,
  whatsappHref,
  whatsappLabel,
  loginHref,
  content,
  pagina,
}: {
  blocks: SiteBlock[];
  whatsappHref: string;
  whatsappLabel: string;
  loginHref: string;
  /** Que página é esta, para o Astro saber onde a pessoa está. */
  pagina?: PaginaDoAstro;
  /** Conteúdo do site — alimenta o menu principal (igual ao da home). */
  content?: SiteContent;
}) {
  const fundos = resolveBackgrounds(blocks);

  return (
    <div className="sp-root">
      {/* O MESMO menu da home (barra + painéis com ícones), em modo
          standalone. Sem `content`, cai no cabeçalho enxuto de reserva — o
          site nunca fica sem topo. */}
      {content ? (
        <SiteHeaderNav
          content={content}
          loginHref={loginHref}
          pagina={pagina}
        />
      ) : (
        <header className="sp-nav">
          <Link className="sp-nav__brand" href="/" aria-label="ÓRBITA HUB">
            {/* biome-ignore lint/performance/noImgElement: asset fixo do site, sem otimização a fazer */}
            <img src={BRAND.lockup} alt="" />
          </Link>
          <span className="sp-nav__spacer" />
          <a className="sp-btn sp-btn--ghost sp-nav__hide" href={loginHref}>
            Entrar
          </a>
          <a
            className="sp-btn sp-btn--solid"
            href={whatsappHref}
            target="_blank"
            rel="noreferrer noopener"
          >
            {whatsappLabel}
          </a>
        </header>
      )}

      {/* A faixa é resolvida sobre a lista INTEIRA e só depois filtrada: a
          alternância precisa enxergar a ordem original para não pular. */}
      {blocks.map((block, index) => {
        if (!block.enabled) return null;
        const { vars, classes } = blockStyleVars(block.style);
        return (
          <div
            key={block.id}
            id={`bloco-${block.id}`}
            data-block-id={block.id}
            className={["sp-band", `sp-band--${fundos[index]}`, ...classes]
              .join(" ")
              .trim()}
            style={vars as React.CSSProperties}
          >
            <Block block={block} whatsappHref={whatsappHref} />
          </div>
        );
      })}

      <footer className="sp-foot">
        <Link className="sp-foot__brand" href="/" aria-label="ÓRBITA HUB">
          {/* biome-ignore lint/performance/noImgElement: asset fixo do site, sem otimização a fazer */}
          <img src={BRAND.lockup} alt="" />
        </Link>
        <Link href="/">← Voltar ao site</Link>
        <span className="sp-nav__spacer" />
        <span>© {new Date().getFullYear()} ÓRBITA HUB</span>
      </footer>
      <ScrollToBlockListener />
    </div>
  );
}

function Block({
  block,
  whatsappHref,
}: {
  block: SiteBlock;
  whatsappHref: string;
}) {
  switch (block.type) {
    case "hero": {
      /*
        Frame do herói.

        A caixa se descola da faixa por MARGEM externa (o `inset`) e o
        border-radius aceita OS QUATRO cantos independentes — quem quiser só
        um lado arredondado consegue. Sem `frame`, `undefined` cai para os
        estilos de sempre.

        Só o que foi PREENCHIDO vira variável CSS. `undefined` em variável cai
        no `var(--x, <padrão>)` da folha de estilo — e o padrão é o desenho
        original do `.sp-hero`.
      */
      const frame = block.frame;
      const heroStyle = frame
        ? ({
            "--sp-hero-inset": `${frame.inset}px`,
            "--sp-hero-radius-tl": `${frame.radius.topLeft}px`,
            "--sp-hero-radius-tr": `${frame.radius.topRight}px`,
            "--sp-hero-radius-br": `${frame.radius.bottomRight}px`,
            "--sp-hero-radius-bl": `${frame.radius.bottomLeft}px`,
            "--sp-hero-border":
              frame.border.width > 0
                ? `${frame.border.width}px solid ${frame.border.color}`
                : "none",
          } as React.CSSProperties)
        : undefined;
      return (
        <section
          className={`sp-hero${frame ? " sp-hero--framed" : ""}`}
          style={heroStyle}
        >
          <div>
            {block.eyebrow && (
              <p className="sp-hero__eyebrow">{block.eyebrow}</p>
            )}
            <h1>{block.title}</h1>
            <p>{block.text}</p>
            <div className="sp-hero__actions">
              {block.primary.label && (
                <Action
                  link={block.primary}
                  variant="light"
                  fallback={whatsappHref}
                />
              )}
              {block.secondary.label && (
                <Action
                  link={block.secondary}
                  variant="outline"
                  fallback={whatsappHref}
                />
              )}
            </div>
          </div>
          <Media image={block.image} />
        </section>
      );
    }

    case "statement":
      return (
        <section className="sp-section sp-statement">
          <h2>{block.title}</h2>
          <p>{block.text}</p>
          {block.cta.label && (
            <Action link={block.cta} variant="solid" fallback={whatsappHref} />
          )}
        </section>
      );

    case "compare":
      return (
        <section className="sp-section">
          {block.title && (
            <h2 style={{ textAlign: "center" }}>{block.title}</h2>
          )}
          <div className="sp-duo">
            <div className="sp-duo__more">
              <h3>{block.moreTitle}</h3>
              <ul>
                {block.more.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="sp-duo__less">
              <h3>{block.lessTitle}</h3>
              <ul>
                {block.less.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      );

    case "features":
      return (
        // A âncora existe para o segundo botão do herói ter para onde levar.
        <section className="sp-section" id="funcionalidades">
          {block.title && (
            <h2 style={{ textAlign: "center" }}>{block.title}</h2>
          )}
          <div className="sp-cards">
            {block.items.map((item) => (
              <article className="sp-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      );

    case "split":
      return (
        <section
          className={`sp-section sp-split${
            block.imageSide === "right" ? " sp-split--right" : ""
          }`}
        >
          <div className="sp-split__media">
            <Media image={block.image} />
          </div>
          <div>
            <h2>{block.title}</h2>
            {block.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      );

    case "steps":
      return (
        <section className="sp-section" id="etapas">
          {block.title && <h2 className="sp-steps__title">{block.title}</h2>}
          {block.text && <p className="sp-steps__lead">{block.text}</p>}
          {block.cycle && block.items.length > 2 && (
            <CycleDiagram
              marks={block.items.map((item) => ({
                mark: item.mark,
                title: item.title,
              }))}
            />
          )}
          <div className="sp-steps">
            {block.items.map((item, index) => (
              <article className="sp-step" key={item.title + item.mark}>
                <div className="sp-step__mark">
                  <span>{item.mark || index + 1}</span>
                  <i>{index + 1}</i>
                </div>
                <div>
                  <h3>{item.title}</h3>
                  {item.question && (
                    <p className="sp-step__q">{item.question}</p>
                  )}
                  {item.text && <p>{item.text}</p>}
                  {item.bullets.length > 0 && (
                    <ul>
                      {item.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      );

    case "checklist":
      return (
        <section className="sp-section sp-check">
          <div className="sp-check__side">
            <h2 className="sp-check__title">
              {block.title}
              {block.titleStrong && (
                <>
                  {block.title && " "}
                  <strong>{block.titleStrong}</strong>
                </>
              )}
            </h2>
            {(block.image.key || block.cta.label) && (
              <div className="sp-check__aside">
                {block.image.key && (
                  // biome-ignore lint/performance/noImgElement: imagem por key do R2, sem dimensão conhecida
                  <img src={assetUrl(block.image.key)} alt={block.image.alt} />
                )}
                {block.cta.label &&
                  (block.cta.href ? (
                    <a href={block.cta.href}>{block.cta.label}</a>
                  ) : (
                    <span>{block.cta.label}</span>
                  ))}
              </div>
            )}
          </div>
          <ul className="sp-check__list">
            {block.items.map((item) => (
              <li key={item}>
                <span className="sp-check__mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <title>Incluído</title>
                    <path
                      d="m6 12.5 4 4 8-9"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      );

    case "benefits":
      return (
        <section className="sp-section">
          {block.title && <h2 className="sp-benefits__title">{block.title}</h2>}
          <div className="sp-benefits">
            {block.items.map((item) => (
              <article className="sp-benefit" key={item.title}>
                {item.icon.key && (
                  // biome-ignore lint/performance/noImgElement: ícone por key do R2, sem dimensão conhecida
                  <img
                    className="sp-benefit__icon"
                    src={assetUrl(item.icon.key)}
                    alt={item.icon.alt}
                  />
                )}
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      );

    case "image": {
      if (!block.image.key) return null;

      const alinhamento =
        block.align === "left"
          ? "flex-start"
          : block.align === "right"
            ? "flex-end"
            : "center";

      /*
        Regra de dimensão.

        A imagem tem PROPORÇÃO INTRÍNSECA — ninguém deveria precisar declarar
        as duas dimensões só para o resultado sair na proporção. As regras:

        - se `height` é definida e `width` não, largura = `auto` (o navegador
          resolve pela altura + proporção do arquivo);
        - se `width` é definida e `height` não, altura = `auto` (idem, inverso);
        - se as DUAS estão definidas, ambas valem — e `objectFit` (`contain`
          por padrão) evita a deformação;
        - sem nenhuma, largura casa com a coluna do bloco "Aplicativo" (Split).
      */
      const largura = block.width
        ? `${block.width}px`
        : block.height
          ? "auto"
          : "min(100%, calc(50% - clamp(1rem, 2.5vw, 2rem)))";
      const altura = block.height
        ? `${block.height}px`
        : block.width
          ? "auto"
          : "auto";

      const borderRadius = `${block.radius ?? 0}px`;
      const border =
        block.border && block.border.width > 0
          ? `${block.border.width}px solid ${block.border.color}`
          : undefined;

      if (block.mockup === "iphone") {
        /*
          Envolve a foto no mockup do iPhone. Duas peças empilhadas:

          - a foto, `position: absolute`, dentro do retângulo da TELA (as
            porcentagens abaixo foram MEDIDAS no PNG — 4.486% de esquerda,
            2.071% do topo, 91.183% de largura, 95.858% de altura);
          - o PNG do aparelho por cima, também `absolute`, com `pointer-events:
            none` para o clique cair na foto.

          A caixa mantém a proporção `1293/2656` (do próprio arquivo do
          aparelho) — `aspect-ratio` faz a altura sair sem precisar declarar.
          A cor do contorno vira contorno DO APARELHO no lugar da foto (não
          faria sentido contornar a foto por dentro da tela); o raio vira o
          raio da moldura, quando maior que o padrão.
        */
        /*
          Padrão de tamanho quando não há largura nem altura.

          O aspecto do iPhone é ~2.05:1 vertical, então dar largura de coluna
          cheia (como o bloco sem mockup) faz o aparelho passar de dois metros
          de altura e engolir a página. `clamp` mantém entre 260 e 420 px, com
          preferência de ~28% da tela — tamanho "de aparelho" mesmo, cabe em
          qualquer viewport. Quem quiser maior mexe em Altura ou Largura.
        */
        const larguraCaixa = block.width
          ? `${block.width}px`
          : block.height
            ? `calc(${block.height}px * 1293 / 2656)`
            : "clamp(260px, 28vw, 420px)";
        return (
          <section
            className="sp-section sp-image"
            style={{ display: "flex", justifyContent: alinhamento }}
          >
            <div
              className="sp-image__mockup"
              style={{
                position: "relative",
                width: larguraCaixa,
                aspectRatio: "1293 / 2656",
                borderRadius: borderRadius || "16%",
                border,
                overflow: "hidden",
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: imagem por key do R2, sem dimensão conhecida */}
              <img
                src={assetUrl(block.image.key)}
                alt={block.image.alt}
                style={{
                  position: "absolute",
                  top: "2.071%",
                  left: "4.486%",
                  width: "91.183%",
                  height: "95.858%",
                  objectFit: block.fit ?? "cover",
                  display: "block",
                }}
              />
              {/* biome-ignore lint/performance/noImgElement: asset fixo do site, sem otimização a fazer */}
              <img
                src="/mockups/iphone.png"
                alt=""
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
              />
            </div>
          </section>
        );
      }

      return (
        <section
          className="sp-section sp-image"
          style={{ display: "flex", justifyContent: alinhamento }}
        >
          {/* biome-ignore lint/performance/noImgElement: imagem por key do R2, sem dimensão conhecida */}
          <img
            src={assetUrl(block.image.key)}
            alt={block.image.alt}
            style={{
              width: largura,
              height: altura,
              maxWidth: "100%",
              objectFit: block.fit ?? "contain",
              borderRadius,
              border,
              display: "block",
            }}
          />
        </section>
      );
    }

    case "video": {
      const id = youtubeId(block.youtubeUrl);
      // Sem endereço, a seção inteira não existe — um painel azul vazio seria
      // pior do que a ausência dele.
      if (!id) return null;

      const player = (
        <iframe
          className="sp-video__frame"
          style={{ aspectRatio: (block.aspect ?? "16/9").replace("/", " / ") }}
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title={block.title || "Vídeo"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );

      // Lado a lado: sem painel azul, o fundo é o da faixa. O player vem
      // PRIMEIRO no HTML e troca de lado por `order` — assim a ordem de leitura
      // e a de tabulação continuam sendo vídeo, título, texto, em qualquer
      // arranjo, e no celular as duas variantes empilham igual.
      if ((block.layout ?? "painel") === "lado") {
        return (
          <section
            className={`sp-section sp-video-side${
              block.videoSide === "right" ? " sp-video-side--right" : ""
            }`}
          >
            <div className="sp-video-side__media">{player}</div>
            <div className="sp-video-side__copy">
              {block.title && <h2>{block.title}</h2>}
              {block.text && <p>{block.text}</p>}
            </div>
          </section>
        );
      }

      return (
        <section className="sp-video">
          <h2>{block.title}</h2>
          <p>{block.text}</p>
          {player}
        </section>
      );
    }

    case "clients": {
      const logos = block.logos.filter((logo) => logo.key);
      // Faixa de clientes sem logo nenhuma não vai ao ar: seria uma promessa
      // vazia no meio da página.
      if (logos.length === 0) return null;
      return (
        <section className="sp-clients">
          <h2>{block.title}</h2>
          {/* A esteira precisa da lista DUPLICADA para o loop infinito não ter
              costura: quando a primeira cópia sai da tela, a segunda já está
              exatamente no ponto de partida. */}
          <div className="sp-clients__row">
            <div className="sp-clients__track">
              {[...logos, ...logos].map((logo, i) => (
                // biome-ignore lint/performance/noImgElement: logo por key do R2, sem dimensão conhecida
                <img
                  key={`${logo.key}-${i}`}
                  src={assetUrl(logo.key)}
                  alt={i < logos.length ? logo.alt : ""}
                  aria-hidden={i >= logos.length ? true : undefined}
                />
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "contact":
      return (
        <section className="sp-contact">
          <h2>{block.title}</h2>
          <div className="sp-contact__row">
            {block.options.map((option) => (
              <a
                key={option.label}
                href={option.href || whatsappHref}
                {...(/^https?:\/\//.test(option.href || whatsappHref)
                  ? { target: "_blank", rel: "noreferrer noopener" }
                  : null)}
              >
                {option.label}
              </a>
            ))}
          </div>
        </section>
      );
  }
}

/**
 * As etapas em círculo.
 *
 * O desenho existe para dizer o que uma lista não diz: que o passo a passo é
 * um ciclo, e que o fim alimenta o começo de novo. As posições saem da
 * quantidade de etapas, então ele serve para quatro ou para seis.
 *
 * A seta tracejada volta da última para a SEGUNDA etapa, não para a primeira:
 * num ciclo de decisão, o que recomeça é a análise — a necessidade já foi
 * estabelecida.
 */
function CycleDiagram({
  marks,
}: {
  marks: Array<{ mark: string; title: string }>;
}) {
  const R = 140;
  const C = 210;
  const n = marks.length;

  const ponto = (i: number, raio: number) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return { x: C + raio * Math.cos(a), y: C + raio * Math.sin(a) };
  };

  return (
    <svg
      className="sp-cycle"
      viewBox="0 0 420 420"
      role="img"
      aria-label={`Ciclo: ${marks.map((m) => m.title).join(", ")} — e volta`}
    >
      <title>{`Ciclo: ${marks.map((m) => m.title).join(" → ")}`}</title>
      <defs>
        <marker
          id="sp-seta"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>

      <circle
        cx={C}
        cy={C}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeDasharray="4 8"
      />

      {marks.slice(0, -1).map((mark, i) => {
        const de = ponto(i + 0.22, R);
        const para = ponto(i + 0.78, R);
        return (
          <path
            key={`arco-${mark.title}`}
            d={`M ${de.x} ${de.y} A ${R} ${R} 0 0 1 ${para.x} ${para.y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            markerEnd="url(#sp-seta)"
          />
        );
      })}

      {/* a volta: da última etapa para a segunda */}
      <path
        d={`M ${ponto(n - 1, R - 36).x} ${ponto(n - 1, R - 36).y} Q ${C} ${C - 60} ${ponto(1, R - 36).x} ${ponto(1, R - 36).y}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.75"
        strokeWidth="2"
        strokeDasharray="5 5"
        markerEnd="url(#sp-seta)"
      />

      {marks.map((mark, i) => {
        const p = ponto(i, R);
        const rotulo = ponto(i, R + 46);
        return (
          <g key={mark.title}>
            <circle className="sp-cycle__no" cx={p.x} cy={p.y} r="34" />
            <text className="sp-cycle__letra" x={p.x} y={p.y + 9}>
              {mark.mark || i + 1}
            </text>
            <text className="sp-cycle__rot" x={rotulo.x} y={rotulo.y + 4}>
              {mark.title.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Action({
  link,
  variant,
  fallback,
}: {
  link: { label: string; href: string };
  variant: "light" | "outline" | "solid";
  fallback: string;
}) {
  const href = link.href || fallback;
  const external = /^https?:\/\//.test(href);
  return (
    <a
      className={`sp-btn sp-btn--${variant}`}
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : null)}
    >
      {link.label}
    </a>
  );
}

function Media({ image }: { image: { key: string; alt: string } }) {
  if (!image.key) return <div className="sp-media sp-media--empty" />;
  return (
    // biome-ignore lint/performance/noImgElement: imagem por key do R2, sem dimensão conhecida
    <img className="sp-media" src={assetUrl(image.key)} alt={image.alt} />
  );
}
