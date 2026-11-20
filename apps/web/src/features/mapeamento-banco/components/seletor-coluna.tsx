"use client";

import { ZapIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TabelaDescrita } from "../application/descrever-tabela";
import type { TipoDeDado } from "../domain/estrutura";
import type { ColunaRef } from "../domain/mapeamento";

const NENHUMA = "__nenhuma__";

const SIGLA_DO_TIPO: Record<TipoDeDado, string> = {
  texto: "abc",
  numero: "123",
  data: "data",
  outro: "bin",
};

function codificar(ref: ColunaRef): string {
  return `${ref.de}:${ref.nome}`;
}

function decodificar(valor: string): ColunaRef | null {
  if (valor === NENHUMA) return null;
  const [de, ...resto] = valor.split(":");
  if (de !== "base" && de !== "juncao") return null;
  return { de, nome: resto.join(":") };
}

interface Props {
  base: TabelaDescrita | undefined;
  juncao: TabelaDescrita | undefined;
  valor: ColunaRef | null;
  onEscolher: (ref: ColunaRef | null) => void;
  /** Só colunas destes tipos (ex.: janela aceita só data). */
  tipos?: TipoDeDado[];
  permitirNenhuma?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Coluna da tabela principal ou da junção, com o tipo e o índice à vista — é o
 * que decide se o mapeamento funciona e se a leitura vai ser rápida.
 */
export function SeletorColuna({
  base,
  juncao,
  valor,
  onEscolher,
  tipos,
  permitirNenhuma = true,
  placeholder = "Escolha a coluna",
  className,
}: Props) {
  const grupos = [
    { de: "base" as const, tabela: base },
    { de: "juncao" as const, tabela: juncao },
  ].filter((grupo) => grupo.tabela);

  return (
    <Select
      value={valor ? codificar(valor) : NENHUMA}
      onValueChange={(escolhido) => onEscolher(decodificar(escolhido))}
    >
      <SelectTrigger
        size="sm"
        className={cn("w-full font-mono text-xs", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {permitirNenhuma && (
          <SelectItem value={NENHUMA} className="text-muted-foreground text-xs">
            Não mapear
          </SelectItem>
        )}
        {grupos.map(({ de, tabela }) => (
          <SelectGroup key={de}>
            <SelectLabel className="font-mono text-[11px]">
              {de === "juncao" ? "junção · " : ""}
              {tabela?.nome}
            </SelectLabel>
            {tabela?.colunas
              .filter((coluna) => !tipos || tipos.includes(coluna.tipo))
              .map((coluna) => (
                <SelectItem
                  key={`${de}:${coluna.nome}`}
                  value={codificar({ de, nome: coluna.nome })}
                  className="font-mono text-xs"
                >
                  <span>
                    {grupos.length > 1 && de === "juncao" ? "j." : ""}
                    {coluna.nome}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {SIGLA_DO_TIPO[coluna.tipo]}
                  </span>
                  {coluna.indiceLider && (
                    <ZapIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {coluna.rotulo && (
                    <span className="truncate font-sans text-[11px] text-muted-foreground">
                      {coluna.rotulo}
                    </span>
                  )}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
