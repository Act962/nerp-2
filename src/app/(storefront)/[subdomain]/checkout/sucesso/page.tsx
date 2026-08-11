"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // No modo APPROVAL o server devolve `saleNumber` — a URL vira
  // `/checkout/sucesso?pedido=42` e mostramos o número BEM grande pra o
  // cliente apresentar no caixa quando chegar na loja.
  const pedido = searchParams.get("pedido");

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
