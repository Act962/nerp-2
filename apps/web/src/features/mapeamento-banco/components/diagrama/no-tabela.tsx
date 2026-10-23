"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import {
  ExternalLinkIcon,
  FingerprintIcon,
  KeyRoundIcon,
  TableIcon,
  ZapIcon,
} from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type {
  ColunaDoDiagrama,
  TabelaDoDiagrama,
} from "../../application/diagrama";
import { linhasCompactas } from "../formatar";
import {
  ALTURA_DA_LINHA,
  ALTURA_DO_CABECALHO,
  ALTURA_DO_RODAPE,
  ALTURA_MAXIMA_DO_CORPO,
  LARGURA_DO_NO,
} from "./layout";

export interface DadosDoNo extends Record<string, unknown> {
  tabela: TabelaDoDiagrama;
  colunas: ColunaDoDiagrama[];
  ocultas: number;
  expandida: boolean;
  /** Colunas que têm traço chegando ou saindo — ganham ponto de conexão. */
  ligadas: string[];
  destaque: boolean;
  onAlternar: (id: string) => void;
  onAbrir: (id: string) => void;
}

export type NoDaTabela = Node<DadosDoNo, "tabela">;

// Ponto de conexão invisível: o traço precisa de âncora na linha da coluna,
// mas bolinha em toda linha poluiria o cartão.
const ESTILO_DA_ANCORA = {
  width: 6,
  height: 6,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  background: "transparent",
};

function LinhaDaColuna({
  coluna,
  ligada,
}: {
  coluna: ColunaDoDiagrama;
  ligada: boolean;
}) {
  return (
    <div
      className="relative flex items-center gap-1.5 border-b border-border/60 px-2.5 last:border-b-0"
      style={{ height: ALTURA_DA_LINHA }}
    >
      {ligada && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id={`${coluna.nome}-t`}
            style={ESTILO_DA_ANCORA}
          />
          <Handle
            type="source"
            position={Position.Right}
            id={`${coluna.nome}-s`}
            style={ESTILO_DA_ANCORA}
          />
        </>
      )}
      <span className="flex w-9 shrink-0 items-center gap-0.5 text-muted-foreground">
        {coluna.chavePrimaria ? (
          <KeyRoundIcon className="size-3 text-amber-500" />
        ) : coluna.unica ? (
          <FingerprintIcon className="size-3" />
        ) : null}
        {/* Losango cheio = obrigatória; vazado = aceita nulo (como no Supabase). */}
        <span
          className={cn(
            "inline-block size-2 rotate-45 border border-foreground/70",
            !coluna.aceitaNulo && "bg-foreground/70",
          )}
        />
        {coluna.indiceLider && <ZapIcon className="size-3 text-emerald-500" />}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-mono text-[11px]",
          ligada && "font-semibold",
        )}
        title={coluna.nome}
      >
        {coluna.nome}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {coluna.tipo}
      </span>
    </div>
  );
}

export const NoTabela = memo(function NoTabela({
  id,
  data,
  selected,
}: NodeProps<NoDaTabela>) {
  const ligadas = new Set(data.ligadas);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm transition-shadow",
        (selected || data.destaque) && "border-primary ring-2 ring-primary/30",
      )}
      style={{ width: LARGURA_DO_NO }}
    >
      <div
        className="flex items-center gap-2 border-b bg-muted/60 px-2.5"
        style={{ height: ALTURA_DO_CABECALHO }}
      >
        <TableIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-mono font-semibold text-xs">
            {data.tabela.nome}
          </p>
          {data.tabela.rotulo && (
            <p className="truncate text-[10px] text-muted-foreground">
              {data.tabela.rotulo}
            </p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {linhasCompactas(data.tabela.linhas)}
        </span>
        <button
          type="button"
          className="nodrag rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => data.onAbrir(id)}
          aria-label={`Abrir ${data.tabela.nome} no Explorar`}
        >
          <ExternalLinkIcon className="size-3.5" />
        </button>
      </div>
      <div
        // `nowheel`: rolar dentro do cartão expandido rola as colunas, não o zoom.
        className={cn(data.expandida && "nowheel overflow-y-auto")}
        style={{ maxHeight: ALTURA_MAXIMA_DO_CORPO }}
      >
        {data.colunas.map((coluna) => (
          <LinhaDaColuna
            key={coluna.nome}
            coluna={coluna}
            ligada={ligadas.has(coluna.nome)}
          />
        ))}
      </div>
      {(data.ocultas > 0 || data.expandida) && (
        <button
          type="button"
          className="nodrag flex w-full items-center justify-center border-t text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          style={{ height: ALTURA_DO_RODAPE }}
          onClick={() => data.onAlternar(id)}
        >
          {data.expandida
            ? "Mostrar só chaves e ligações"
            : `+ ${data.ocultas} colunas`}
        </button>
      )}
    </div>
  );
});
