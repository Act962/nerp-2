"use client";

import { BRAND, FOOTER } from "../data/site";
import { useSiteContent } from "../lib/content-context";
import { useReveal } from "../hooks/use-reveal";
import { OrbitaLogo } from "./orbita-logo";

/** 14. Footer — a experiência desacelera, o espaço fica quase preto. */
export function Footer() {
  const { contact } = useSiteContent();
  const ref = useReveal({
    inStart: 0.972,
    inEnd: 0.995,
    outStart: 1.05,
    outEnd: 1.1,
    y: 26,
    blur: 5,
  });

  /*
    O escurecimento é um elemento, não um fundo fixo do bloco.

    Como fundo do bloco ele existia a viagem inteira: uma faixa escura cortando
    o planeta ao meio desde o primeiro scroll, para proteger um texto que só
    aparece no fim. Sendo um elemento, ele entra na mesma janela do rodapé —
    um pouco antes, para o chão chegar antes das palavras.
  */
  const scrim = useReveal({
    inStart: 0.958,
    inEnd: 0.988,
    outStart: 1.05,
    outEnd: 1.1,
    y: 0,
    scale: 1,
    blur: 0,
  });

  const year = 2026;

  return (
    <div className="o-block o-block--footer">
      <div className="o-footer__scrim" ref={scrim} aria-hidden="true" />
      <div className="o-stack" ref={ref}>
        <div className="o-footer__grid">
          <div>
            <a className="o-brand" href="#inicio" aria-label={BRAND.name}>
              <OrbitaLogo className="o-brand__logo" />
            </a>
            <p
              className="o-stat__label"
              style={{ marginTop: "1rem", maxWidth: "26ch" }}
            >
              {BRAND.tagline}
            </p>
          </div>

          {FOOTER.columns.map((column) => (
            <div key={column.title}>
              <p className="o-footer__col-title">{column.title}</p>
              <ul className="o-footer__list">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#contato">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="o-footer__col-title">{FOOTER.contact.title}</p>
            <ul className="o-footer__list">
              <li>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
              <li>
                <a href={`tel:${contact.phone.replace(/\D/g, "")}`}>
                  {contact.phone}
                </a>
              </li>
              {FOOTER.contact.social.map((s) => (
                <li key={s.label}>
                  <a href={s.href}>{s.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="o-footer__bottom">
          <span>
            © {year} {BRAND.name} {BRAND.suffix}. Todos os direitos reservados.
          </span>
          <span>Feito para orbitar o futuro.</span>
        </div>
      </div>
    </div>
  );
}
