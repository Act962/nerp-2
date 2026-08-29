"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Barcode,
  Boxes,
  DollarSign,
  ImageOff,
  Package,
  Tags,
  Hash,
} from "lucide-react";
import { useProductGaps } from "../hooks/use-product-gaps";
import { MISSING_LABEL, type MissingField } from "../lib/missing-filters";

const ICONES: Record<MissingField, typeof Package> = {
  category: Tags,
  stock: Boxes,
  price: DollarSign,
  sku: Hash,
  barcode: Barcode,
  image: ImageOff,
};

const ORDEM: MissingField[] = [
  "category",
  "stock",
  "price",
  "sku",
  "barcode",
  "image",
];

/**
 * Indicadores de qualidade do cadastro.
 *
 * Cada card é um FILTRO, não um enfeite: clicar reduz a lista abaixo àqueles
 * itens. Número que não leva a lugar nenhum vira decoração — quem vê "23 sem
 * código de barras" quer saber quais são para corrigir.
 */
export function ProductsDashboard({
  selecionado,
  onSelecionar,
}: {
  selecionado: MissingField | null;
  onSelecionar: (field: MissingField | null) => void;
}) {
  const { data, isPending } = useProductGaps();

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: esqueleto estático
          <Skeleton key={i} className="h-[74px] rounded-xl" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {/* Total: limpa o filtro em vez de aplicar um. */}
      <Indicador
        titulo="Cadastrados"
        valor={data.total}
        Icone={Package}
        ativo={selecionado === null}
        onClick={() => onSelecionar(null)}
      />
      {ORDEM.map((field) => (
        <Indicador
          key={field}
          titulo={MISSING_LABEL[field]}
          valor={data[field]}
          Icone={ICONES[field]}
          ativo={selecionado === field}
          // Clicar de novo no card ativo desfaz o filtro — sem isso o usuário
          // fica preso e tem que caçar como voltar.
          onClick={() => onSelecionar(selecionado === field ? null : field)}
          alerta={data[field] > 0}
        />
      ))}
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  Icone,
  ativo,
  alerta,
  onClick,
}: {
  titulo: string;
  valor: number;
  Icone: typeof Package;
  ativo: boolean;
  alerta?: boolean;
  onClick: () => void;
}) {
  return (
    // Botão de verdade, não Card com onClick: o card precisa ser alcançável por
    // teclado e anunciar seu estado, e `aria-pressed` faz o leitor de tela
    // dizer se o filtro está aplicado.
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border bg-card px-3 py-3 text-left",
        "transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        ativo && "border-primary bg-accent",
      )}
    >
      <span className="flex w-full items-center gap-1.5 text-xs text-muted-foreground">
        <Icone className="size-3.5 shrink-0" />
        <span className="truncate">{titulo}</span>
      </span>
      <span
        className={cn(
          "text-xl font-semibold tabular-nums",
          // Zero é o estado bom: não pinta de alerta o que está em dia.
          alerta && "text-amber-600 dark:text-amber-400",
        )}
      >
        {valor}
      </span>
    </button>
  );
}
