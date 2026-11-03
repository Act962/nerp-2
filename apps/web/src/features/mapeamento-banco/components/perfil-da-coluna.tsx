"use client";

import { FingerprintIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { TabelaRef } from "../domain/estrutura";
import { usePerfilDaColuna } from "../hooks/use-mapeamento-banco";
import { textoDaCelula } from "./formatar";

const inteiro = new Intl.NumberFormat("pt-BR");

/**
 * Nome da coluna clicável: abre o perfil (preenchimento, distintos, formatos,
 * valores comuns). Só lê o ERP quando abre — e uma vez por 10 minutos.
 */
export function PerfilDaColuna({
  tabela,
  coluna,
  children,
}: {
  tabela: TabelaRef;
  coluna: string;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const perfil = usePerfilDaColuna(aberto ? { tabela, coluna } : null);
  const dados = perfil.data;
  const maiorFormato = Math.max(
    1,
    ...(dados?.formatos.map((f) => f.quantidade) ?? []),
  );

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left underline-offset-2 hover:underline"
          title="Ver o perfil desta coluna"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 text-xs" align="start">
        <p className="mb-2 font-medium font-mono">{coluna}</p>
        {perfil.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-16" />
          </div>
        ) : perfil.error ? (
          <p className="text-destructive">{perfil.error.message}</p>
        ) : dados ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground">
              {dados.amostra.completa
                ? `${inteiro.format(dados.linhasAnalisadas)} linhas (tabela inteira)`
                : `Amostra de ${dados.amostra.percentualDeBlocos}% dos blocos: ${inteiro.format(dados.linhasAnalisadas)} linhas`}
              {` · ${dados.tempoMs} ms`}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-muted-foreground">Preenchido</dt>
              <dd>{dados.percentualPreenchido}%</dd>
              <dt className="text-muted-foreground">Distintos</dt>
              <dd className="flex items-center gap-1">
                {inteiro.format(dados.distintos)}
                {dados.pareceIdentificador && (
                  <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                    <FingerprintIcon className="size-3" /> identificador
                  </span>
                )}
              </dd>
              <dt className="text-muted-foreground">Mín. / máx.</dt>
              <dd className="truncate font-mono">
                {textoDaCelula(dados.minimo)} … {textoDaCelula(dados.maximo)}
              </dd>
              {dados.tamanho && (
                <>
                  <dt className="text-muted-foreground">Tamanho</dt>
                  <dd>
                    {dados.tamanho.minimo} a {dados.tamanho.maximo} caracteres
                  </dd>
                </>
              )}
            </dl>
            {dados.formatos.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Formatos</p>
                <ul className="flex flex-col gap-0.5">
                  {dados.formatos.slice(0, 5).map((formato) => (
                    <li
                      key={formato.formato}
                      className="flex items-center gap-2"
                    >
                      <span className="w-36 truncate font-mono">
                        {formato.formato || "(vazio)"}
                      </span>
                      <span className="h-1.5 flex-1 rounded bg-muted">
                        <span
                          className="block h-full rounded bg-primary/60"
                          style={{
                            width: `${(formato.quantidade / maiorFormato) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="w-12 text-right tabular-nums text-muted-foreground">
                        {inteiro.format(formato.quantidade)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dados.maisComuns && dados.maisComuns.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Mais comuns</p>
                <ul className="flex flex-col gap-0.5">
                  {dados.maisComuns.slice(0, 6).map((item) => (
                    <li
                      key={String(item.valor)}
                      className="flex justify-between gap-2"
                    >
                      <span className="truncate font-mono">
                        {textoDaCelula(item.valor)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {inteiro.format(item.quantidade)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
