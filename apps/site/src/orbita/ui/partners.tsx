"use client";

import type { SiteBrand, SitePartner } from "@nerp/site-content";
import { useReveal } from "../hooks/use-reveal";
import { usePartners } from "../lib/partners-context";
import { DESCENT } from "../lib/timeline";

/**
 * O conteúdo da descida à Terra.
 *
 * Dois blocos, em dois tempos diferentes da mesma viagem:
 *
 * - **Cases de sucesso** entra sobre o planeta, antes da nuvem fechar. É onde
 *   a história de cada parceiro é contada.
 * - **Nossos parceiros** entra sobre o mar, depois que a asa da nave abre o
 *   branco. É onde as marcas aparecem, em quadros de vidro.
 *
 * Os dois somem quando não há o que mostrar. Não existe estado "carregando"
 * nem quadro vazio: uma grade de retângulos em branco no meio de uma viagem
 * de scroll parece site inacabado, e é pior do que não ter a seção.
 */

/* --- Tempo 3: os cases, sobre o planeta --------------------------------- */

export function SuccessCases() {
  const { partners } = usePartners();
  const ref = useReveal({
    // Entram com o planeta já grande e saem antes de o branco fechar: eles são
    // lidos sobre a Terra, não sobre a nuvem.
    inStart: DESCENT.cases.from - 0.014,
    inEnd: DESCENT.cases.from + 0.012,
    outStart: 0.632,
    outEnd: 0.65,
    y: 26,
    blur: 8,
  });

  if (!partners.length) return null;

  return (
    <div className="o-block o-block--cases" id="cases">
      <div className="o-stack" ref={ref}>
        <div className="o-cases__head o-plate">
          <span className="o-eyebrow">Cases de sucesso</span>
          <h2 className="o-title">Quem já orbita com a gente.</h2>
        </div>
        <div className="o-cases__grid" data-poucos={partners.length < 4}>
          {partners.slice(0, 6).map((partner) => (
            <CaseCard key={partner.id} partner={partner} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CaseCard({ partner }: { partner: SitePartner }) {
  const conteudo = (
    <>
      {partner.photo ? (
        // biome-ignore lint/performance/noImgElement: pasta portátil, sem Next
        <img
          className="o-case__photo"
          src={partner.photo}
          alt=""
          loading="lazy"
          draggable={false}
        />
      ) : null}
      <div className="o-case__body">
        {partner.logo ? (
          // biome-ignore lint/performance/noImgElement: pasta portátil, sem Next
          <img
            className="o-case__logo"
            src={partner.logo}
            alt={partner.name}
            loading="lazy"
            draggable={false}
          />
        ) : null}
        <p className="o-case__name">{partner.name}</p>
        {partner.story ? (
          <p className="o-case__story">{partner.story}</p>
        ) : null}
      </div>
    </>
  );

  /*
    Sem foto e sem logo o cartão continua sendo um cartão: o nome e a história
    ganham o espaço que a imagem ocuparia. Um retângulo cinza esperando upload
    seria pior do que a ausência.
  */
  if (partner.href) {
    return (
      <a
        className="o-case"
        href={partner.href}
        target={partner.href.startsWith("http") ? "_blank" : undefined}
        rel={partner.href.startsWith("http") ? "noreferrer" : undefined}
      >
        {conteudo}
      </a>
    );
  }

  return <div className="o-case">{conteudo}</div>;
}

/* --- Tempo 5: as marcas, sobre o mar ------------------------------------ */

export function PartnerBrands() {
  const { brands } = usePartners();
  const ref = useReveal({
    inStart: DESCENT.parceiros.from - 0.004,
    inEnd: DESCENT.parceiros.from + 0.02,
    outStart: DESCENT.parceiros.to - 0.014,
    outEnd: DESCENT.parceiros.to + 0.006,
    y: 22,
    blur: 6,
  });

  if (!brands.length) return null;

  return (
    <div className="o-block o-block--brands" id="parceiros">
      <div className="o-stack" ref={ref}>
        <div className="o-brands__head">
          <span className="o-eyebrow o-eyebrow--ink">Nossos parceiros</span>
          <h2 className="o-title o-title--ink">Ninguém orbita sozinho.</h2>
        </div>
        <div className="o-brands__grid">
          {brands.map((brand) => (
            <BrandFrame key={brand.id} brand={brand} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandFrame({ brand }: { brand: SiteBrand }) {
  const marca = (
    // biome-ignore lint/performance/noImgElement: pasta portátil, sem Next
    <img
      className="o-brand-frame__logo"
      src={brand.logo}
      alt={brand.name}
      loading="lazy"
      draggable={false}
    />
  );

  if (brand.href) {
    return (
      <a
        className="o-brand-frame"
        href={brand.href}
        target="_blank"
        rel="noreferrer"
        title={brand.name}
      >
        {marca}
      </a>
    );
  }

  return <div className="o-brand-frame">{marca}</div>;
}
