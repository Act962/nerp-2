"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOrbitaOrderStatus } from "@/features/storefront/hooks/use-orbita-checkout";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// O Órbita costuma responder em segundos; passado isso, a loja segue o
// pedido pelo telefone e o cliente não fica olhando um carregamento eterno.
const ORBITA_WAIT_LIMIT_MS = 40_000;

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ subdomain: string }>();
  // No modo APPROVAL o server devolve `saleNumber` — a URL vira
  // `/checkout/sucesso?pedido=42` e mostramos o número BEM grande pra o
  // cliente apresentar no caixa quando chegar na loja. No modo ORBITA vem
  // também `venda=<id>`, para acompanhar a resposta do Órbita.
  const pedido = searchParams.get("pedido");
  const venda = searchParams.get("venda");

  if (venda) {
    return (
      <OrbitaSuccess
        subdomain={params.subdomain ?? ""}
        saleId={venda}
        saleNumber={pedido}
        onBack={() => router.push("/")}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="size-12 text-green-600" />
      </div>

      <h1 className="mb-3 text-3xl font-bold">Pedido enviado! 🎉</h1>

      {pedido ? (
        <>
          <p className="mb-4 text-lg text-muted-foreground">
            Apresente o código do pedido no caixa quando chegar à loja:
          </p>
          <div className="mb-6 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 px-8 py-6">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Código do pedido
            </span>
            <p className="text-5xl font-bold tracking-wider text-primary">
              #{pedido}
            </p>
          </div>
          <p className="mb-8 text-sm text-muted-foreground">
            O operador vai localizar seu pedido pelo código ou pelo seu nome.
            Obrigado pela preferência!
          </p>
        </>
      ) : (
        <>
          <p className="mb-2 text-lg text-muted-foreground">
            Seu pedido foi confirmado e já foi enviado para a cozinha.
          </p>
          <p className="mb-8 text-muted-foreground">
            Em breve ele estará pronto. Obrigado pela preferência!
          </p>
        </>
      )}

      <Button size="lg" onClick={() => router.push("/")}>
        Voltar para o início
      </Button>
    </div>
  );
}

function OrbitaSuccess({
  subdomain,
  saleId,
  saleNumber,
  onBack,
}: {
  subdomain: string;
  saleId: string;
  saleNumber: string | null;
  onBack: () => void;
}) {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setHasTimedOut(true),
      ORBITA_WAIT_LIMIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  const { data } = useOrbitaOrderStatus({
    subdomain,
    saleId,
    enabled: !hasTimedOut,
  });
  const portalUrl = data?.portalUrl ?? null;
  const whatsappUrl = data?.whatsappUrl ?? null;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="size-12 text-green-600" />
      </div>

      <h1 className="mb-3 text-3xl font-bold">Pedido enviado! 🎉</h1>
      {saleNumber && (
        <p className="mb-6 text-lg text-muted-foreground">
          Pedido{" "}
          <span className="font-semibold text-foreground">#{saleNumber}</span>
        </p>
      )}

      {portalUrl ? (
        <div className="mb-8 flex w-full max-w-sm flex-col gap-3">
          <p className="mb-2 text-muted-foreground">
            A loja recebeu seu pedido. Acompanhe e faça o pagamento por aqui:
          </p>
          <Button size="lg" asChild>
            <a href={portalUrl}>Acompanhar e pagar meu pedido</a>
          </Button>
          {whatsappUrl && (
            <Button size="lg" variant="outline" asChild>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" />
                Continuar no WhatsApp
              </a>
            </Button>
          )}
        </div>
      ) : hasTimedOut ? (
        <p className="mb-8 text-muted-foreground">
          Seu pedido foi registrado. A loja vai entrar em contato pelo WhatsApp
          informado para combinar o pagamento e a entrega.
        </p>
      ) : (
        <div className="mb-8 flex items-center gap-3 text-muted-foreground">
          <Spinner />
          <span>Enviando seu pedido para a loja…</span>
        </div>
      )}

      <Button size="lg" variant="ghost" onClick={onBack}>
        Voltar para o início
      </Button>
    </div>
  );
}
