"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, FileImage, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarEstrelas } from "@/features/stars/lib/decimal";
import { formatBRL } from "@/utils/currency-formatter";
import {
  usePlataformaEmpresas,
  usePlataformaResumo,
} from "../hooks/use-site-admin";
import {
  desde,
  PERIODO_PADRAO,
  rotuloDoPeriodo,
  SeletorDePeriodo,
} from "./periodo-do-painel";
import { SitePageHeader } from "./site-page-header";

/**
 * O quadro geral: quantas empresas existem, o que elas geraram e quem parou.
 *
 * A lista de "não estão gerenciando" é o motivo desta tela existir. Número
 * bonito de total não diz nada sozinho — o que muda uma ação é saber QUAL
 * empresa abriu a conta e não voltou.
 */

export function SiteEmpresas() {
  const [dias, setDias] = useState<number>(PERIODO_PADRAO);
  const { resumo, isLoading } = usePlataformaResumo(dias);
  const { empresas, isLoading: carregandoLista } = usePlataformaEmpresas(dias);

  const paradas = empresas.filter((e) => e.parada);

  return (
    <>
      <SitePageHeader
        title="Empresas"
        description={`Todas as contas do nerp e o que elas movimentaram nos ${rotuloDoPeriodo(dias)}.`}
        actions={
          <>
            <SeletorDePeriodo dias={dias} onChange={setDias} />
            <Button variant="outline" asChild>
              <Link href="/site/stars">Consumo de ★</Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          icone={Building2}
          rotulo="empresas ativas"
          valor={resumo ? String(resumo.empresas.ativas) : undefined}
          detalhe={
            resumo
              ? `${resumo.empresas.total} no total · ${resumo.empresas.deTeste} em teste`
              : undefined
          }
          carregando={isLoading}
        />
        <Indicador
          icone={TrendingUp}
          rotulo="valor gerado"
          valor={resumo ? formatBRL(resumo.vendas.valorTotal) : undefined}
          detalhe={resumo ? `${resumo.vendas.quantidade} vendas` : undefined}
          carregando={isLoading}
        />
        <Indicador
          icone={FileImage}
          rotulo="catálogos montados"
          valor={resumo ? String(resumo.catalogos.montados) : undefined}
          detalhe={
            resumo ? `${resumo.catalogos.ativos} mexidos há pouco` : undefined
          }
          carregando={isLoading}
        />
        <Indicador
          icone={AlertTriangle}
          rotulo="sem gerir a conta"
          valor={resumo ? String(resumo.empresas.paradas) : undefined}
          detalhe={
            resumo
              ? `sem acesso há ${resumo.criterios.diasSemGerir} dias`
              : undefined
          }
          carregando={isLoading}
          alerta={(resumo?.empresas.paradas ?? 0) > 0}
        />
      </div>

      {paradas.length > 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="text-base">
              Contas paradas ({paradas.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Empresas verificadas que ninguém acessa há mais de{" "}
              {resumo?.criterios.diasSemGerir ?? 14} dias. Contas de teste ficam
              de fora — elas expiram sozinhas.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {paradas.map((empresa) => (
              <Badge
                key={empresa.id}
                variant="outline"
                className="bg-background"
              >
                {empresa.nome}
                <span className="ml-1 text-muted-foreground">
                  · {desde(empresa.ultimoAcesso ?? empresa.criadaEm)}
                </span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por empresa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Vendas e ★ no período; catálogos e saldo são o número de hoje.
          </p>
        </CardHeader>
        <CardContent>
          {carregandoLista ? (
            <Skeleton className="h-40 w-full" />
          ) : empresas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma empresa cadastrada ainda.
            </p>
          ) : (
            <>
              {/*
                Seis colunas não cabem num telefone, e rolar de lado para ler
                uma linha é pior do que não ter tabela. Abaixo de `md` cada
                empresa vira um cartão; da largura de tablet em diante a tabela
                volta, que é onde ela compara bem.
              */}
              <div className="flex flex-col gap-3 md:hidden">
                {empresas.map((empresa) => (
                  <div
                    key={empresa.id}
                    className="flex flex-col gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{empresa.nome}</span>
                        {empresa.contaDeTeste && (
                          <Badge variant="secondary">teste</Badge>
                        )}
                        {empresa.parada && (
                          <Badge variant="outline" className="text-amber-700">
                            parada
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        /{empresa.slug}
                      </span>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <Dado rotulo="Vendas">{formatBRL(empresa.vendas)}</Dado>
                      <Dado rotulo="Catálogos">{empresa.catalogos}</Dado>
                      <Dado rotulo="★ no período">
                        {formatarEstrelas(empresa.consumoNoPeriodo)}
                      </Dado>
                      <Dado rotulo="Saldo ★">
                        {formatarEstrelas(empresa.saldo)}
                      </Dado>
                      <Dado rotulo="Último acesso">
                        {empresa.ultimoAcesso
                          ? desde(empresa.ultimoAcesso)
                          : "nunca"}
                      </Dado>
                    </dl>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Catálogos</TableHead>
                      <TableHead className="text-right">★ no período</TableHead>
                      <TableHead className="text-right">Saldo ★</TableHead>
                      <TableHead>Último acesso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresas.map((empresa) => (
                      <TableRow key={empresa.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{empresa.nome}</span>
                            {empresa.contaDeTeste && (
                              <Badge variant="secondary">teste</Badge>
                            )}
                            {empresa.parada && (
                              <Badge
                                variant="outline"
                                className="text-amber-700"
                              >
                                parada
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            /{empresa.slug}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(empresa.vendas)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {empresa.catalogos}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarEstrelas(empresa.consumoNoPeriodo)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarEstrelas(empresa.saldo)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {empresa.ultimoAcesso
                            ? desde(empresa.ultimoAcesso)
                            : "nunca"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Indicador({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  carregando,
  alerta,
}: {
  icone: typeof Building2;
  rotulo: string;
  valor?: string;
  detalhe?: string;
  carregando: boolean;
  alerta?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icone className={alerta ? "size-3.5 text-amber-600" : "size-3.5"} />
          {rotulo}
        </div>
        {carregando ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {valor ?? "—"}
          </p>
        )}
        {detalhe && !carregando && (
          <p className="text-xs text-muted-foreground">{detalhe}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Um par rótulo/valor do cartão de empresa no retrato. */
function Dado({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
