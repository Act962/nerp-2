"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Loader2, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { preco } from "./menu-view";
import { type CobrancaAberta, TelaDoPix } from "./tela-do-pix";
import { useMenuCheckout } from "./use-menu-checkout";

type Produto = {
  id: string;
  name: string;
  salePrice: number;
  promotionalPrice: number | null;
};

type Props = {
  aberta: boolean;
  aoFechar: () => void;
  subdomain: string;
  produtos: Produto[];
};

/**
 * A sacola e o pedido, na mesma folha.
 *
 * Sem login, sem endereço, sem forma de pagamento: nome e WhatsApp bastam para
 * a loja chamar o cliente. Cada campo a mais aqui é um cliente a menos — é o
 * motivo de este fluxo não passar pelo checkout do e-commerce.
 */
export function MenuCartSheet({
  aberta,
  aoFechar,
  subdomain,
  produtos,
}: Props) {
  const carrinho = useCart(subdomain);
  const checkout = useMenuCheckout();
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [cobranca, setCobranca] = useState<CobrancaAberta | null>(null);

  const itens = carrinho.products
    .map((item) => {
      const produto = produtos.find((p) => p.id === item.productId);
      if (!produto) return null;
      return { item, produto, quantidade: Number(item.quantity || 0) };
    })
    .filter((linha): linha is NonNullable<typeof linha> => linha !== null);

  const total = itens.reduce(
    (soma, linha) => soma + preco(linha.produto) * linha.quantidade,
    0,
  );

  const enviar = () => {
    if (!nome.trim()) {
      toast.error("Informe seu nome para a loja te chamar");
      return;
    }
    if (itens.length === 0) return;

    checkout.mutate(
      {
        domain: subdomain,
        products: itens.map((linha) => ({
          id: linha.produto.id,
          quantity: linha.quantidade,
          notes: linha.item.notes,
        })),
        customer: {
          name: nome.trim(),
          phone: telefone.trim() || undefined,
        },
        notes: observacoes.trim() || undefined,
      },
      {
        onSuccess: ({ ticketId, cobranca: aberta }) => {
          // Com cobrança, a sacola só é esvaziada quando o PIX confirma: se o
          // cliente desistir ou o pagamento falhar, ele volta para um carrinho
          // montado em vez de ter que escolher tudo de novo.
          if (aberta) {
            setCobranca(aberta);
            return;
          }

          carrinho.clearOrganizationCart();
          aoFechar();
          if (ticketId) {
            router.push(`/pedido-cliente/ticket/${ticketId}`);
          } else {
            toast.success("Pedido enviado! A loja vai confirmar em instantes.");
          }
        },
      },
    );
  };

  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-2xl">
            {cobranca ? "Pague para confirmar" : "Sua sacola"}
          </SheetTitle>
        </SheetHeader>

        {cobranca ? (
          <TelaDoPix cobranca={cobranca} aoDesistir={() => setCobranca(null)} />
        ) : (
          <div className="flex flex-col gap-5 p-4">
            <ul className="flex flex-col gap-3">
              {itens.map(({ item, produto, quantidade }) => (
                <li key={produto.id} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{produto.name}</p>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground">
                        » {item.notes}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      R$ {currencyFormatter(preco(produto) * quantidade).trim()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10 rounded-full"
                      aria-label={`Diminuir ${produto.name}`}
                      onClick={() => {
                        if (quantidade <= 1) {
                          carrinho.toggleProduct(produto.id, "0");
                          return;
                        }
                        carrinho.updateQuantity(
                          produto.id,
                          subdomain,
                          String(quantidade - 1),
                        );
                      }}
                    >
                      <Minus className="size-5" />
                    </Button>
                    <span className="w-6 text-center text-lg font-semibold">
                      {quantidade}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10 rounded-full"
                      aria-label={`Aumentar ${produto.name}`}
                      onClick={() =>
                        carrinho.updateQuantity(
                          produto.id,
                          subdomain,
                          String(quantidade + 1),
                        )
                      }
                    >
                      <Plus className="size-5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t pt-4 text-xl font-bold">
              <span>Total</span>
              <span>R$ {currencyFormatter(total).trim()}</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nome" className="text-base">
                  Seu nome
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como a gente te chama?"
                  className="h-12 text-base"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="telefone" className="text-base">
                  WhatsApp{" "}
                  <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="telefone"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 90000-0000"
                  className="h-12 text-base"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="obs-pedido" className="text-base">
                  Observação do pedido
                </Label>
                <Textarea
                  id="obs-pedido"
                  value={observacoes}
                  maxLength={500}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex.: vou buscar em 20 minutos"
                  className="text-base"
                />
              </div>
            </div>

            <Button
              size="lg"
              className="h-14 text-base"
              disabled={checkout.isPending || itens.length === 0}
              onClick={enviar}
            >
              {checkout.isPending ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Enviar pedido"
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
