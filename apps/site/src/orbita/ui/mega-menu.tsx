"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuEntry } from "../data/content";
import { findTool } from "../data/catalog";
import { useSiteContent } from "../lib/content-context";
import { goToTool } from "../lib/navigate";
import { AboutIcon, SegmentIcon, ToolIcon } from "./icons";

/** Endereço absoluto abre em aba nova; caminho interno navega na mesma. */
const isExternalHref = (href?: string) => !!href && /^https?:\/\//.test(href);

/**
 * O link de um item de painel.
 *
 * Interno vira `<Link>`, e não `<a>`: navegação do lado do cliente é o que
 * mantém a cena 3D viva entre as páginas e o que dá tempo do carregamento com
 * a marca aparecer. Um `<a>` recarregaria o site inteiro a cada clique.
 */
function PanelLink({
  href,
  className,
  style,
  onNavigate,
  children,
}: {
  href: string;
  className: string;
  style?: React.CSSProperties;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a
        className={className}
        style={style}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={onNavigate}
      >
        {children}
      </a>
    );
  }

  /*
    O painel NÃO fecha no clique.

    Fechar aqui roda `setMega(null)` no mesmo tique do clique e DESMONTA este
    link enquanto o App Router ainda está no meio da transição — a navegação
    era abortada e a pessoa ficava na mesma página, depois de ver o carregador
    aparecer e sumir. Quem fecha o painel é a troca de rota, no `Nav`.
  */
  return (
    <Link className={className} style={style} href={href}>
      {children}
    </Link>
  );
}

/**
 * Os painéis da barra.
 *
 * Um painel que desce da barra e ocupa a largura toda. "Soluções" abre a suíte
 * inteira em seis colunas, uma por momento do negócio, com busca no topo e o
 * Método N.A.S.A. fechando embaixo; "Segmentos" abre os setores atendidos, em
 * cards.
 *
 * Os cantos de baixo são arredondados porque o painel *sai* da barra: ele é um
 * bloco pendurado nela, não uma segunda faixa colada embaixo.
 *
 * Cada item vira `<a>` quando tem página própria e `<button>` quando o destino
 * é a órbita — a diferença é semântica, não visual: um link precisa abrir em
 * aba nova, ser copiável, aparecer na barra de status.
 */

export type MegaKind = "solucoes" | "segmentos" | "sobre";

type Props = {
  kind: MegaKind;
  open: boolean;
  onClose: () => void;
  id: string;
  /** Se o painel foi aberto pelo teclado — aí o foco entra nele. */
  fromKeyboard?: boolean;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
};

const TITLES = {
  solucoes: "Soluções",
  segmentos: "Segmentos",
  sobre: "Sobre nós",
} as const;

export function MegaMenu({
  kind,
  open,
  onClose,
  id,
  fromKeyboard = false,
  returnFocusTo,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const content = useSiteContent();
  const whatsapp = content.whatsapp;

  /*
    A busca do painel de soluções.

    Com 28 ferramentas, percorrer seis colunas com o olho deixou de ser o jeito
    mais rápido de achar uma. O filtro casa com o nome E com a descrição — quem
    procura "whatsapp" não sabe que a ferramenta se chama Disparo, e é
    exatamente essa pessoa que a busca serve.

    Coluna que fica sem item some, em vez de deixar um título órfão.
  */
  const [busca, setBusca] = useState("");

  const colunas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return content.solucoes;
    return content.solucoes
      .map((coluna) => ({
        ...coluna,
        items: coluna.items.filter((item) =>
          `${item.name} ${item.summary}`.toLowerCase().includes(termo),
        ),
      }))
      .filter((coluna) => coluna.items.length > 0);
  }, [busca, content.solucoes]);

  // Fechar e reabrir o painel não deve trazer a busca da vez passada.
  useEffect(() => {
    if (!open) setBusca("");
  }, [open]);

  /*
    Foco só quando o teclado pediu.

    Quem abriu com o mouse já está com a mão no ponteiro e um foco forçado
    faria a página pular. Quem abriu com Enter precisa que o próximo Tab caia
    dentro do painel — e os outros itens da barra vêm antes dele no DOM.
  */
  useEffect(() => {
    if (!open || !fromKeyboard) return;
    /*
      Esperar o quadro seguinte não é superstição: no instante em que o efeito
      roda, o painel ainda está com a `visibility` do estado anterior, e o
      navegador recusa foco em elemento invisível.
    */
    const raf = requestAnimationFrame(() => {
      panel.current
        ?.querySelector<HTMLElement>(".o-mega__item, .o-mega__seg")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, fromKeyboard]);

  /*
    Fechar por fora e por Esc.

    O clique é ouvido na fase de captura e no `pointerdown`: se esperasse o
    `click` normal, um clique num ponto da órbita atrás do painel abriria um
    produto no mesmo gesto que fecha o menu.
  */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        // Fechar sem devolver o foco deixaria o teclado no começo da página.
        returnFocusTo?.current?.focus({ preventScroll: true });
      }
    };

    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel.current?.contains(target)) return;
      // O próprio gatilho tem o seu toggle; deixá-lo em paz evita fechar e
      // reabrir no mesmo clique.
      if ((target as HTMLElement).closest?.("[data-mega-trigger]")) return;
      onClose();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose, returnFocusTo]);

  return (
    <div
      className="o-mega"
      ref={panel}
      id={id}
      data-open={open}
      data-kind={kind}
      aria-hidden={!open}
    >
      <div className="o-mega__inner">
        <h2 className="o-mega__sr">{TITLES[kind]} da ÓRBITA HUB</h2>

        {/*
          Barra de fechar, só no retrato.

          No desktop o próprio item da barra alterna o painel e ele está sempre
          à vista. No celular a barra de links se fecha ao abrir a folha, e sem
          este botão a única saída seria tocar no pedaço de página que sobra
          embaixo — uma saída que ninguém adivinha.
        */}
        <div className="o-mega__bar">
          <span>{TITLES[kind]}</span>
          <button
            type="button"
            className="o-mega__close"
            onClick={onClose}
            aria-label={`Fechar ${TITLES[kind].toLowerCase()}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {kind === "solucoes" ? (
          <>
            <div className="o-mega__search">
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <circle
                  cx="7"
                  cy="7"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  fill="none"
                />
                <path
                  d="M11 11l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por palavra: estoque, foto, whatsapp…"
                aria-label="Buscar solução"
              />
            </div>

            <div className="o-mega__grid">
              {colunas.map((group) => (
                <section className="o-mega__col" key={group.title}>
                  <h3 className="o-mega__title">{group.title}</h3>
                  <ul className="o-mega__list">
                    {group.items.map((tool) => (
                      <li key={tool.id}>
                        <ToolItem tool={tool} onNavigate={onClose} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {colunas.length === 0 && (
              <p className="o-mega__empty">Nada encontrado com essa palavra.</p>
            )}

            {/*
              O método não é mais uma ferramenta: é o que orquestra as outras.
              Por isso ele sai da grade e ocupa a largura toda, no fim — do
              mesmo jeito que Treinamentos fecha o painel "Sobre nós".
            */}
            <PanelLink
              className="o-mega__method"
              href="/solucoes/metodo-nasa"
              onNavigate={onClose}
            >
              <span className="o-mega__method-ico">
                <ToolIcon id="metodo" />
              </span>
              <span className="o-mega__method-body">
                <span className="o-mega__method-name">Método N.A.S.A.</span>
                <span className="o-mega__method-text">
                  O passo a passo que orquestra cada ferramenta — o que faz as
                  28 virarem uma operação só.
                </span>
              </span>
              <em className="o-mega__method-action">Ver o método →</em>
            </PanelLink>

            <div className="o-mega__foot">
              <p className="o-mega__note">
                Vinte e oito ferramentas na mesma base: o que uma escreve, a
                outra já enxerga.
              </p>
              <button
                type="button"
                className="o-mega__cta"
                onClick={() => {
                  onClose();
                  goToTool("tracking");
                }}
              >
                Percorrer a órbita
              </button>
            </div>
          </>
        ) : kind === "sobre" ? (
          <>
            <div className="o-mega__about">
              {content.sobre.groups.map((group) => (
                <section className="o-mega__col" key={group.title}>
                  <h3 className="o-mega__title">{group.title}</h3>
                  <ul className="o-mega__list">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <AboutLink
                          item={item}
                          fallbackHref={whatsapp.href}
                          onNavigate={onClose}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {/*
                Treinamentos vem em destaque, não como terceira coluna: sem
                sub-itens, o título repetiria o próprio link logo abaixo.
              */}
              <PanelLink
                className="o-mega__highlight"
                href={content.sobre.highlight.href ?? whatsapp.href}
                onNavigate={onClose}
              >
                <span className="o-mega__highlight-ico">
                  <AboutIcon id={content.sobre.highlight.id} size={34} />
                </span>
                <span className="o-mega__highlight-body">
                  <span className="o-mega__highlight-name">
                    {content.sobre.highlight.name}
                  </span>
                  <span className="o-mega__highlight-text">
                    {content.sobre.highlight.summary}
                  </span>
                  <span className="o-mega__highlight-action">
                    {content.sobre.highlight.action} →
                  </span>
                </span>
              </PanelLink>
            </div>

            <div className="o-mega__foot">
              <p className="o-mega__note">
                A empresa por trás da suíte, quem constrói junto e como aprender
                a usar.
              </p>
              <a
                className="o-mega__cta"
                href={whatsapp.href}
                target="_blank"
                rel="noreferrer noopener"
                onClick={onClose}
              >
                {whatsapp.label}
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="o-mega__lead">
              Nossos produtos e serviços são inspirados nos desafios e
              oportunidades de cada operação.
            </p>

            <ul className="o-mega__segs">
              {content.segmentos.map((segment) => (
                <li key={segment.id}>
                  <SegmentCard
                    segment={segment}
                    fallbackHref={whatsapp.href}
                    onNavigate={onClose}
                  />
                </li>
              ))}
            </ul>

            <div className="o-mega__foot">
              <p className="o-mega__note">
                Cada segmento traz a suíte configurada para o que aquela
                operação faz todo dia.
              </p>
              <a
                className="o-mega__cta"
                href={whatsapp.href}
                target="_blank"
                rel="noreferrer noopener"
                onClick={onClose}
              >
                {whatsapp.label}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ToolItem({
  tool,
  onNavigate,
}: {
  tool: MenuEntry;
  onNavigate: () => void;
}) {
  // O selo "ERP" é propriedade da ferramenta, não do item de menu: continua
  // saindo do catálogo, que é quem sabe qual delas é ponte com o nerp.
  const catalog = findTool(tool.id);

  const body = (
    <>
      <span className="o-mega__ico">
        <ToolIcon id={tool.id} />
      </span>
      <span className="o-mega__text">
        <span className="o-mega__name">
          {tool.name}
          {catalog?.bridge && <span className="o-mega__badge">ERP</span>}
        </span>
        <span className="o-mega__tag">{tool.summary}</span>
      </span>
    </>
  );

  if (tool.href) {
    return (
      <PanelLink
        className="o-mega__item"
        href={tool.href}
        onNavigate={onNavigate}
      >
        {body}
      </PanelLink>
    );
  }

  /*
    Sem página própria, o destino é a própria órbita: a estação daquela
    ferramenta, com as funcionalidades na roleta. Só vale para quem tem
    estação — um item de menu inventado no admin não teria para onde ir.
  */
  if (!catalog) return <span className="o-mega__item">{body}</span>;

  return (
    <button
      type="button"
      className="o-mega__item"
      onClick={() => {
        onNavigate();
        goToTool(tool.id);
      }}
    >
      {body}
    </button>
  );
}

function SegmentCard({
  segment,
  fallbackHref,
  onNavigate,
}: {
  segment: MenuEntry;
  fallbackHref: string;
  onNavigate: () => void;
}) {
  const body = (
    <>
      <span className="o-mega__seg-ico">
        <SegmentIcon id={segment.id} />
      </span>
      <span className="o-mega__seg-name">{segment.name}</span>
      <span className="o-mega__sr">{segment.summary}</span>
    </>
  );

  const style = { ["--o-seg" as string]: segment.color };

  if (segment.href) {
    return (
      <PanelLink
        className="o-mega__seg"
        style={style}
        href={segment.href}
        onNavigate={onNavigate}
      >
        {body}
      </PanelLink>
    );
  }

  /*
    Sem página própria, o card leva ao contato.

    É o destino honesto: a página do segmento ainda não existe, e mandar para
    um lugar que existe vale mais do que um link morto ou um card inerte.
  */
  return (
    <a
      className="o-mega__seg"
      style={style}
      href={fallbackHref}
      target="_blank"
      rel="noreferrer noopener"
      onClick={onNavigate}
    >
      {body}
    </a>
  );
}

function AboutLink({
  item,
  fallbackHref,
  onNavigate,
}: {
  item: MenuEntry;
  fallbackHref: string;
  onNavigate: () => void;
}) {
  const href = item.href;

  /*
    Sem página própria, o item leva ao contato.

    O mesmo critério dos segmentos: um link morto seria pior do que um destino
    que existe. Preencher o campo "para onde vai" no admin troca o destino.
  */
  return (
    <PanelLink
      className="o-mega__item"
      href={href ?? fallbackHref}
      onNavigate={onNavigate}
    >
      <span className="o-mega__ico">
        <AboutIcon id={item.id} />
      </span>
      <span className="o-mega__text">
        <span className="o-mega__name">{item.name}</span>
        <span className="o-mega__tag">{item.summary}</span>
      </span>
    </PanelLink>
  );
}
