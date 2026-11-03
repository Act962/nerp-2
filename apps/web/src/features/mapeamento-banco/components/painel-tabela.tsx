"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TabelaRef } from "../domain/estrutura";
import { useDescricaoDaTabela } from "../hooks/use-mapeamento-banco";
import { AbaDados } from "./aba-dados";
import { AbaEstrutura } from "./aba-estrutura";
import { AbaRelacoes } from "./aba-relacoes";
import { linhasPorExtenso, tabelaGrande } from "./formatar";

interface Props {
  tabela: TabelaRef;
  onAbrirTabela: (tabela: TabelaRef) => void;
}

export function PainelTabela({ tabela, onAbrirTabela }: Props) {
  const descricao = useDescricaoDaTabela(tabela);
  const dados = descricao.data;

  if (descricao.isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (descricao.error || !dados) {
    return (
      <p className="p-4 text-destructive text-sm">
        {descricao.error?.message ?? "Tabela não encontrada."}
      </p>
    );
  }

  const relacoes =
    dados.relacoes.length + dados.referenciadaPor.length + dados.indices.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-1 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono font-semibold text-base">
            <span className="text-muted-foreground">{dados.schema}.</span>
            {dados.nome}
          </h2>
          <Badge variant="outline">
            {dados.tipo === "view" ? "View" : "Tabela"}
          </Badge>
          <Badge variant="secondary" className="tabular-nums">
            {linhasPorExtenso(dados.linhas)}
          </Badge>
          {tabelaGrande(dados.linhas) && (
            <Badge
              variant="outline"
              className="border-amber-500/50 text-amber-600 dark:text-amber-400"
            >
              <AlertTriangleIcon />
              Grande: filtro só por índice
            </Badge>
          )}
        </div>
        {(dados.rotulo || dados.descricao) && (
          <p className="text-muted-foreground text-xs">
            {dados.rotulo && (
              <span className="font-medium text-foreground">
                {dados.rotulo}
              </span>
            )}
            {dados.rotulo && dados.descricao && " — "}
            {dados.descricao}
          </p>
        )}
      </div>

      <Tabs
        defaultValue="estrutura"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="overflow-x-auto border-b px-4">
          <TabsList className="h-9 bg-transparent p-0">
            <TabsTrigger value="estrutura" className="text-xs">
              Estrutura · {dados.colunas.length}
            </TabsTrigger>
            <TabsTrigger value="dados" className="text-xs">
              Dados
            </TabsTrigger>
            <TabsTrigger value="relacoes" className="text-xs">
              Relações e índices · {relacoes}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="estrutura" className="min-h-0 flex-1 overflow-auto">
          <AbaEstrutura tabela={dados} />
        </TabsContent>
        <TabsContent value="dados" className="min-h-0 flex-1">
          <AbaDados tabela={dados} />
        </TabsContent>
        <TabsContent value="relacoes" className="min-h-0 flex-1 overflow-auto">
          <AbaRelacoes tabela={dados} onAbrirTabela={onAbrirTabela} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
