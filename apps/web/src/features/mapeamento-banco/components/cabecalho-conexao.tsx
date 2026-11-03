"use client";

import {
  DatabaseIcon,
  NetworkIcon,
  PanelLeftIcon,
  RefreshCwIcon,
  WorkflowIcon,
  TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConectarAgente } from "@/features/mcp/components/conectar-agente";
import { cn } from "@/lib/utils";
import {
  useAtualizarEstrutura,
  useConexaoDoBanco,
} from "../hooks/use-mapeamento-banco";

export type ModoDaPagina = "explorar" | "diagrama" | "mapear";

interface Props {
  modo: ModoDaPagina;
  onModo: (modo: ModoDaPagina) => void;
  onAbrirLista: () => void;
}

export function CabecalhoConexao({ modo, onModo, onAbrirLista }: Props) {
  const conexao = useConexaoDoBanco();
  const atualizar = useAtualizarEstrutura();
  const dados = conexao.data;

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2 md:px-4">
      <Button
        variant="ghost"
        size="icon"
        className={cn("md:hidden", modo === "diagrama" && "hidden")}
        onClick={onAbrirLista}
        aria-label={modo === "explorar" ? "Abrir tabelas" : "Abrir tipos"}
      >
        <PanelLeftIcon />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <DatabaseIcon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-semibold text-sm">Banco de dados</h1>
            <span className="rounded border px-1.5 py-px text-[10px] text-muted-foreground uppercase tracking-wide">
              Interno
            </span>
          </div>
          {conexao.isLoading ? (
            <p className="text-muted-foreground text-xs">Conectando…</p>
          ) : conexao.error ? (
            <p className="truncate text-destructive text-xs">
              {conexao.error.message}
            </p>
          ) : dados ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground text-xs">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      dados.conectado ? "bg-emerald-500" : "bg-destructive",
                    )}
                  />
                  <span className="truncate">
                    {dados.rotuloDoMotor} · {dados.erp} ·{" "}
                    <span className="font-mono">{dados.schemaPrincipal}</span>
                    <span className="max-sm:hidden">
                      {" "}
                      · <span className="font-mono">{dados.servidor}</span>
                    </span>
                  </span>
                </p>
              </TooltipTrigger>
              <TooltipContent>
                {dados.conectado
                  ? "Conectado, somente leitura"
                  : (dados.mensagem ?? "Sem conexão")}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          <Button
            size="sm"
            variant={modo === "explorar" ? "secondary" : "ghost"}
            className="h-7"
            onClick={() => onModo("explorar")}
          >
            <TableIcon />
            Explorar
          </Button>
          <Button
            size="sm"
            variant={modo === "diagrama" ? "secondary" : "ghost"}
            className="h-7"
            onClick={() => onModo("diagrama")}
          >
            <NetworkIcon />
            Diagrama
          </Button>
          <Button
            size="sm"
            variant={modo === "mapear" ? "secondary" : "ghost"}
            className="h-7"
            onClick={() => onModo("mapear")}
          >
            <WorkflowIcon />
            Mapear
          </Button>
        </div>
        <ConectarAgente />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              onClick={() => atualizar.mutate({})}
              disabled={atualizar.isPending}
              aria-label="Atualizar estrutura"
            >
              <RefreshCwIcon
                className={cn(atualizar.isPending && "animate-spin")}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Recarregar tabelas e colunas do banco (o NERP guarda por 1h)
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
