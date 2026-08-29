"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Empilhamento no celular: abaixo de `sm` a tabela deixa de ser tabela e cada
 * linha vira um cartão, com o nome da coluna à esquerda do valor.
 *
 * Rolar na horizontal funciona (o container já faz isso), mas ler uma linha de
 * oito colunas empurrando o dedo é péssimo — some o cabeçalho e o valor perde
 * o significado. Aqui o rótulo viaja junto com o dado.
 *
 * O rótulo vem do `data-label` de cada `TableCell`. Célula sem `data-label`
 * aparece sem rótulo, o que é o certo para colunas de ação.
 */
const STACKED_ON_MOBILE = [
  "max-sm:block",
  "[&_thead]:max-sm:hidden",
  "[&_tbody]:max-sm:block",
  "[&_tr]:max-sm:mb-2 [&_tr]:max-sm:block [&_tr]:max-sm:rounded-lg",
  "[&_tr]:max-sm:border [&_tr]:max-sm:px-3 [&_tr]:max-sm:py-1",
  "[&_td]:max-sm:flex [&_td]:max-sm:items-center [&_td]:max-sm:justify-between",
  "[&_td]:max-sm:gap-4 [&_td]:max-sm:px-0 [&_td]:max-sm:py-2",
  "[&_td]:max-sm:border-b [&_td:last-child]:max-sm:border-0",
  "[&_td[data-label]]:max-sm:before:content-[attr(data-label)]",
  "[&_td[data-label]]:max-sm:before:shrink-0",
  "[&_td[data-label]]:max-sm:before:text-xs",
  "[&_td[data-label]]:max-sm:before:font-medium",
  "[&_td[data-label]]:max-sm:before:text-muted-foreground",
  // Sem isto, valor longo (descrição de lançamento, nome de produto) estoura a
  // largura do cartão em vez de quebrar. O rótulo não encolhe; o valor sim.
  "[&_td]:max-sm:min-w-0 [&_td]:max-sm:text-right",
  "[&_td]:max-sm:break-words [&_td]:max-sm:whitespace-normal",
  // Cartão colado na borda: com o recheio do cartão, mais o do Card em volta,
  // sobrava pouco para o dado. A linha já tem sua própria moldura.
  "[&_tr]:max-sm:-mx-1",
].join(" ");

function Table({
  className,
  stacked = false,
  ...props
}: React.ComponentProps<"table"> & {
  /** Vira cartões abaixo de `sm`. Use em tabelas com muitas colunas. */
  stacked?: boolean;
}) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          stacked && STACKED_ON_MOBILE,
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
