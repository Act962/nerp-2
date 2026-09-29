"use client";

import type { SiteConversao } from "@nerp/site-content";
import { useEffect, useRef, useState } from "react";
import { registrarMetrica } from "@/features/metricas/evento";
import { BotaoDeConversao } from "./acao";
import { jaVisto, marcarVisto } from "./memoria";

const CHAVE = "orbita:saida-vista";
/** Antes disto a pessoa nem leu nada: sair cedo não é intenção, é engano. */
const CARENCIA_MS = 8000;

/**
 * O aviso de saída.
 *
 * No computador, o sinal é o mouse deixando a janela pelo topo — a caminho da
 * aba ou do "fechar". No celular não há mouse: o sinal é rolar de volta para
 * cima depressa, que é o gesto de quem desistiu da página e procura a barra
 * de endereço. Não sequestra o botão "voltar" do navegador, como o Órbita
 * Pages faz: prender alguém numa página é o oposto de convencer.
 */
export function AvisoDeSaida({
  config,
  whatsappHref,
  astroAtivo,
}: {
  config: SiteConversao["saida"];
  whatsappHref: string;
  astroAtivo: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const botaoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!config.ativo) return;
    const alcance = config.umaVezPorVisitante ? "visitante" : "visita";
    if (jaVisto(CHAVE, alcance) || jaVisto(CHAVE, "visita")) return;

    const inicio = Date.now();
    let disparado = false;

    const disparar = () => {
      if (disparado || Date.now() - inicio < CARENCIA_MS) return;
      // O aviso de cookies é a primeira decisão da visita: não empilhar.
      if (document.querySelector(".o-cookies")) return;
      disparado = true;
      marcarVisto(CHAVE, alcance);
      marcarVisto(CHAVE, "visita");
      setAberto(true);
      registrarMetrica("Aviso de saída: exibido");
    };

    const aoSairDaJanela = (evento: MouseEvent) => {
      if (evento.relatedTarget === null && evento.clientY <= 0) disparar();
    };

    // Rolagem para cima de mais de meia tela em menos de meio segundo, já
    // tendo descido na página.
    let ultimo = { y: window.scrollY, t: Date.now() };
    const aoRolar = () => {
      const agora = { y: window.scrollY, t: Date.now() };
      const subiu = ultimo.y - agora.y;
      const tempo = agora.t - ultimo.t;
      if (
        subiu > window.innerHeight * 0.5 &&
        tempo < 500 &&
        ultimo.y > window.innerHeight
      ) {
        disparar();
      }
      if (tempo > 150) ultimo = agora;
    };

    const toque = window.matchMedia("(pointer: coarse)").matches;
    if (toque) window.addEventListener("scroll", aoRolar, { passive: true });
    else document.addEventListener("mouseout", aoSairDaJanela);

    return () => {
      window.removeEventListener("scroll", aoRolar);
      document.removeEventListener("mouseout", aoSairDaJanela);
    };
  }, [config.ativo, config.umaVezPorVisitante]);

  useEffect(() => {
    if (!aberto) return;
    botaoRef.current?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  if (!aberto) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(config.cupom);
      setCopiado(true);
    } catch {
      // Sem permissão de área de transferência: o cupom está à vista.
    }
  };

  return (
    <div className="o-saida">
      {/* O fundo fecha no clique. Fora da ordem do Tab: pelo teclado, quem
          fecha é o Esc ou o × da caixa. */}
      <button
        type="button"
        className="o-saida__fundo"
        aria-label="Fechar"
        tabIndex={-1}
        data-metrica="Aviso de saída: fechar"
        onClick={() => setAberto(false)}
      />
      <div
        className="o-saida__caixa"
        role="dialog"
        aria-modal="true"
        aria-labelledby="o-saida-titulo"
      >
        <button
          type="button"
          className="o-saida__fechar"
          aria-label="Fechar"
          data-metrica="Aviso de saída: fechar"
          onClick={() => setAberto(false)}
        >
          ×
        </button>
        <h2 id="o-saida-titulo" className="o-saida__titulo">
          {config.titulo}
        </h2>
        <p className="o-saida__texto">{config.texto}</p>

        {config.cupom && (
          <div className="o-saida__cupom">
            <code>{config.cupom}</code>
            <button
              type="button"
              className="o-saida__copiar"
              data-metrica="Aviso de saída: copiar cupom"
              onClick={copiar}
            >
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}

        <span
          ref={(elemento) => {
            botaoRef.current =
              elemento?.querySelector<HTMLElement>("a, button") ?? null;
          }}
          className="o-saida__acao"
        >
          <BotaoDeConversao
            acao={config.acao}
            link={config.link}
            whatsappHref={whatsappHref}
            astroAtivo={astroAtivo}
            texto={config.botao}
            metrica={`Aviso de saída: ${config.botao}`}
            className="o-conversao__botao"
            aoAgir={() => setAberto(false)}
          />
        </span>
      </div>
    </div>
  );
}
