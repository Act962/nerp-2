"use client";

import { useEffect, useState } from "react";

/** Abaixo disso a barra fica sempre à vista: no topo da página ela não atrapalha. */
const TOPO_PX = 80;
/** Rolagem mínima para mudar: tremida do dedo não pisca a barra. */
const LIMIAR_PX = 8;

/**
 * A barra inferior da vitrine some ao rolar para baixo e volta ao subir. No
 * navegador do celular ela dividia a tela com a barra do próprio navegador;
 * instalado como app (tela cheia), não há essa disputa e ela fica fixa.
 */
export function useEscondeAoRolar(): boolean {
  const [isEscondida, setIsEscondida] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    let ultimoY = window.scrollY;
    function aoRolar() {
      const y = window.scrollY;
      if (y < TOPO_PX) setIsEscondida(false);
      else if (y - ultimoY > LIMIAR_PX) setIsEscondida(true);
      else if (ultimoY - y > LIMIAR_PX) setIsEscondida(false);
      if (Math.abs(y - ultimoY) > LIMIAR_PX) ultimoY = y;
    }
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return isEscondida;
}
