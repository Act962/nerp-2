"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Recarga de créditos.
 *
 * A tela só escolhe o **pacote**; preço e quantidade vêm do servidor. Deixar o
 * valor sair daqui seria deixar o navegador escolher quanto pagar.
 *
 * O crédito não entra ao voltar do pagamento: entra pelo webhook do Stripe.
 * Por isso a volta com `?recarga=ok` diz "em instantes" em vez de mostrar o
 * saldo novo — que pode levar alguns segundos e não depende desta aba estar
 * aberta.
 */
export function Recarregar() {
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  const { data, isPending } = useQuery(
    orpc.stars.packages.queryOptions({ input: {}, enabled: aberto }),
  );

  const iniciar = useMutation(
    orpc.stars.checkout.mutationOptions({
      onSuccess: (resultado) => {
        // Sai do nerp para o Stripe: `assign` e não `replace`, para o botão
        // "voltar" do navegador trazer o operador de volta ao lugar certo se
        // ele desistir.
        window.location.assign(resultado.url);
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const pacotes = data?.pacotes ?? [];

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button>
          <Star className="size-4" />
          Recarregar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recarregar créditos</DialogTitle>
          <DialogDescription>
            O pagamento é pelo Stripe. Os créditos entram assim que ele
            confirmar — normalmente em segundos.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Carregando pacotes…
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pacotes.map((pacote) => (
              <button
                key={pacote.id}
                type="button"
                onClick={() => setEscolhido(pacote.id)}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                  escolhido === pacote.id && "border-primary bg-accent",
                )}
              >
                <span>
                  <span className="block font-medium">{pacote.label}</span>
                  <span className="block text-muted-foreground text-xs">
                    {pacote.stars} créditos
                  </span>
                </span>
                <span className="font-semibold">
                  {dinheiro.format(pacote.precoCentavos / 100)}
                </span>
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={!escolhido || iniciar.isPending}
            onClick={() =>
              escolhido &&
              iniciar.mutate({
                packageId: escolhido,
                voltarPara: "/whatsapp/creditos",
              })
            }
          >
            {iniciar.isPending && <Loader2 className="size-4 animate-spin" />}
            Ir para o pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
