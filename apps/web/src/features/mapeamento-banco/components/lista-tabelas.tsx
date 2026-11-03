"use client";

import { ChevronRightIcon, EyeIcon, LinkIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TabelaDaLista } from "../application/explorar-banco";
import { ALVOS } from "../domain/alvos";
import { type TabelaRef, mesmaTabela } from "../domain/estrutura";
import { linhasCompactas } from "./formatar";

type Filtro = "todas" | "comDados" | "mapeadas";

const ROTULO_DO_FILTRO: Record<Filtro, string> = {
  todas: "Todas",
  comDados: "Com dados",
  mapeadas: "Mapeadas",
};

interface Props {
  tabelas: TabelaDaLista[];
  carregando: boolean;
  erro: string | null;
  selecionada: TabelaRef | null;
  onSelecionar: (tabela: TabelaRef) => void;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function ListaTabelas({
  tabelas,
  carregando,
  erro,
  selecionada,
  onSelecionar,
}: Props) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  const grupos = useMemo(() => {
    const termo = normalizar(busca.trim());
    const visiveis = tabelas.filter((tabela) => {
      if (filtro === "comDados" && !tabela.linhas) return false;
      if (filtro === "mapeadas" && tabela.mapeadaComo.length === 0) {
        return false;
      }
      if (!termo) return true;
      return normalizar(`${tabela.nome} ${tabela.rotulo ?? ""}`).includes(
        termo,
      );
    });
    const porSchema = new Map<string, TabelaDaLista[]>();
    for (const tabela of visiveis) {
      porSchema.set(tabela.schema, [
        ...(porSchema.get(tabela.schema) ?? []),
        tabela,
      ]);
    }
    return [...porSchema.entries()];
  }, [tabelas, busca, filtro]);

  const alternarGrupo = (schema: string) =>
    setFechados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(schema)) proximo.delete(schema);
      else proximo.add(schema);
      return proximo;
    });

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="flex flex-col gap-2 border-b p-2">
        <div className="relative">
          <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-2 size-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar tabela ou nome de negócio"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {(Object.keys(ROTULO_DO_FILTRO) as Filtro[]).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setFiltro(opcao)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent",
                filtro === opcao && "bg-accent font-medium text-foreground",
              )}
            >
              {ROTULO_DO_FILTRO[opcao]}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {carregando ? (
          <div className="flex flex-col gap-1.5 p-2">
            {Array.from({ length: 12 }).map((_, indice) => (
              <Skeleton key={indice} className="h-8" />
            ))}
          </div>
        ) : erro ? (
          <p className="p-3 text-destructive text-xs">{erro}</p>
        ) : grupos.length === 0 ? (
          <p className="p-3 text-muted-foreground text-xs">
            Nenhuma tabela encontrada.
          </p>
        ) : (
          <div className="flex flex-col py-1">
            {grupos.map(([schema, itens]) => {
              const fechado = fechados.has(schema);
              return (
                <div key={schema}>
                  <button
                    type="button"
                    onClick={() => alternarGrupo(schema)}
                    className="flex w-full items-center gap-1 px-2 py-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide hover:text-foreground"
                  >
                    <ChevronRightIcon
                      className={cn(
                        "size-3 transition-transform",
                        !fechado && "rotate-90",
                      )}
                    />
                    <span className="font-mono">{schema}</span>
                    <span className="ml-auto tabular-nums">{itens.length}</span>
                  </button>
                  {!fechado &&
                    itens.map((tabela) => (
                      <ItemDaTabela
                        key={`${tabela.schema}.${tabela.nome}`}
                        tabela={tabela}
                        ativa={
                          selecionada !== null &&
                          mesmaTabela(selecionada, tabela)
                        }
                        onSelecionar={onSelecionar}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ItemDaTabela({
  tabela,
  ativa,
  onSelecionar,
}: {
  tabela: TabelaDaLista;
  ativa: boolean;
  onSelecionar: (tabela: TabelaRef) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelecionar({ schema: tabela.schema, nome: tabela.nome })}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-accent/60",
        ativa && "bg-accent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-xs">{tabela.nome}</span>
          {tabela.tipo === "view" && (
            <EyeIcon className="size-3 shrink-0 text-muted-foreground" />
          )}
        </div>
        {tabela.rotulo && (
          <p className="truncate text-[11px] text-muted-foreground">
            {tabela.rotulo}
          </p>
        )}
      </div>
      {tabela.mapeadaComo.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <LinkIcon className="size-3 shrink-0 text-primary" />
          </TooltipTrigger>
          <TooltipContent>
            Usada em{" "}
            {tabela.mapeadaComo.map((tipo) => ALVOS[tipo].rotulo).join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
        {linhasCompactas(tabela.linhas)}
      </span>
    </button>
  );
}
