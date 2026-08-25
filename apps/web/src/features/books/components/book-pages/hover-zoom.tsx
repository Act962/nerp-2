"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface HoverZoomProps {
  children: React.ReactNode;
  // Fator de ampliação da lupa.
  zoom?: number;
  // Lado do quadrado da lupa, em px.
  size?: number;
  // Tempo de hover (ms) antes da lupa aparecer.
  delayMs?: number;
  className?: string;
}

// Lupa de inspeção: com o mouse parado ~2,5s sobre a área, mostra um quadrado
// com o zoom do ponto sob o cursor; depois de aberta, acompanha o cursor até
// sair da área. Reaproveita o próprio conteúdo (a prévia é posicionada em
// `cqw`, então escala sozinha num container maior) — nada de captura de imagem.
// A lupa segue o cursor via portal e não intercepta cliques (pointer-events
// none).
export function HoverZoom({
  children,
  zoom = 2.5,
  size = 260,
  delayMs = 2500,
  className,
}: HoverZoomProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const track = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      setRect(ref.current?.getBoundingClientRect() ?? null);
      setCursor({ x, y });
    });
  };

  const startTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(true), delayMs);
  };

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setActive(false);
  };

  // Geometria da lupa a partir do retângulo atual da área e do cursor.
  let loupe: React.ReactNode = null;
  if (mounted && active && rect && rect.width > 0) {
    const fx = Math.min(Math.max((cursor.x - rect.left) / rect.width, 0), 1);
    const fy = Math.min(Math.max((cursor.y - rect.top) / rect.height, 0), 1);
    const contentW = rect.width * zoom;
    const contentH = rect.height * zoom;
    const tx = size / 2 - fx * contentW;
    const ty = size / 2 - fy * contentH;

    // Posiciona o quadrado perto do cursor, sem sair da viewport.
    const gap = 24;
    let left = cursor.x + gap;
    let top = cursor.y + gap;
    if (typeof window !== "undefined") {
      if (left + size > window.innerWidth) left = cursor.x - gap - size;
      if (top + size > window.innerHeight) top = cursor.y - gap - size;
      left = Math.max(8, left);
      top = Math.max(8, top);
    }

    loupe = createPortal(
      <div
        aria-hidden
        style={{
          position: "fixed",
          left,
          top,
          width: size,
          height: size,
          overflow: "hidden",
          borderRadius: 12,
          border: "2px solid var(--border)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          background: "var(--background)",
          pointerEvents: "none",
          zIndex: 70,
        }}
      >
        <div
          style={{ width: contentW, transform: `translate(${tx}px, ${ty}px)` }}
        >
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: lupa puramente visual (hover do mouse), sem ação nem equivalente de teclado
    <div
      ref={ref}
      className={className}
      onMouseEnter={(e) => {
        track(e);
        startTimer();
      }}
      onMouseMove={(e) => {
        track(e);
        // Enquanto o mouse se move, re-arma o timer (aparece com o cursor
        // parado). Já aberta, apenas acompanha o cursor.
        if (!active) startTimer();
      }}
      onMouseLeave={stop}
    >
      {children}
      {loupe}
    </div>
  );
}
