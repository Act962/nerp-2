"use client";

import {
  CheckCircle2,
  CreditCard,
  MessageCircle,
  PackageSearch,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useCatalogSettings } from "@/features/storefront/hooks/use-catalog-settings";
import { useOrbitaOrderStatus } from "@/features/storefront/hooks/use-orbita-checkout";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";

// O Órbita costuma responder em segundos; passado isso, a espera some da tela
// — o acompanhamento continua valendo, e o pagamento aparece lá quando vier.
const ORBITA_WAIT_LIMIT_MS = 40_000;

/**
 * A tela depois de fechar o pedido — a mais importante da jornada: é aqui que
 * o cliente decide se confia na loja. Por isso o botão de acompanhar vem
 * sempre, grande e na cor da loja, em qualquer modo de operação. O link do
 * Órbita (pagar) é um extra de quem tem a integração, não a condição.
 *
 * URL: `?pedido=<número>&venda=<id>`. Sem `venda` (link antigo), a tela ainda
 * mostra o número, só sem o acompanhamento.
 */
export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ subdomain: string }>();
  const subdomain = params.subdomain ?? "";
  const pedido = searchParams.get("pedido");
  const venda = searchParams.get("venda");

  const { data: loja } = useCatalogSettings({ subdomain });
  const homeHref = useCatalogHref("/");
  const acompanharHref = useCatalogHref(`/pedido/${venda ?? ""}`);

  // A cor da loja já vem do servidor na `--primary` (layout da vitrine):
  // usar a variável evita o botão piscar na cor padrão enquanto carrega.
  const tema = "var(--primary)";
  const corDoTema = {
    backgroundColor: tema,
    color: "var(--primary-foreground)",
  };
  const modoOrbita = loja?.operationMode === "ORBITA";
  const modoBalcao = loja?.operationMode === "APPROVAL";
  // Catálogo sem preço no Órbita: o cliente pediu orçamento, não comprou.
  const orcamento = modoOrbita && loja?.showPrices === false;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="size-12 text-emerald-600" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-3xl">
          {orcamento ? "Orçamento pedido! 🎉" : "Pedido enviado! 🎉"}
        </h1>
        <p className="opacity-70">
          {orcamento
            ? "A loja vai conferir os itens e te mandar o valor pelo WhatsApp."
            : modoBalcao
              ? "Apresente o código no caixa quando chegar à loja."
              : "A loja já recebeu seu pedido."}
        </p>
      </div>

      {pedido && (
        <div
          className="flex flex-col items-center rounded-2xl border-2 border-dashed bg-white px-10 py-5 text-neutral-900"
          style={{ borderColor: tema }}
        >
          <span className="font-medium text-neutral-500 text-xs uppercase tracking-wider">
            Número do pedido
          </span>
          <span
            className="font-bold text-5xl tracking-wider"
            style={{ color: tema }}
          >
            #{pedido}
          </span>
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        {venda && (
          <Link
            href={acompanharHref}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full font-bold text-lg shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
            style={corDoTema}
          >
            <PackageSearch className="size-6" />
            Acompanhar meu pedido
          </Link>
        )}

        {venda && modoOrbita && !orcamento && (
          <PagamentoOrbita subdomain={subdomain} saleId={venda} />
        )}

        <Link
          href={homeHref}
          className="flex h-12 w-full items-center justify-center rounded-full font-medium opacity-80 hover:opacity-100"
        >
          Voltar para a loja
        </Link>
      </div>

      {venda && (
        <p className="text-xs opacity-60">
          Guarde o link do acompanhamento: ele mostra cada etapa do pedido.
        </p>
      )}
    </div>
  );
}

/**
 * O extra do modo Órbita: quando o Órbita responde, surgem o pagamento e a
 * conversa no WhatsApp. Enquanto não responde, só um aviso discreto — o
 * botão de acompanhar, acima, já dá ao cliente o que fazer.
 */
function PagamentoOrbita({
  subdomain,
  saleId,
}: {
  subdomain: string;
  saleId: string;
}) {
  const [esgotou, setEsgotou] = useState(false);

  useEffect(() => {
    const relogio = window.setTimeout(
      () => setEsgotou(true),
      ORBITA_WAIT_LIMIT_MS,
    );
    return () => window.clearTimeout(relogio);
  }, []);

  const { data } = useOrbitaOrderStatus({
    subdomain,
    saleId,
    enabled: !esgotou,
  });

  if (data?.portalUrl) {
    return (
      <>
        <a
          href={data.portalUrl}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-current font-semibold"
        >
          <CreditCard className="size-5" /> Pagar meu pedido
        </a>
        {data.whatsappUrl && (
          <a
            href={data.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-emerald-600 font-semibold text-emerald-700"
          >
            <MessageCircle className="size-5" /> Continuar no WhatsApp
          </a>
        )}
      </>
    );
  }

  if (esgotou) return null;

  return (
    <div className="flex items-center justify-center gap-2 text-sm opacity-70">
      <Spinner />
      Preparando o pagamento…
    </div>
  );
}
