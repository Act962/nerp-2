"use client";

import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// De dois em dois segundos. PIX cai em segundos, e é o intervalo em que a tela
// não parece travada para quem está com o celular na mão esperando.
const POLL_MS = 2000;

export type CobrancaAberta = {
  id: string;
  pixPayload: string | null;
  pixQrImage: string | null;
  urlDePagamento: string | null;
  valor: number;
};

/**
 * A espera do PIX.
 *
 * Enquanto esta tela está aberta o pedido NÃO está na cozinha — é o pagamento
 * que o solta. Por isso ela diz isso em uma frase: quem fecha o navegador
 * achando que já pediu volta para buscar um lanche que ninguém começou.
 */
export function TelaDoPix({
  cobranca,
  aoDesistir,
}: {
  cobranca: CobrancaAberta;
  aoDesistir: () => void;
}) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);

  const { data } = useQuery(
    orpc.checkout.statusDoPagamento.queryOptions({
      input: { chargeId: cobranca.id },
      refetchInterval: (query) =>
        query.state.data?.pago || query.state.data?.encerrada ? false : POLL_MS,
    }),
  );

  useEffect(() => {
    if (!data?.pago) return;
    if (data.ticketId) {
      router.push(`/pedido-cliente/ticket/${data.ticketId}`);
      return;
    }
    toast.success("Pagamento confirmado! Seu pedido foi para a cozinha.");
  }, [data?.pago, data?.ticketId, router]);

  const copiar = async () => {
    if (!cobranca.pixPayload) return;
    try {
      await navigator.clipboard.writeText(cobranca.pixPayload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não consegui copiar. Segure o código para copiar à mão.");
    }
  };

  if (data?.encerrada) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <TriangleAlert className="size-12 text-amber-500" />
        <p className="text-xl font-semibold">O pagamento não foi concluído</p>
        <p className="text-muted-foreground">
          Sua sacola continua montada. Dá para tentar de novo.
        </p>
        <Button size="lg" className="h-12 w-full" onClick={aoDesistir}>
          Voltar para a sacola
        </Button>
      </div>
    );
  }

  if (data?.pago) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <Check className="size-12 text-emerald-500" />
        <p className="text-xl font-semibold">Pagamento confirmado!</p>
        <p className="text-muted-foreground">Seu pedido foi para a cozinha.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-5 text-center">
      <div>
        <p className="text-sm text-muted-foreground">Total a pagar</p>
        <p className="text-3xl font-bold">
          R$ {currencyFormatter(cobranca.valor).trim()}
        </p>
      </div>

      {cobranca.pixQrImage && (
        <Image
          src={`data:image/png;base64,${cobranca.pixQrImage}`}
          alt="QR code do PIX"
          width={240}
          height={240}
          className="rounded-xl border bg-white p-2"
          unoptimized
        />
      )}

      {cobranca.pixPayload && (
        <Button
          variant="outline"
          size="lg"
          className="h-12 w-full"
          onClick={copiar}
        >
          {copiado ? (
            <>
              <Check className="size-5" />
              Código copiado
            </>
          ) : (
            <>
              <Copy className="size-5" />
              Copiar código PIX
            </>
          )}
        </Button>
      )}

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Esperando o pagamento…
      </p>
      <p className="text-sm text-muted-foreground">
        <b>O pedido só vai para a cozinha depois que o PIX cair.</b> Assim que
        confirmar, esta tela abre o acompanhamento.
      </p>

      {cobranca.urlDePagamento && (
        <a
          href={cobranca.urlDePagamento}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Abrir a página de pagamento
        </a>
      )}

      <Button variant="ghost" onClick={aoDesistir}>
        Voltar
      </Button>
    </div>
  );
}
