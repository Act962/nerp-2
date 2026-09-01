"use client";

import { TOOLS_BY_CATEGORY } from "../data/catalog";
import { BRAND, FOOTER } from "../data/site";
import { useSiteContent } from "../lib/content-context";
import { AboutIcon, SegmentIcon, WhatsAppGlyph } from "../ui/icons";
import { OrbitaLogo } from "../ui/orbita-logo";
import "./fallback.css";

/**
 * Versão sem WebGL (ou com `prefers-reduced-motion`).
 *
 * Não é uma página de erro nem um "site B": é a mesma narrativa —
 * planeta → órbita → soluções → produtos → conexão → futuro — contada em
 * camadas de CSS. O planeta continua presente, o símbolo continua orbitando
 * (parado, mas em posição), e todo o conteúdo continua legível.
 */
export function OrbitaFallback({
  appHref = "/login",
}: {
  appHref?: string;
} = {}) {
  // O fallback lê o mesmo conteúdo do admin que a cena 3D: quem entra sem
  // WebGL vê o menu que está publicado, não uma cópia congelada dele.
  const { segmentos, sobre, stats, contact, whatsapp } = useSiteContent();

  return (
    <div className="of-root">
      <header className="of-nav">
        <a className="of-brand" href="#inicio" aria-label={BRAND.name}>
          <OrbitaLogo className="of-brand__logo" />
        </a>
        <nav>
          <a href="#solucoes">Soluções</a>
          <a href="#segmentos">Segmentos</a>
          <a href="#sobre">Sobre nós</a>
          <a href="#contato">Contato</a>
        </nav>
      </header>

      <section className="of-hero" id="inicio">
        <div className="of-space" aria-hidden="true">
          <div className="of-planet" />
          <div className="of-glow" />
          {/* A esfera em órbita, sem WebGL: gradientes fazem o realce e o contorno. */}
          <div className="of-sphere" />
        </div>
        <div className="of-hero__copy">
          <span className="of-eyebrow">
            {BRAND.name} {BRAND.suffix}
          </span>
          <h1>Tecnologia que orbita possibilidades.</h1>
          <p>
            Conectamos tecnologia, gestão, dados e inovação para transformar
            negócios.
          </p>
          <div className="of-actions">
            <a className="of-btn of-btn--primary" href="#solucoes">
              Conheça nossas soluções
            </a>
            <a className="of-btn" href="#contato">
              Fale conosco
            </a>
          </div>
        </div>
      </section>

      {/*
        A mesma suíte, sem a órbita.

        Na cena 3D cada ferramenta é uma esfera e cada funcionalidade é uma
        sub-esfera da roleta. Aqui as duas viram texto na ordem em que a órbita
        as apresenta — quem entra sem WebGL lê o catálogo inteiro, não um
        resumo dele.
      */}
      <section className="of-section" id="solucoes">
        <span className="of-eyebrow">A suíte</span>
        <h2>Dezenove ferramentas na mesma órbita.</h2>
        <p className="of-lead">
          Uma suíte só faz sentido se as peças se conhecerem. Cada ferramenta
          abaixo escreve no mesmo cadastro, no mesmo funil e no mesmo histórico
          — não é um pacote de sistemas separados com a mesma cor.
        </p>

        {TOOLS_BY_CATEGORY.map((group) => (
          <div className="of-suite" key={group.id} id={`suite-${group.id}`}>
            <h3 className="of-suite__title">{group.title}</h3>
            <p className="of-suite__lead">{group.lead}</p>
            <div className="of-grid">
              {group.tools.map((tool) => (
                <article key={tool.id} className="of-card">
                  <span className="of-eyebrow">{tool.tagline}</span>
                  <h3>{tool.fullName}</h3>
                  <p>{tool.summary}</p>
                  <ul className="of-card__features">
                    {tool.features.map((feature) => (
                      <li key={feature.id}>
                        <strong>{feature.title}</strong> {feature.description}
                      </li>
                    ))}
                  </ul>
                  {tool.href && (
                    <a href={tool.href === "/login" ? appHref : tool.href}>
                      Acessar
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Os mesmos segmentos do painel da barra, em cards. */}
      <section className="of-section" id="segmentos">
        <span className="of-eyebrow">Segmentos</span>
        <h2>Cada operação tem o seu jeito de funcionar.</h2>
        <p className="of-lead">
          Nossos produtos e serviços são inspirados nos desafios e oportunidades
          de cada operação.
        </p>
        <div className="of-segments">
          {segmentos.map((segment) => (
            <a
              key={segment.id}
              className="of-segment"
              style={{ ["--c" as string]: segment.color }}
              href={segment.href ?? whatsapp.href}
              {...(segment.href
                ? null
                : { target: "_blank", rel: "noreferrer noopener" })}
            >
              <SegmentIcon id={segment.id} size={36} />
              <strong>{segment.name}</strong>
              <span>{segment.summary}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="of-impact">
        <p>
          Tudo conectado.
          <span>Tudo em movimento.</span>
        </p>
      </section>

      <section className="of-section" id="sobre">
        <span className="of-eyebrow">Sobre nós</span>
        <h2>Orbitamos com você em cada desafio.</h2>
        <div className="of-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Os mesmos itens do painel "Sobre nós" da barra. */}
        <div className="of-about">
          {sobre.groups.map((group) => (
            <div key={group.title}>
              <p className="of-footer__col-title">{group.title}</p>
              <ul className="of-about__list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href ?? whatsapp.href}
                      {...(item.href
                        ? null
                        : { target: "_blank", rel: "noreferrer noopener" })}
                    >
                      <AboutIcon id={item.id} size={20} />
                      <span>
                        <strong>{item.name}</strong>
                        {item.summary}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <a
            className="of-about__highlight"
            href={sobre.highlight.href ?? whatsapp.href}
            {...(sobre.highlight.href
              ? null
              : { target: "_blank", rel: "noreferrer noopener" })}
          >
            <AboutIcon id={sobre.highlight.id} size={30} />
            <strong>{sobre.highlight.name}</strong>
            <span>{sobre.highlight.summary}</span>
            <em>{sobre.highlight.action} →</em>
          </a>
        </div>
      </section>

      <section className="of-cta" id="contato">
        <h2>Pronto para orbitar o futuro?</h2>
        <p>
          Fale com nossos especialistas e descubra como podemos impulsionar o
          seu negócio.
        </p>
        <a
          className="of-btn of-btn--primary"
          href={whatsapp.href}
          target="_blank"
          rel="noreferrer noopener"
        >
          {whatsapp.label}
        </a>
      </section>

      <a
        className="of-whatsapp"
        href={whatsapp.href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Falar no WhatsApp"
      >
        <WhatsAppGlyph size={26} />
      </a>

      <footer className="of-footer">
        <div className="of-footer__grid">
          <div>
            <a className="of-brand" href="#inicio" aria-label={BRAND.name}>
              <OrbitaLogo className="of-brand__logo" />
            </a>
          </div>
          {FOOTER.columns.map((c) => (
            <div key={c.title}>
              <p>{c.title}</p>
              <ul>
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#contato">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p>{FOOTER.contact.title}</p>
            <ul>
              <li>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
              <li>
                <a href={`tel:${contact.phone.replace(/\D/g, "")}`}>
                  {contact.phone}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="of-footer__bottom">
          © 2026 {BRAND.name} {BRAND.suffix}. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
