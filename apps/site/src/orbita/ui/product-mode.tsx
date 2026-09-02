"use client";

import { useEffect, useRef } from "react";
import { CATEGORIES } from "../data/catalog";
import { clamp, smoothstep } from "../lib/cn";
import { closeProduct, useActiveProduct } from "../lib/product-store";
import { scroll } from "../lib/store";
import { OrbitaLogo } from "./orbita-logo";

/**
 * O modo produto.
 *
 * Clicar numa esfera da órbita abre o produto: a câmera vai até o nó, a esfera
 * cresce e ocupa a esquerda do quadro, e a metade direita recebe a roleta de
 * funcionalidades — as sub-esferas daquele produto.
 *
 * A roleta não é uma lista rolável comum. Os itens são posicionados a cada
 * frame a partir de um índice fracionário: quem está inteiro fica no centro,
 * em azul e no tamanho cheio; os vizinhos afastam, encolhem, giram um pouco no
 * eixo X e apagam. Rolar move esse índice, não a página.
 */
export function ProductMode() {
  const product = useActiveProduct();
  const root = useRef<HTMLDivElement>(null);
  const wheel = useRef<HTMLUListElement>(null);
  const items = useRef<Array<HTMLLIElement | null>>([]);
  const count = product?.features.length ?? 0;

  useEffect(() => {
    if (!product) return;
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const host = root.current;
      if (!host) return;

      const open = smoothstep(clamp(scroll.product.t));
      host.style.opacity = open.toFixed(3);
      host.style.visibility = open < 0.01 ? "hidden" : "visible";
      host.style.pointerEvents = open > 0.6 ? "auto" : "none";

      const step =
        Number.parseFloat(
          getComputedStyle(host).getPropertyValue("--o-wheel-step"),
        ) || 132;

      const current = scroll.product.feature;

      for (let i = 0; i < items.current.length; i++) {
        const el = items.current[i];
        if (!el) continue;

        const offset = i - current;
        const distance = Math.abs(offset);

        // Curva da roleta: o afastamento comprime conforme sobe na pilha, e o
        // giro em X dá a sensação de um cilindro, não de uma lista deslizando.
        const y = offset * step * (1 - Math.min(distance, 4) * 0.06);
        const scale = Math.max(0.72, 1 - distance * 0.13);
        const spin = Math.max(-26, Math.min(26, offset * -9));
        const focus = Math.max(0, 1 - distance);
        const fade = Math.max(0, 1 - distance * 0.42);

        el.style.transform = `translate3d(0, calc(-50% + ${y.toFixed(1)}px), 0) perspective(900px) rotateX(${spin.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        el.style.opacity = (fade * open).toFixed(3);
        el.style.setProperty("--focus", focus.toFixed(3));
        el.style.zIndex = String(100 - Math.round(distance * 10));
        el.style.pointerEvents = focus > 0.5 ? "auto" : "none";
      }

      if (wheel.current) {
        wheel.current.style.setProperty(
          "--o-wheel-progress",
          count > 1 ? (current / (count - 1)).toFixed(4) : "1",
        );
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [product, count]);

  if (!product) return null;

  const category = CATEGORIES.find((c) => c.id === product.category);

  return (
    <div className="o-product-mode" ref={root} style={{ opacity: 0 }}>
      {/*
        A área da esfera é clicável e fecha o produto. Não é um "fundo": é o
        caminho de volta para a órbita, do mesmo lado em que a esfera está.
      */}
      <button
        type="button"
        className="o-product-mode__back"
        onClick={closeProduct}
        aria-label="Voltar para a órbita"
      />

      <div className="o-product-mode__brand">
        <OrbitaLogo className="o-product-mode__logo" />
        <span className="o-product-mode__badge">{product.name}</span>
      </div>

      <div className="o-product-mode__panel">
        <header className="o-product-mode__head">
          <p className="o-eyebrow">{category?.title}</p>
          <h2 className="o-product-mode__title">{product.tagline}</h2>
          <p className="o-product-mode__summary">{product.summary}</p>
        </header>

        <div className="o-wheel">
          <ul className="o-wheel__list" ref={wheel}>
            {product.features.map((feature, index) => (
              <li
                className="o-wheel__item"
                key={feature.id}
                ref={(el) => {
                  items.current[index] = el;
                }}
              >
                <span className="o-wheel__ring" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="o-wheel__text">
                  <h3 className="o-wheel__title">{feature.title}</h3>
                  <p className="o-wheel__desc">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <span className="o-wheel__rail" aria-hidden="true" />
        </div>
      </div>

      <button
        type="button"
        className="o-product-mode__close"
        onClick={closeProduct}
      >
        <span>Voltar à órbita</span>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M1 1l12 12M13 1L1 13"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
}
