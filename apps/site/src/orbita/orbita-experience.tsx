"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useAssetProgress } from "./hooks/use-asset-progress";
import { useEnvironment } from "./hooks/use-environment";
import { useScrollTimeline } from "./hooks/use-scroll-timeline";
import { OrbitaFallback } from "./fallback/orbita-fallback";
import { Nav } from "./ui/nav";
import {
  About,
  FinalCTA,
  Hero,
  Impact,
  SuiteSections,
  ToolLabels,
} from "./ui/sections";
import { Footer } from "./ui/footer";
import { AdvanceButton } from "./ui/advance";
import { WhatsAppButton } from "./ui/whatsapp";
import { BrandSpinner } from "./ui/brand-spinner";
import { Intro } from "./ui/intro";
import { ProductMode } from "./ui/product-mode";
import { ProgressRail } from "./ui/chrome";
import "./orbita.css";

/*
  A cena 3D entra por import dinâmico.

  Duas razões, nesta ordem: o bundle do three.js não pesa no carregamento
  inicial de quem chega pelo caminho sem WebGL, e o módulo nunca é avaliado no
  servidor — o Canvas do React Three Fiber só existe no cliente.
*/
const OrbitaScene = lazy(() =>
  import("./scene/orbita-scene").then((m) => ({ default: m.OrbitaScene })),
);

/**
 * ÓRBITA HUB — raiz da experiência.
 *
 * A ordem importa: o servidor entrega a versão em HTML puro (todo o conteúdo
 * indexável, funcional sem JavaScript). No cliente, se houver WebGL e o
 * usuário não pedir movimento reduzido, a experiência 3D assume o lugar.
 * Ninguém vê uma tela quebrada em nenhum dos caminhos.
 */
export function OrbitaExperience({
  /** Para onde o CTA da navegação e o card do NERP apontam. */
  appHref = "/login",
  signupHref = "/cadastro",
}: {
  appHref?: string;
  signupHref?: string;
} = {}) {
  const env = useEnvironment();
  const root = useRef<HTMLDivElement>(null);
  const immersive = env.ready && env.webgl && !env.reducedMotion;

  useScrollTimeline({
    target: root,
    enabled: immersive,
    reducedMotion: env.reducedMotion,
  });

  if (!immersive) return <OrbitaFallback appHref={appHref} />;

  return (
    <div className="orbita-root" ref={root}>
      <div className="orbita-stage">
        <div className="orbita-canvas">
          <Suspense fallback={null}>
            <OrbitaScene quality={env.quality} compact={env.compact} />
          </Suspense>
        </div>

        <div className="orbita-vignette" />

        <div className="orbita-layer">
          <Intro />
          <Nav ctaHref={appHref} signupHref={signupHref} />

          <Hero />
          <SuiteSections />
          <ToolLabels />
          <Impact />
          <About />
          <FinalCTA />
          <Footer />

          <ProgressRail />
          <ProductMode />
          <AdvanceButton />
          <WhatsAppButton />
        </div>

        <LoadingVeil />
      </div>
    </div>
  );
}

/** Véu de carregamento: some quando as texturas do planeta terminam de chegar. */
function LoadingVeil() {
  const { active, progress } = useAssetProgress();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (active) return;
    const t = setTimeout(() => setGone(true), 620);
    return () => clearTimeout(t);
  }, [active]);

  if (gone) return null;

  return (
    <div className="o-veil" data-done={active ? "false" : "true"}>
      {/* O símbolo girando no lugar do texto: a espera é a mesma, mas quem
          está olhando vê a marca em vez de ler uma frase. A barra fica —
          ela carrega informação de verdade, o quanto já chegou. */}
      <BrandSpinner />
      <div className="o-veil__bar">
        <span style={{ width: `${Math.round(progress)}%` }} />
      </div>
      <output className="o-veil__sr">Carregando a experiência</output>
    </div>
  );
}
