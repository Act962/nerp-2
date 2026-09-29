"use client";

import type { SiteConversao } from "@nerp/site-content";
import { useEffect, useState } from "react";
import { registrarMetrica } from "@/features/metricas/evento";
import { BotaoDeConversao } from "./acao";
import { jaVisto, marcarVisto } from "./memoria";

const CHAVE = "orbita:barra-fechada";

/** Quanto da página já foi rolado, de 0 a 100. Página curta conta como 100. */
function rolado(): number {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  if (total <= 0) return 100;
  return (window.scrollY / total) * 100;
}

/**
 * A barra fixa no rodapé da tela. Aparece depois de a pessoa rolar parte da
 * página — quem acabou de chegar ainda não sabe o que está sendo oferecido — e
 * some pelo resto da visita quando fechada.
 */
export function BarraFixa({
  config,
  whatsappHref,
  astroAtivo,
}: {
  config: SiteConversao["barra"];
  whatsappHref: string;
  astroAtivo: boolean;
}) {
  const [visivel, setVisivel] = useState(false);
  const [fechada, setFechada] = useState(true);

  useEffect(() => {
    if (!config.ativo) return;
    setFechada(jaVisto(CHAVE, "visita"));
  }, [config.ativo]);

  useEffect(() => {
    if (!config.ativo || fechada) return;
    let registrada = false;
    const conferir = () => {
      const passou = rolado() >= config.aposRolar;
      setVisivel(passou);
      if (passou && !registrada) {
        registrada = true;
        registrarMetrica("Barra fixa: exibida");
      }
    };
    conferir();
    window.addEventListener("scroll", conferir, { passive: true });
    window.addEventListener("resize", conferir, { passive: true });
    return () => {
      window.removeEventListener("scroll", conferir);
      window.removeEventListener("resize", conferir);
    };
  }, [config.ativo, config.aposRolar, fechada]);

  if (!config.ativo || fechada) return null;

  return (
    <aside
      className="o-barra"
      data-visivel={visivel}
      aria-hidden={!visivel}
      aria-label="Chamada"
    >
      <p className="o-barra__texto">{config.texto}</p>
      <BotaoDeConversao
        acao={config.acao}
        link={config.link}
        whatsappHref={whatsappHref}
        astroAtivo={astroAtivo}
        texto={config.botao}
        metrica={`Barra fixa: ${config.botao}`}
        className="o-conversao__botao"
      />
      <button
        type="button"
        className="o-barra__fechar"
        aria-label="Fechar"
        data-metrica="Barra fixa: fechar"
        tabIndex={visivel ? 0 : -1}
        onClick={() => {
          marcarVisto(CHAVE, "visita");
          setFechada(true);
        }}
      >
        ×
      </button>
    </aside>
  );
}
