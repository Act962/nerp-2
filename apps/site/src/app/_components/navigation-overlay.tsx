"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandSpinner } from "@/orbita/ui/brand-spinner";
import "./navigation-overlay.css";

/**
 * O carregamento entre páginas do site.
 *
 * Clicou numa solução: a tela escurece e desfoca, e o símbolo oficial gira no
 * centro até a página nova entrar. É a marca fazendo o trabalho de um
 * carregador — nada foi redesenhado, é o mesmo arquivo da cortina de abertura.
 *
 * Por que um overlay e não o `loading.tsx` do Next: o `loading.tsx` substitui
 * o conteúdo da rota nova, e o que se quer aqui é o contrário — a página atual
 * continua atrás, fora de foco, e a viagem acontece por cima dela. É também o
 * que dá a sensação de continuidade com a cena 3D, que não é recarregada.
 *
 * O gatilho é o clique em qualquer link interno, capturado no documento em vez
 * de instrumentado item por item: os links nascem em três painéis diferentes e
 * em componentes que não conhecem navegação. Um ouvinte só, no lugar mais
 * alto, é menos peça para manter e não esquece um caminho novo.
 */

/**
 * O overlay fica no máximo isto na tela.
 *
 * Some no que vier primeiro: a rota nova entrando, ou este limite. Uma página
 * do site é estática e chega bem antes disso — e, se algo travar, é melhor
 * devolver a tela do que segurar a pessoa olhando um símbolo girar.
 */
const LIMITE_MS = 1500;

export function NavigationOverlay() {
  const pathname = usePathname();
  const [carregando, setCarregando] = useState(false);

  // Rota mudou = chegou. É o sinal mais confiável de fim de navegação no App
  // Router; não existe evento público de "terminou".
  // biome-ignore lint/correctness/useExhaustiveDependencies: o efeito existe para reagir à troca de rota, não ao estado.
  useEffect(() => {
    setCarregando(false);
  }, [pathname]);

  useEffect(() => {
    function aoClicar(event: MouseEvent) {
      // Clique com modificador abre em outra aba: a página atual não muda.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const alvo = event.target as HTMLElement | null;
      const link = alvo?.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;

      const href = link.getAttribute("href");
      // Só navegação interna: endereço absoluto, âncora e download saem daqui
      // sem trocar de página — mostrar o carregamento seria mentira.
      if (!href?.startsWith("/")) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      if (href === window.location.pathname) return;

      setCarregando(true);
    }

    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, []);

  useEffect(() => {
    if (!carregando) return;
    const id = window.setTimeout(() => setCarregando(false), LIMITE_MS);
    // Voltar pelo histórico não passa por clique: sem isto o overlay ficaria
    // pendurado se a pessoa saísse da página no meio.
    const aoSair = () => setCarregando(false);
    window.addEventListener("pagehide", aoSair);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pagehide", aoSair);
    };
  }, [carregando]);

  return (
    <div
      className="o-loading"
      data-on={carregando ? "true" : "false"}
      aria-hidden={!carregando}
    >
      <BrandSpinner />
      <output className="o-loading__sr">
        {carregando ? "Carregando a página" : ""}
      </output>
    </div>
  );
}
