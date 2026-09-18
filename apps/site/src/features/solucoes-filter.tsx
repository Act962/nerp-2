"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MenuEntry, SolutionArea } from "@nerp/site-content";

/**
 * O mesmo card das outras seções, inline aqui de propósito: este é um Client
 * Component, e importar o card do módulo de servidor cruzaria a fronteira RSC
 * (e faria um import circular com `section-index`). São poucas linhas.
 */
function Cartao({ item }: { item: MenuEntry }) {
  const conteudo = (
    <>
      <h3>{item.name}</h3>
      <p>{item.summary}</p>
    </>
  );

  if (!item.href) {
    return <article className="sp-card">{conteudo}</article>;
  }
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

/**
 * O filtro por área da página `/solucoes`.
 *
 * "Todas" é o estado inicial e mostra a lista inteira, como antes. Cada botão
 * é uma área; clicar deixa só as soluções ligadas a ela. A escolha vai para a
 * URL (`?area=comercial`) sem recarregar, para o endereço ser compartilhável e
 * o deep-link abrir já filtrado.
 */
export function SolucoesFilter({
  solucoes,
  areas,
  initialArea,
}: {
  solucoes: MenuEntry[];
  areas: SolutionArea[];
  initialArea?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Um `?area=` que não existe (área removida, link velho) cai em "Todas" em
  // vez de mostrar uma lista vazia sem explicação.
  const inicial =
    initialArea && areas.some((a) => a.slug === initialArea)
      ? initialArea
      : null;
  const [area, setArea] = useState<string | null>(inicial);

  const visiveis = useMemo(
    () => (area ? solucoes.filter((s) => s.areas?.includes(area)) : solucoes),
    [area, solucoes],
  );

  function escolher(slug: string | null) {
    setArea(slug);
    router.replace(slug ? `${pathname}?area=${slug}` : pathname, {
      scroll: false,
    });
  }

  return (
    <>
      <div className="sp-areas">
        <button
          type="button"
          className="sp-area"
          aria-pressed={area === null}
          onClick={() => escolher(null)}
        >
          Todas
        </button>
        {areas.map((a) => (
          <button
            key={a.slug}
            type="button"
            className="sp-area"
            aria-pressed={area === a.slug}
            onClick={() => escolher(a.slug)}
            style={
              a.color
                ? ({ "--sp-area-color": a.color } as React.CSSProperties)
                : undefined
            }
          >
            {a.name}
          </button>
        ))}
      </div>

      <div className="sp-secao__grupo">
        {visiveis.length === 0 ? (
          <p className="sp-areas__empty">
            Nenhuma solução nesta área por enquanto.
          </p>
        ) : (
          <div className="sp-cards">
            {visiveis.map((item) => (
              <Cartao key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
