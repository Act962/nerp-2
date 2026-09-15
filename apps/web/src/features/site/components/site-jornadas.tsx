"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSaveSiteJornada, useSiteJornadas } from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";

/**
 * Quanto cada jornada guiada paga, e como elas estão indo.
 *
 * Duas colunas fazem esta tela valer mais do que um formulário de preço:
 * "empresas recompensadas" diz se a jornada está sendo concluída, e
 * "apressos" diz se o texto dela está longo demais — é o número que aponta
 * qual explicação reescrever.
 */
export function SiteJornadas() {
  const { dados, isLoading } = useSiteJornadas();
  const salvar = useSaveSiteJornada();
  const [rascunho, setRascunho] = useState<
    Record<string, { stars: number; ativa: boolean }>
  >({});

  useEffect(() => {
    if (!dados) return;
    setRascunho(
      Object.fromEntries(
        dados.jornadas.map((j) => [j.id, { stars: j.stars, ativa: j.ativa }]),
      ),
    );
  }, [dados]);

  if (isLoading || !dados) {
    return (
      <>
        <SitePageHeader title="Jornadas do Astro" />
        <Skeleton className="h-72 w-full" />
      </>
    );
  }

  return (
    <>
      <SitePageHeader
        title="Jornadas do Astro"
        description="O Astro ensina cada tela passo a passo e a empresa ganha ★ ao concluir. Aqui você define quanto cada jornada vale e quais estão no ar."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Empresas de teste</CardTitle>
        </CardHeader>
        <CardContent className="flex items-start justify-between gap-4">
          <p className="max-w-prose text-muted-foreground text-sm">
            Quem está de teste é justamente quem precisa aprender, e as ★ de uma
            sandbox só se gastam dentro dela. Desligue se a entrada sem cadastro
            virar porta para ganhar saldo em série. Conta provisória (sem Google
            vinculado) nunca ganha ★, com isto ligado ou não.
          </p>
          <Switch
            checked={dados.recompensarSandbox}
            onCheckedChange={(v) => salvar.mutate({ recompensarSandbox: v })}
            aria-label="Recompensar empresas de teste"
          />
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jornada</TableHead>
              <TableHead className="text-right">Passos</TableHead>
              <TableHead className="text-right">Mín.</TableHead>
              <TableHead className="text-right">★</TableHead>
              <TableHead className="text-center">Ativa</TableHead>
              <TableHead className="text-right">Concluíram</TableHead>
              <TableHead className="text-right">Em curso</TableHead>
              <TableHead className="text-right">Empresas pagas</TableHead>
              <TableHead className="text-right">★ pagas</TableHead>
              <TableHead className="text-right">Apressos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.jornadas.map((jornada) => {
              const atual = rascunho[jornada.id] ?? {
                stars: jornada.stars,
                ativa: jornada.ativa,
              };
              const mudou =
                atual.stars !== jornada.stars || atual.ativa !== jornada.ativa;

              return (
                <TableRow key={jornada.id}>
                  <TableCell>
                    <div className="font-medium">{jornada.titulo}</div>
                    <div className="text-muted-foreground text-xs">
                      {jornada.rota} · {jornada.modulo}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {jornada.totalPassos}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {jornada.minutos} min
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      className="ml-auto h-8 w-20 text-right"
                      value={atual.stars}
                      aria-label={`★ de ${jornada.titulo}`}
                      onChange={(e) =>
                        setRascunho((r) => ({
                          ...r,
                          [jornada.id]: {
                            ...atual,
                            stars: Number(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={atual.ativa}
                      aria-label={`Ativar ${jornada.titulo}`}
                      onCheckedChange={(v) =>
                        setRascunho((r) => ({
                          ...r,
                          [jornada.id]: { ...atual, ativa: v },
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {jornada.concluintes}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {jornada.emAndamento}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {jornada.empresasRecompensadas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {jornada.starsPagas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {jornada.apressosMedio}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={mudou ? "default" : "outline"}
                      disabled={!mudou || salvar.isPending}
                      onClick={() =>
                        salvar.mutate({
                          jornadaId: jornada.id,
                          stars: atual.stars,
                          ativa: atual.ativa,
                        })
                      }
                    >
                      Salvar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
