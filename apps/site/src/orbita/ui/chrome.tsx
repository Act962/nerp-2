"use client";

import { useEffect, useRef } from "react";
import { scroll } from "../lib/store";
import { useReveal } from "../hooks/use-reveal";

/** Convite discreto para a primeira rolagem. Some assim que a viagem começa. */
export function ScrollHint() {
  const ref = useReveal({
    inStart: -0.03,
    inEnd: -0.005,
    outStart: 0.008,
    outEnd: 0.04,
    y: 8,
    blur: 3,
  });

  return (
    <div className="o-block" style={{ inset: 0, pointerEvents: "none" }}>
      <div className="o-scrollhint" ref={ref}>
        <span className="o-scrollhint__track" />
        <span>Role para orbitar</span>
      </div>
    </div>
  );
}

/** Trilho lateral: mostra em que ponto da órbita o usuário está. */
export function ProgressRail() {
  const rail = useRef<HTMLDivElement>(null);
  const wrap = useReveal<HTMLDivElement>({
    inStart: 0.03,
    inEnd: 0.08,
    outStart: 0.94,
    outEnd: 0.985,
    y: 0,
    blur: 0,
    scale: 1,
  });

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      rail.current?.style.setProperty("--p", scroll.smooth.toFixed(4));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="o-progress" ref={wrap} aria-hidden="true">
      <span className="o-progress__label">Órbita</span>
      <div className="o-progress__rail" ref={rail}>
        <span className="o-progress__fill" />
      </div>
    </div>
  );
}
