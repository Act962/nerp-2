"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND, NAV } from "../data/site";
import { useSiteContent } from "../lib/content-context";
import { scroll } from "../lib/store";
import { scrollToProgress } from "../hooks/use-scroll-timeline";
import { OrbitaLogo } from "./orbita-logo";
import { MegaMenu, type MegaKind } from "./mega-menu";
import { cn } from "../lib/cn";
import { legacy } from "../lib/timeline";

/**
 * Navegação transparente sobre o espaço.
 *
 * Os itens não apontam para blocos empilhados: cada um leva a um ponto da
 * órbita. Clicar em "Sobre nós" faz a câmera viajar até lá.
 *
 * "Soluções", "Segmentos" e "Sobre nós" são a exceção: em vez de viajar,
 * abrem um painel. São as partes do site em que o conteúdo aparece de uma vez,
 * em lista — porque quem procura uma ferramenta, um setor ou uma vaga não quer
 * uma viagem, quer um índice.
 */
export function Nav({
  ctaHref = "/login",
  signupHref = "/cadastro",
  standalone = false,
}: {
  /** Para onde "Entrar" leva: o painel, se já houver sessão; senão o login. */
  ctaHref?: string;
  signupHref?: string;
  /**
   * Modo fora da home 3D (páginas internas de solução/segmento/sobre).
   *
   * A barra é a MESMA — os painéis com ícones continuam idênticos, porque só
   * dependem de `href` (que todas as ferramentas já têm). O que muda: os itens
   * de âncora deixam de viajar pela órbita e passam a NAVEGAR — "Início" vai
   * para a home, "Contato" abre o WhatsApp — e o loop que lê o scroll da cena
   * fica desligado, já que aqui não existe órbita para acompanhar.
   */
  standalone?: boolean;
}) {
  const { whatsapp } = useSiteContent();
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState<MegaKind | null>(null);
  /* Um clique de teclado chega com `detail === 0`; um de mouse, com 1. É como
     o painel sabe se deve puxar o foco para dentro dele. */
  const [byKeyboard, setByKeyboard] = useState(false);
  const linkRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const active = useRef<React.RefObject<HTMLElement | null>>({ current: null });

  useEffect(() => {
    // Fora da home não há órbita para acompanhar — o loop leria sempre 0.
    if (standalone) return;
    let raf = 0;
    let last = -1;
    const loop = () => {
      const p = scroll.smooth;
      // Item ativo = a estação da órbita mais próxima do progresso atual.
      let index = 0;
      for (let i = 0; i < NAV.length; i++) {
        if (p >= NAV[i].at - legacy(0.05)) index = i;
      }
      if (index !== last) {
        last = index;
        linkRefs.current.forEach((el, i) => {
          if (el) el.dataset.active = i === index ? "true" : "false";
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [standalone]);

  const go = (at: number) => {
    setOpen(false);
    setMega(null);
    scrollToProgress(at);
  };

  const closeMega = useCallback(() => setMega(null), []);

  /* O botão do WhatsApp lê esta bandeira no próprio loop e sai de cena
     enquanto um painel cobre a tela. */
  useEffect(() => {
    scroll.menuOpen = mega !== null;
  }, [mega]);

  return (
    <nav
      className={cn(
        "o-nav",
        standalone && "o-nav--standalone",
        open && "o-nav--open",
        mega && "o-nav--mega",
      )}
      aria-label="Principal"
    >
      {standalone ? (
        <Link
          className="o-brand"
          href="/"
          aria-label={`${BRAND.name} — ir para o início`}
        >
          <OrbitaLogo className="o-brand__logo" />
        </Link>
      ) : (
        <button
          type="button"
          className="o-brand"
          onClick={() => go(0)}
          aria-label={`${BRAND.name} — ir para o início`}
        >
          <OrbitaLogo className="o-brand__logo" />
        </button>
      )}

      <div className="o-nav__links">
        {NAV.map((item, i) =>
          item.mega ? (
            <button
              key={item.label}
              type="button"
              className="o-nav__link o-nav__link--mega"
              data-mega-trigger=""
              data-open={mega === item.mega}
              aria-expanded={mega === item.mega}
              aria-controls={`o-mega-${item.mega}`}
              ref={(el) => {
                linkRefs.current[i] = el;
                if (item.mega) triggers.current[item.mega] = el;
              }}
              onClick={(event) => {
                // No celular os dois painéis nascem do mesmo `top: 100%`:
                // abrir um fecha o outro para não se empilharem.
                setOpen(false);
                setByKeyboard(event.detail === 0);
                const kind = item.mega as MegaKind;
                active.current = { current: triggers.current[kind] };
                setMega((v) => (v === kind ? null : kind));
              }}
            >
              {item.label}
              <svg
                className="o-nav__chevron"
                width="10"
                height="6"
                viewBox="0 0 10 6"
                aria-hidden="true"
              >
                <path
                  d="M1 1l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : standalone ? (
            // Fora da home, "Início" navega para a home e "Contato" abre o
            // WhatsApp — não há órbita para viajar. Os demais itens são `mega`
            // e caem no ramo de cima, com os painéis idênticos.
            <a
              key={item.label}
              className="o-nav__link"
              href={item.label === "Contato" ? whatsapp.href : "/"}
              {...(item.label === "Contato"
                ? { target: "_blank", rel: "noreferrer noopener" }
                : {})}
            >
              {item.label}
            </a>
          ) : (
            <button
              key={item.label}
              type="button"
              className="o-nav__link"
              ref={(el) => {
                linkRefs.current[i] = el;
              }}
              onClick={() => go(item.at)}
            >
              {item.label}
            </button>
          ),
        )}

        {/*
          Os mesmos dois destinos, agora dentro da gaveta.

          No retrato eles não cabem na barra. Repetir a marcação aqui — com
          cada cópia escondida no modo do outro — é mais simples do que mover
          nós entre containers, e `display: none` tira a cópia inativa também
          da árvore de acessibilidade.
        */}
        <a className="o-nav__signin o-nav__auth-drawer" href={ctaHref}>
          Entrar
        </a>
        <a className="o-nav__signup o-nav__auth-drawer" href={signupHref}>
          Começar gratuitamente
        </a>
      </div>

      {/*
        Os painéis vêm logo depois dos links, e não no fim da barra.
        Como estão fora do fluxo, a posição no DOM não muda o leiaute — muda a
        ordem do Tab: sair do gatilho cai dentro do painel, que é o que um menu
        recém-aberto deve fazer.
      */}
      <MegaMenu
        kind="solucoes"
        open={mega === "solucoes"}
        onClose={closeMega}
        id="o-mega-solucoes"
        fromKeyboard={byKeyboard}
        returnFocusTo={active.current}
      />
      <MegaMenu
        kind="segmentos"
        open={mega === "segmentos"}
        onClose={closeMega}
        id="o-mega-segmentos"
        fromKeyboard={byKeyboard}
        returnFocusTo={active.current}
      />
      <MegaMenu
        kind="sobre"
        open={mega === "sobre"}
        onClose={closeMega}
        id="o-mega-sobre"
        fromKeyboard={byKeyboard}
        returnFocusTo={active.current}
      />

      {/*
        Três destinos, três pesos.

        "Entrar" é para quem já é cliente e só quer a porta — texto puro.
        "Começar gratuitamente" é a conversão por conta própria, contornada.
        "Agendar Demonstração" é a conversa com o time, e é a que fica sólida:
        no varejo é ela que fecha.
      */}
      <div className="o-nav__right">
        <a className="o-nav__signin" href={ctaHref}>
          Entrar
        </a>
        <a className="o-nav__signup" href={signupHref}>
          Começar gratuitamente
        </a>
        <a
          className="o-nav__cta"
          href={whatsapp.href}
          target="_blank"
          rel="noreferrer noopener"
        >
          {whatsapp.label}
        </a>
        <button
          type="button"
          className="o-nav__toggle"
          aria-expanded={open}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => {
            setMega(null);
            setOpen((v) => !v);
          }}
        >
          <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
            <path
              d={open ? "M1 1L15 11M15 1L1 11" : "M0 1h16M0 6h16M0 11h16"}
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </nav>
  );
}
