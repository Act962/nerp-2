"use client";

import { useEffect, useRef } from "react";
import { useSiteContent } from "../lib/content-context";
import { scroll } from "../lib/store";
import { clamp, smoothstep } from "../lib/cn";
import { WhatsAppGlyph } from "./icons";

/**
 * O botão de WhatsApp.
 *
 * Fica fora da narrativa do scroll de propósito: é o atalho que existe em
 * qualquer ponto da viagem, e some só enquanto a cortina de abertura cobre a
 * tela — antes disso não há o que perguntar.
 *
 * A opacidade é escrita no loop, não pelo React: ela acompanha `scroll.intro`,
 * que muda a cada frame.
 *
 * O loop também é quem o tira de cena quando um painel da barra abre. Fazer
 * isso pelo CSS exigiria `!important` para vencer o estilo inline que o
 * próprio loop escreve — mais simples é ter um dono só para a opacidade.
 */
export function WhatsAppButton() {
  const ref = useRef<HTMLAnchorElement>(null);
  const { whatsapp } = useSiteContent();

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = ref.current;
      if (!el) return;
      const arrived = smoothstep(clamp((scroll.intro - 0.72) / 0.28));
      const shown = scroll.menuOpen ? 0 : arrived;
      el.style.opacity = shown.toFixed(3);
      el.style.transform = `translate3d(0, ${((1 - shown) * 14).toFixed(1)}px, 0)`;
      el.style.pointerEvents = shown > 0.6 ? "auto" : "none";
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <a
      ref={ref}
      className="o-whatsapp"
      href={whatsapp.href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Falar no WhatsApp"
      style={{ opacity: 0 }}
    >
      <WhatsAppGlyph />
    </a>
  );
}
