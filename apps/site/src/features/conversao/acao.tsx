"use client";

import { abrirAstro } from "@nerp/astro-widget";
import type { AcaoDeConversao } from "@nerp/site-content";

/**
 * O botão de um recurso de conversão. Link e WhatsApp são `<a>` de verdade —
 * abrir em aba nova e copiar endereço continuam funcionando —; o Astro é
 * `<button>`, porque não há endereço para onde ir.
 *
 * `data-metrica` é o que o medidor usa como rótulo do clique: é assim que a
 * aba Métricas separa "Agendar demonstração" da barra do mesmo texto no menu.
 */
export function BotaoDeConversao({
  acao,
  link,
  whatsappHref,
  astroAtivo,
  texto,
  metrica,
  className,
  aoAgir,
}: {
  acao: AcaoDeConversao;
  link: string;
  whatsappHref: string;
  astroAtivo: boolean;
  texto: string;
  metrica: string;
  className: string;
  aoAgir?: () => void;
}) {
  // Astro desligado no painel: o botão não pode abrir nada. O WhatsApp é a
  // saída humana que sempre existe.
  const efetiva = acao === "astro" && !astroAtivo ? "whatsapp" : acao;

  if (efetiva === "astro") {
    return (
      <button
        type="button"
        className={className}
        data-metrica={metrica}
        onClick={() => {
          aoAgir?.();
          abrirAstro();
        }}
      >
        {texto}
      </button>
    );
  }

  const href = efetiva === "whatsapp" ? whatsappHref : link;
  const externo = href.startsWith("https://");
  return (
    <a
      href={href}
      className={className}
      data-metrica={metrica}
      onClick={() => aoAgir?.()}
      {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {texto}
    </a>
  );
}
