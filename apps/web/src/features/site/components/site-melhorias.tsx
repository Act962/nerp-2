"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SiteMelhoriaStatus } from "@/generated/prisma/enums";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import {
  useDeleteSiteMelhoria,
  useSiteMelhorias,
  useUpdateSiteMelhoria,
} from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";

/**
 * O que os clientes pedem de dentro do sistema.
 *
 * A rota e o print são o que fazem esta fila valer: o pedido chega com a tela
 * em que a pessoa estava, então ninguém precisa começar pelo "me manda um
 * print de onde foi".
 */

const STATUS: Array<{ id: SiteMelhoriaStatus; label: string }> = [
  { id: "NOVA", label: "Novas" },
  { id: "EM_ANALISE", label: "Em análise" },
  { id: "FEITA", label: "Feitas" },
  { id: "DESCARTADA", label: "Descartadas" },
];

const ROTULO: Record<SiteMelhoriaStatus, string> = {
  NOVA: "Nova",
  EM_ANALISE: "Em análise",
  FEITA: "Feita",
  DESCARTADA: "Descartada",
};

export function SiteMelhorias() {
  const [status, setStatus] = useState<SiteMelhoriaStatus | undefined>();
  const [aberta, setAberta] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const { cursor, pageIndex, hasPrevious, goNext, goPrevious, reset } =
    useCursorPagination();

  const { dados, isLoading } = useSiteMelhorias({ status, cursor });
  const atualizar = useUpdateSiteMelhoria();
  const excluir = useDeleteSiteMelhoria();

  const melhorias = dados?.melhorias ?? [];

  return (
    <>
      <SitePageHeader
        title="Melhorias"
        description="O que os clientes pedem pelo painel do Astro, com a tela em que estavam e os prints que anexaram."
        actions={
          dados && dados.novas > 0 ? (
            <Badge variant="secondary">{dados.novas} nova(s)</Badge>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={status === undefined ? "default" : "outline"}
          onClick={() => {
            setStatus(undefined);
            reset();
          }}
        >
          Todas
        </Button>
        {STATUS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={status === item.id ? "default" : "outline"}
            onClick={() => {
              setStatus(item.id);
              reset();
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 p-0 pb-2">
          {isLoading && <Skeleton className="mx-4 my-4 h-24" />}

          {!isLoading && melhorias.length === 0 && (
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">
              Nenhuma sugestão ainda. Elas chegam pelo botão "Melhorias" dentro
              do painel do Astro.
            </p>
          )}

          {melhorias.map((melhoria) => {
            const estaAberta = aberta === melhoria.id;
            return (
              <div key={melhoria.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() => {
                    const proxima = estaAberta ? null : melhoria.id;
                    setAberta(proxima);
                    setResposta(proxima ? (melhoria.resposta ?? "") : "");
                  }}
                >
                  <div className="min-w-48 flex-1">
                    <span className="block font-medium text-sm">
                      {melhoria.organizationName ?? "Empresa removida"}
                      {melhoria.userName ? ` · ${melhoria.userName}` : ""}
                    </span>
                    <span className="line-clamp-1 text-muted-foreground text-xs">
                      {melhoria.mensagem}
                    </span>
                  </div>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {melhoria.pathname}
                  </code>
                  {melhoria.imagens.length > 0 && (
                    <Badge variant="outline">
                      {melhoria.imagens.length} print(s)
                    </Badge>
                  )}
                  <Badge
                    variant={
                      melhoria.status === "NOVA" ? "default" : "secondary"
                    }
                  >
                    {ROTULO[melhoria.status]}
                  </Badge>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {new Date(melhoria.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </button>

                {estaAberta && (
                  <div className="space-y-4 bg-muted/30 px-4 py-4">
                    <p className="whitespace-pre-wrap text-sm">
                      {melhoria.mensagem}
                    </p>

                    {melhoria.imagens.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {melhoria.imagens.map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block size-24 overflow-hidden rounded-md border hover:ring-2 hover:ring-primary"
                          >
                            {/* biome-ignore lint/performance/noImgElement: print do cliente, direto do bucket */}
                            <img
                              src={url}
                              alt={`Print ${i + 1}`}
                              className="size-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    {melhoria.userEmail && (
                      <p className="text-muted-foreground text-xs">
                        Contato: {melhoria.userEmail}
                      </p>
                    )}

                    <Field>
                      <FieldLabel htmlFor={`resposta-${melhoria.id}`}>
                        Resposta do time
                      </FieldLabel>
                      <Textarea
                        id={`resposta-${melhoria.id}`}
                        value={resposta}
                        onChange={(e) => setResposta(e.target.value)}
                        placeholder="O que foi decidido, e por quê."
                        className="min-h-20 bg-background"
                      />
                    </Field>

                    <div className="flex flex-wrap items-center gap-2">
                      {STATUS.map((item) => (
                        <Button
                          key={item.id}
                          size="sm"
                          variant={
                            melhoria.status === item.id ? "default" : "outline"
                          }
                          disabled={atualizar.isPending}
                          onClick={() =>
                            atualizar.mutate({
                              id: melhoria.id,
                              status: item.id,
                              resposta: resposta.trim() || null,
                            })
                          }
                        >
                          {ROTULO[item.id]}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-destructive"
                        disabled={excluir.isPending}
                        onClick={() => excluir.mutate({ id: melhoria.id })}
                      >
                        <Trash2 className="size-4" /> Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {(hasPrevious || dados?.nextCursor) && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={goPrevious}
            disabled={!hasPrevious}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-sm">
            Página {pageIndex}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => goNext(dados?.nextCursor)}
            disabled={!dados?.nextCursor}
          >
            Próxima
          </Button>
        </div>
      )}
    </>
  );
}
