"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { scroll } from "../lib/store";
import { closeProduct } from "../lib/product-store";
import { updateReveals, settleReveals } from "../lib/reveal";
import { clamp, damp, smoothstep } from "../lib/cn";
import { INTRO_SHARE } from "../lib/timeline";

let registered = false;

// A fatia da abertura mora em `lib/timeline.ts`, junto do comprimento total
// da viagem e do remapeamento — as três coisas mudam sempre juntas.

/** Instância viva do Lenis — a navegação precisa dela para viajar suavemente. */
let activeLenis: Lenis | null = null;

type Options = {
  /** Elemento que define o comprimento total da viagem. */
  target: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  reducedMotion: boolean;
};

/**
 * O scroll é o controlador da experiência.
 *
 * Lenis dá a inércia (o scroll nativo é degrau demais para uma câmera),
 * ScrollTrigger converte a posição real da página em um progresso 0→1, e um
 * único rAF suaviza esse valor e atualiza todos os overlays. A cena 3D lê o
 * mesmo objeto dentro do seu próprio loop de render.
 */
export function useScrollTimeline({ target, enabled, reducedMotion }: Options) {
  useEffect(() => {
    if (!enabled) return;

    if (reducedMotion) {
      // Sem inércia, sem câmera perseguindo: o conteúdo simplesmente existe.
      scroll.progress = 0;
      scroll.smooth = 0;
      scroll.intro = 1;
      settleReveals();
      return;
    }

    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }

    const lenis = new Lenis({
      duration: 1.15,
      lerp: 0.09,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
      smoothWheel: true,
    });

    activeLenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const trigger = ScrollTrigger.create({
      trigger: target.current ?? undefined,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const raw = self.progress;
        scroll.intro = clamp(raw / INTRO_SHARE);
        scroll.progress = clamp((raw - INTRO_SHARE) / (1 - INTRO_SHARE));
        scroll.velocity = self.getVelocity() / 6000;
      },
    });

    if (typeof window !== "undefined") {
      (window as unknown as { __orbita?: unknown }).__orbita = scroll;
    }

    /*
      A roleta assume a rolagem.

      Com um produto aberto, o Lenis é parado e a roda do mouse deixa de mover
      a página: ela passa a girar a lista de funcionalidades. É a mesma
      interação — rolar — apontada para outro eixo, e é isso que faz o modo
      produto parecer parte da experiência, e não uma janela por cima dela.
    */
    let featureTarget = 0;
    let locked = false;

    const clampFeature = (value: number) =>
      Math.max(0, Math.min(scroll.product.featureCount - 1, value));

    const onWheel = (event: WheelEvent) => {
      if (!scroll.product.id) return;
      event.preventDefault();
      featureTarget = clampFeature(featureTarget + event.deltaY * 0.0042);
    };

    let touchY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!scroll.product.id) return;
      event.preventDefault();
      const y = event.touches[0]?.clientY ?? touchY;
      featureTarget = clampFeature(featureTarget + (touchY - y) * 0.012);
      touchY = y;
    };

    const onKey = (event: KeyboardEvent) => {
      if (!scroll.product.id) return;
      if (event.key === "Escape") {
        closeProduct();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        featureTarget = clampFeature(Math.round(featureTarget) + 1);
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        featureTarget = clampFeature(Math.round(featureTarget) - 1);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);

    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      scroll.time += dt;
      scroll.smooth = damp(scroll.smooth, scroll.progress, 6.5, dt);
      scroll.velocity = damp(scroll.velocity, 0, 4, dt);

      // Abertura e fechamento do produto, e o giro da roleta.
      const open = scroll.product.id !== null;
      if (open !== locked) {
        locked = open;
        if (open) {
          featureTarget = 0;
          lenis.stop();
        } else {
          lenis.start();
        }
      }
      scroll.product.t = damp(scroll.product.t, open ? 1 : 0, 6, dt);
      scroll.product.feature = damp(
        scroll.product.feature,
        featureTarget,
        9,
        dt,
      );
      /*
        Enquanto a cortina desce, o conteúdo do hero fica atrás da linha de
        entrada. Deslocar o progresso — em vez de travar em zero — faz o texto
        subir junto com a revelação, em vez de aparecer de uma vez no fim.
      */
      const veil = 1 - smoothstep(clamp(scroll.intro));
      updateReveals(
        scroll.smooth - veil * 0.2,
        1 - smoothstep(clamp(scroll.product.t)),
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onPointer = (e: PointerEvent) => {
      scroll.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scroll.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointer);
      gsap.ticker.remove(tick);
      trigger.kill();
      if (activeLenis === lenis) activeLenis = null;
      lenis.destroy();
    };
  }, [enabled, reducedMotion, target]);
}

/**
 * Navegação do menu: leva a página até o ponto da órbita daquela seção.
 *
 * Vai pelo Lenis, não pelo `window.scrollTo`: o scroll suave nativo briga com
 * a inércia do Lenis e produz um solavanco no meio do caminho.
 */
export function scrollToProgress(p: number, immediate = false) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  // `p` é progresso da órbita; o scroll da página inclui a cortina antes dela.
  const top = max * (INTRO_SHARE + p * (1 - INTRO_SHARE));

  if (activeLenis) {
    /*
      `immediate` existe para quem abre um produto direto do menu.

      Abrir um produto para o Lenis. Uma viagem suave iniciada logo antes seria
      congelada no meio do caminho, e ao fechar o produto a órbita apareceria
      num ponto que ninguém pediu. Posicionar de uma vez e só então abrir
      mantém o retorno coerente.
    */
    activeLenis.scrollTo(
      top,
      immediate ? { immediate: true } : { duration: 1.8 },
    );
    return;
  }
  window.scrollTo({ top, behavior: immediate ? "auto" : "smooth" });
}
