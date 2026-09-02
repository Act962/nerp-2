"use client";

import { useEffect } from "react";
import { scroll } from "../lib/store";
import { isLight } from "../lib/timeline";

/**
 * A tinta do cromo, enquanto o fundo é claro.
 *
 * Do branco da nuvem ao fim do sobrevoo são quatro tempos de fundo claro, e a
 * barra, o logotipo e o trilho são claros — sumiriam. A marcação vive na raiz
 * porque o fundo não é da barra, é a cena inteira.
 *
 * A troca é escrita quando o progresso cruza a borda, e não a cada quadro. A
 * borda cai dentro da nuvem cheia, onde não há o que ver.
 *
 * Este componente já foi a travessia inteira — véu branco, escurecimento e
 * nave. Os três viraram cena 3D (`scene/cloud-pass.tsx`, `scene/craft-pass.tsx`)
 * quando a nuvem deixou de ser um retângulo com opacidade; o que sobrou no DOM
 * é o que é DOM: a cor do texto.
 */
export function LightChrome() {
  useEffect(() => {
    const raiz = document.querySelector(".orbita-root");
    if (!raiz) return;

    let raf = 0;
    let ultimo: boolean | null = null;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const claro = isLight(scroll.smooth);
      if (claro === ultimo) return;
      ultimo = claro;
      raiz.setAttribute("data-claro", claro ? "true" : "false");
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      raiz.removeAttribute("data-claro");
    };
  }, []);

  return null;
}
