"use client";

import {
  BoxesIcon,
  FolderTreeIcon,
  PackageIcon,
  PercentIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ResumoDoTipo } from "../application/resolver-tipo";
import { ALVOS, TIPOS_DO_NERP, type TipoDoNerp } from "../domain/alvos";
import { COR_DO_STATUS, ROTULO_DO_STATUS } from "./formatar";

export const ICONE_DO_TIPO: Record<
  TipoDoNerp,
  ComponentType<{ className?: string }>
> = {
  produto: PackageIcon,
  estoque: BoxesIcon,
  categoria: FolderTreeIcon,
  cliente: UsersIcon,
  preco: TagIcon,
  promocao: PercentIcon,
};

function origemResumida(resumo: ResumoDoTipo | undefined): string {
  if (!resumo) return "";
  if (resumo.status === "desligado") return "Não sincroniza";
  if (resumo.modo === "auto") {
    return resumo.perfil
      ? `Automático · ${resumo.perfil.rotulo}`
      : "Automático · sem perfil que funcione aqui";
  }
  if (!resumo.origem) return "Manual";
  const { tabela, juncao } = resumo.origem;
  return `Manual · ${tabela.nome}${juncao ? ` + ${juncao.tabela.nome}` : ""}`;
}

interface Props {
  tipos: ResumoDoTipo[] | undefined;
  carregando: boolean;
  erro: string | null;
  selecionado: TipoDoNerp;
  onSelecionar: (tipo: TipoDoNerp) => void;
}

export function ListaTipos({
  tipos,
  carregando,
  erro,
  selecionado,
  onSelecionar,
}: Props) {
  const porTipo = new Map(tipos?.map((resumo) => [resumo.tipo, resumo]));

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="border-b p-3">
        <p className="font-medium text-xs">Tipos do NERP</p>
        <p className="text-[11px] text-muted-foreground">
          De onde cada dado vem no banco deste cliente.
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {erro ? (
          <p className="p-3 text-destructive text-xs">{erro}</p>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {TIPOS_DO_NERP.map((tipo) => {
              const Icone = ICONE_DO_TIPO[tipo];
              const resumo = porTipo.get(tipo);
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => onSelecionar(tipo)}
                  className={cn(
                    "flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                    selecionado === tipo && "bg-accent",
                  )}
                >
                  <Icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {ALVOS[tipo].rotulo}
                      </span>
                      {resumo && (
                        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              COR_DO_STATUS[resumo.status],
                            )}
                          />
                          {ROTULO_DO_STATUS[resumo.status]}
                        </span>
                      )}
                    </div>
                    {carregando && !resumo ? (
                      <Skeleton className="mt-1 h-3 w-32" />
                    ) : (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {origemResumida(resumo)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
