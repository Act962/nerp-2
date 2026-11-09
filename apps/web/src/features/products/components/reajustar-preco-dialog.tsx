"use client";

import { Percent } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBulkAdjustProductPrice } from "@/features/products/hooks/use-products";

type Selecao =
  | { productIds: string[] }
  | { all: true; filter: { categorySlugs?: string[]; search?: string } };

const formatarReais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Reajusta o preço de venda dos produtos selecionados: percentual sobre a
 * venda atual (reajuste de tabela) ou margem sobre o custo.
 */
export function ReajustarPrecoDialog({
  selecao,
  quantidade,
  onAplicado,
}: {
  selecao: () => Selecao;
  quantidade: number;
  onAplicado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [base, setBase] = useState<"venda" | "custo">("custo");
  const [percentualTexto, setPercentualTexto] = useState("30");
  const reajustar = useBulkAdjustProductPrice();

  const percentual = Number(percentualTexto.replace(",", "."));
  const percentualValido =
    Number.isFinite(percentual) &&
    percentual !== 0 &&
    percentual >= -90 &&
    percentual <= 1000;
  const exemplo = 100 * (1 + (percentualValido ? percentual : 0) / 100);

  const aplicar = () => {
    if (!percentualValido) return;
    reajustar.mutate(
      { ...selecao(), base, percentual },
      {
        onSuccess: ({ updated, semCusto }) => {
          toast.success(
            `${updated} ${updated === 1 ? "preço reajustado" : "preços reajustados"}` +
              (semCusto > 0 ? ` · ${semCusto} sem custo ficaram de fora` : ""),
          );
          setAberto(false);
          onAplicado();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Percent className="mr-2 h-4 w-4" />
          Reajustar preço
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reajustar preço de venda</DialogTitle>
          <DialogDescription>
            Vale para {quantidade} {quantidade === 1 ? "produto" : "produtos"}.
            O preço promocional não muda.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={base}
          onValueChange={(valor) => setBase(valor as "venda" | "custo")}
          className="gap-3"
        >
          <Label className="flex items-start gap-3 font-normal">
            <RadioGroupItem value="custo" className="mt-0.5" />
            <span>
              <span className="font-medium">Margem sobre o custo</span>
              <span className="block text-xs text-muted-foreground">
                Venda = custo + percentual. Produto sem custo fica de fora.
              </span>
            </span>
          </Label>
          <Label className="flex items-start gap-3 font-normal">
            <RadioGroupItem value="venda" className="mt-0.5" />
            <span>
              <span className="font-medium">Sobre o preço de venda atual</span>
              <span className="block text-xs text-muted-foreground">
                Aumenta ou reduz a venda atual (use negativo para reduzir).
              </span>
            </span>
          </Label>
        </RadioGroup>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reajuste-percentual">Percentual (%)</Label>
          <Input
            id="reajuste-percentual"
            inputMode="decimal"
            value={percentualTexto}
            onChange={(evento) => setPercentualTexto(evento.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Exemplo: {base === "custo" ? "custo" : "venda"} de{" "}
            {formatarReais(100)} → venda de {formatarReais(exemplo)}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={aplicar}
            disabled={!percentualValido || reajustar.isPending}
          >
            {reajustar.isPending ? "Aplicando..." : "Aplicar reajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
