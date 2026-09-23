"use client";

import { AstroWidget, type FalhaDoAstro } from "@nerp/astro-widget";
import { normalizePhone } from "@/utils/format-phone";

interface AstroDaLojaProps {
  subdomain: string;
  loja: string;
  whatsapp: string | null;
}

/**
 * O Astro na vitrine.
 *
 * O mesmo widget do site e do app; o que muda é o destino — a rota pública da
 * loja, que resolve o inquilino pelo subdomínio e debita as ★ da organização
 * dona do catálogo.
 *
 * O visitante é anônimo e NÃO vê saldo: quando as ★ acabam, ele não tem o que
 * fazer a respeito, então o 402 vira uma frase de atendente ("me chama no
 * WhatsApp") em vez do botão de recarga que aparece do lado de dentro.
 */
export function AstroDaLoja({ subdomain, loja, whatsapp }: AstroDaLojaProps) {
  const numero = whatsapp ? normalizePhone(whatsapp) : "";
  const whatsappHref = numero ? `https://wa.me/55${numero}` : undefined;

  const aoFalhar = (falha: FalhaDoAstro) => {
    if (falha.status !== 402 && falha.status !== 503) return null;
    return (
      <div className="o-astro-cta">
        <p className="o-astro-cta__linha">
          O atendimento automático está indisponível agora.
          {whatsappHref ? " Fale com a gente no WhatsApp." : ""}
        </p>
      </div>
    );
  };

  return (
    <AstroWidget
      api={`/api/catalogo/${subdomain}/astro/chat`}
      abertura={`O que você está procurando na ${loja}?`}
      sugestoes={SUGESTOES}
      consentimento
      whatsappHref={whatsappHref}
      nota="O Astro é uma inteligência artificial e pode errar. Confirme preço e disponibilidade com a loja."
      aoFalhar={aoFalhar}
    />
  );
}

const SUGESTOES = [
  { texto: "O que vocês vendem?", envio: "O que vocês vendem?" },
  {
    texto: "Formas de pagamento e entrega",
    envio: "Quais são as formas de pagamento e de entrega?",
  },
];
