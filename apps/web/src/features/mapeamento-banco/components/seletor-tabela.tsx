"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TabelaDaLista } from "../application/explorar-banco";
import { type TabelaRef, mesmaTabela } from "../domain/estrutura";
import { linhasCompactas } from "./formatar";

interface Props {
  tabelas: TabelaDaLista[];
  valor: TabelaRef | null;
  onEscolher: (tabela: TabelaRef) => void;
  placeholder?: string;
}

/** Combobox de tabelas com busca por nome técnico ou nome de negócio. */
export function SeletorTabela({
  tabelas,
  valor,
  onEscolher,
  placeholder = "Escolha a tabela",
}: Props) {
  const [aberto, setAberto] = useState(false);
  const escolhida = valor
    ? tabelas.find((tabela) => mesmaTabela(tabela, valor))
    : undefined;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className="h-9 w-full justify-between font-normal"
        >
          {valor ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-xs">
                {valor.schema}.{valor.nome}
              </span>
              {escolhida?.rotulo && (
                <span className="truncate text-muted-foreground text-xs">
                  {escolhida.rotulo}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">{placeholder}</span>
          )}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-72 p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar tabela…" className="text-xs" />
          <CommandList>
            <CommandEmpty>Nenhuma tabela.</CommandEmpty>
            <CommandGroup>
              {tabelas.map((tabela) => {
                const chave = `${tabela.schema}.${tabela.nome}`;
                return (
                  <CommandItem
                    key={chave}
                    value={`${chave} ${tabela.rotulo ?? ""}`}
                    onSelect={() => {
                      onEscolher({ schema: tabela.schema, nome: tabela.nome });
                      setAberto(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "size-3.5",
                        valor && mesmaTabela(valor, tabela)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-mono text-xs">
                        {chave}
                      </span>
                      {tabela.rotulo && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {tabela.rotulo}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {linhasCompactas(tabela.linhas)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
