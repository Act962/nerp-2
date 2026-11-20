"use client";

import {
  type AcaoNoCliente,
  AstroWidget,
  type FalhaDoAstro,
} from "@nerp/astro-widget";
import { useRouter } from "next/navigation";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";
import { useCart } from "@/hooks/use-cart";
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
  const router = useRouter();
  const { products, toggleProduct, updateQuantity } = useCart(subdomain);
  const cartHref = useCatalogHref("/cart");
  const checkoutHref = useCatalogHref("/checkout");

  // O Astro escolhe com o cliente; o carrinho mora aqui no navegador.
  const aoAcaoNoCliente = (acao: AcaoNoCliente) => {
    if (acao.tipo === "adicionar_ao_carrinho") {
      const productId = String(acao.productId ?? "");
      const quantidade = Number(acao.quantidade ?? 0);
      if (!productId || !Number.isFinite(quantidade) || quantidade <= 0) return;
      const noCarrinho = products.find((item) => item.productId === productId);
      if (noCarrinho) {
        updateQuantity(
          productId,
          subdomain,
          String(Number(noCarrinho.quantity) + quantidade),
        );
      } else {
        // Fora do carrinho, `toggleProduct` adiciona.
        toggleProduct(productId, String(quantidade));
      }
      return;
    }
    if (acao.tipo === "abrir_carrinho") router.push(cartHref);
    if (acao.tipo === "finalizar_pedido") router.push(checkoutHref);
  };

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
      aoAcaoNoCliente={aoAcaoNoCliente}
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
