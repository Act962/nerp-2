"use client";

import { KeyRoundIcon, LinkIcon, ZapIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TabelaDescrita } from "../application/descrever-tabela";
import type { Coluna } from "../domain/estrutura";
import { PerfilDaColuna } from "./perfil-da-coluna";

function tipoPorExtenso(coluna: Coluna): string {
  if (coluna.tipo === "numero" && coluna.precisao !== null) {
    return coluna.escala
      ? `${coluna.tipoNativo}(${coluna.precisao},${coluna.escala})`
      : `${coluna.tipoNativo}(${coluna.precisao})`;
  }
  if (coluna.tipo === "texto" && coluna.tamanho !== null) {
    return `${coluna.tipoNativo}(${coluna.tamanho})`;
  }
  return coluna.tipoNativo;
}

export function AbaEstrutura({ tabela }: { tabela: TabelaDescrita }) {
  const colunasDeFk = new Set(
    tabela.relacoes.flatMap((relacao) => relacao.colunas),
  );

  return (
    <div className="p-2 md:p-4">
      <Table stacked className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Coluna</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="w-16">Nulo</TableHead>
            <TableHead className="w-20">Chave</TableHead>
            <TableHead className="w-20">Índice</TableHead>
            <TableHead>Descrição</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tabela.colunas.map((coluna) => (
            <TableRow key={coluna.nome}>
              <TableCell data-label="Coluna">
                <div className="flex flex-col">
                  {coluna.tipo === "outro" || tabela.tipo === "view" ? (
                    <span className="font-medium font-mono">{coluna.nome}</span>
                  ) : (
                    <PerfilDaColuna
                      tabela={{ schema: tabela.schema, nome: tabela.nome }}
                      coluna={coluna.nome}
                    >
                      <span className="font-medium font-mono">
                        {coluna.nome}
                      </span>
                    </PerfilDaColuna>
                  )}
                  {coluna.rotulo && (
                    <span className="text-[11px] text-muted-foreground">
                      {coluna.rotulo}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell data-label="Tipo" className="font-mono">
                {tipoPorExtenso(coluna)}
              </TableCell>
              <TableCell data-label="Nulo" className="text-muted-foreground">
                {coluna.aceitaNulo ? "sim" : "não"}
              </TableCell>
              <TableCell data-label="Chave">
                <div className="flex items-center gap-1">
                  {coluna.chavePrimaria && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <KeyRoundIcon className="size-3" /> PK
                    </span>
                  )}
                  {colunasDeFk.has(coluna.nome) && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <LinkIcon className="size-3" /> FK
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell data-label="Índice">
                {coluna.indiceLider ? (
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ZapIcon className="size-3" /> líder
                    </TooltipTrigger>
                    <TooltipContent>
                      Primeira coluna de um índice: filtro e ordem são rápidos.
                    </TooltipContent>
                  </Tooltip>
                ) : coluna.indexada ? (
                  <span className="text-muted-foreground">em índice</span>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </TableCell>
              <TableCell
                data-label="Descrição"
                className="max-w-80 whitespace-normal text-muted-foreground"
              >
                {coluna.descricao ?? ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
