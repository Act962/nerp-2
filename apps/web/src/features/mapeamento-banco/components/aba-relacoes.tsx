"use client";

import { ArrowLeftIcon, ArrowRightIcon, ZapIcon } from "lucide-react";
import type { TabelaDescrita } from "../application/descrever-tabela";
import type { Relacao, TabelaRef } from "../domain/estrutura";

interface Props {
  tabela: TabelaDescrita;
  onAbrirTabela: (tabela: TabelaRef) => void;
}

function ListaDeRelacoes({
  titulo,
  vazio,
  relacoes,
  sentido,
  onAbrirTabela,
}: {
  titulo: string;
  vazio: string;
  relacoes: Relacao[];
  sentido: "sai" | "entra";
  onAbrirTabela: (tabela: TabelaRef) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium text-xs">{titulo}</h3>
      {relacoes.length === 0 ? (
        <p className="text-muted-foreground text-xs">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {relacoes.map((relacao) => (
            <li key={`${relacao.referencia.schema}.${relacao.nome}`}>
              <button
                type="button"
                onClick={() => onAbrirTabela(relacao.referencia)}
                className="flex w-full flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-left font-mono text-xs transition-colors hover:bg-accent"
              >
                <span>{relacao.colunas.join(", ")}</span>
                {sentido === "sai" ? (
                  <ArrowRightIcon className="size-3 text-muted-foreground" />
                ) : (
                  <ArrowLeftIcon className="size-3 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {relacao.referencia.schema}.{relacao.referencia.nome}
                </span>
                <span className="text-muted-foreground">
                  ({relacao.colunasReferenciadas.join(", ")})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AbaRelacoes({ tabela, onAbrirTabela }: Props) {
  return (
    <div className="flex flex-col gap-6 p-4">
      <ListaDeRelacoes
        titulo="Esta tabela aponta para"
        vazio="Nenhuma chave estrangeira declarada. No Winthor é comum: a ligação existe pelo código, sem restrição no banco."
        relacoes={tabela.relacoes}
        sentido="sai"
        onAbrirTabela={onAbrirTabela}
      />
      <ListaDeRelacoes
        titulo="Apontam para esta tabela"
        vazio="Nenhuma tabela declara chave para esta."
        relacoes={tabela.referenciadaPor}
        sentido="entra"
        onAbrirTabela={onAbrirTabela}
      />
      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-xs">Índices</h3>
        {tabela.indices.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Sem índice: qualquer filtro lê a tabela inteira.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tabela.indices.map((indice) => (
              <li
                key={indice.nome}
                className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs"
              >
                <ZapIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">{indice.colunas[0]}</span>
                {indice.colunas.length > 1 && (
                  <span className="text-muted-foreground">
                    + {indice.colunas.slice(1).join(", ")}
                  </span>
                )}
                <span className="ml-auto text-muted-foreground">
                  {indice.unico ? "único · " : ""}
                  {indice.nome}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
