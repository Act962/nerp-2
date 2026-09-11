"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Plus, RotateCcw, Search, Tag } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { ConversorDeTokens } from "./conversor-de-tokens";
import { CreditarStarsDialog } from "./creditar-stars-dialog";
import { PrecosDaEmpresaDialog } from "./precos-da-empresa-dialog";
import { ReiniciarAstroDialog } from "./reiniciar-astro-dialog";
import {
  PERIODO_PADRAO,
  rotuloDoPeriodo,
  SeletorDePeriodo,
} from "./periodo-do-painel";
import { SitePageHeader } from "./site-page-header";

/**
 * Quanto a IA custou e quanto ela cobrou.
 *
 * As duas colunas que importam são "★ consumidas" e "custo do Gemini": a
 * primeira é o que entrou, a segunda é o que saiu. Enquanto a de cima for
 * maior, a margem de 50% está de pé — e quando não for, a empresa que puxou
 * a conta está nomeada na tabela.
 */

/** A linha da tabela, tipada pelo que a procedure devolve. */
type Empresa = ReturnType<typeof usePlataformaEmpresas>["empresas"][number];

export function SiteStars() {
  const [dias, setDias] = useState<number>(PERIODO_PADRAO);
  const [busca, setBusca] = useState("");
  const [creditando, setCreditando] = useState<Empresa | null>(null);
  const [reiniciando, setReiniciando] = useState<Empresa | null>(null);
  const [precificando, setPrecificando] = useState<Empresa | null>(null);
  const { resumo, isLoading } = usePlataformaResumo(dias);
  const { empresas, isLoading: carregandoLista } = usePlataformaEmpresas(dias);

  const termo = normalizar(busca);

  /**
   * Sem busca, a tabela mostra só quem usou a IA — é a leitura de consumo.
   * Com busca, mostra QUALQUER empresa que case, inclusive a que nunca abriu o
   * Astro: quem procura uma empresa pelo nome está indo creditar ★ nela, e
   * escondê-la por não ter consumo quebraria exatamente esse caminho.
   */
  const listadas = termo
    ? empresas.filter(
        (empresa) =>
          normalizar(empresa.nome).includes(termo) ||
          normalizar(empresa.slug).includes(termo),
      )
    : empresas.filter(
        (empresa) => empresa.consumoNoPeriodo > 0 || empresa.tokens > 0,
      );

  const consumidoras = [...listadas].sort(
    (a, b) => b.consumoNoPeriodo - a.consumoNoPeriodo,
  );

  const orcamento = resumo?.orcamento ?? null;

  return (
    <>
      <SitePageHeader
        title="Stars"
        description={`O que cada empresa consumiu nos ${rotuloDoPeriodo(dias)} e o que isso custou no provedor.`}
        actions={
          <>
            <SeletorDePeriodo dias={dias} onChange={setDias} />
            <Button variant="outline" asChild>
              <Link href="/site/precos">Configurar cobrança</Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          rotulo="★ consumidas"
          valor={
            resumo
              ? formatarEstrelas(resumo.stars.consumidasNoPeriodo)
              : undefined
          }
          detalhe="no período"
          carregando={isLoading}
        />
        <Numero
          rotulo="★ em circulação"
          valor={
            resumo
              ? formatarEstrelas(resumo.stars.saldoEmCirculacao)
              : undefined
          }
          detalhe="saldo somado das empresas"
          carregando={isLoading}
        />
        <Numero
          rotulo="custo do Gemini"
          valor={resumo ? formatBRL(resumo.gemini.custoReal) : undefined}
          detalhe={
            resumo
              ? `US$ ${resumo.gemini.custoDolar.toFixed(4)} · dólar a ${formatBRL(resumo.dolar)}`
              : undefined
          }
          carregando={isLoading}
        />
        <Numero
          rotulo="tokens"
          valor={
            resumo
              ? (
                  resumo.gemini.tokensIn + resumo.gemini.tokensOut
                ).toLocaleString("pt-BR")
              : undefined
          }
          detalhe={
            resumo ? `${resumo.gemini.sessoes} conversas no app` : undefined
          }
          carregando={isLoading}
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Gasto do mês no provedor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Site e app somados — a fatura do Google é uma só.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isLoading || !resumo ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">
                  {formatBRL(resumo.mes.gasto.custoReal)}
                </span>
                {orcamento && (
                  <span className="text-sm text-muted-foreground">
                    de {formatBRL(orcamento.totalReais)} · restam{" "}
                    {formatBRL(orcamento.restante)}
                  </span>
                )}
              </div>
              {orcamento ? (
                <Progress value={orcamento.percentual} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem orçamento declarado. Informe um valor mensal em{" "}
                  <Link
                    href="/site/precos"
                    className="underline underline-offset-2"
                  >
                    Faixas do Astro
                  </Link>{" "}
                  para acompanhar quanto do mês já foi.
                </p>
              )}
              {resumo.mes.gasto.semModelo > 0 && (
                <p className="text-xs text-muted-foreground">
                  {resumo.mes.gasto.semModelo} conversas sem modelo registrado
                  entraram nos tokens e ficaram fora do custo.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Alert className="mb-4">
        <Info className="size-4" />
        <AlertDescription>
          <p>
            <span className="font-semibold">
              Não existe saldo do Gemini para ler.
            </span>{" "}
            A API de IA do Google não expõe saldo nem fatura — isso é do Cloud
            Billing, com outra credencial. O número acima é somado do nosso
            próprio registro: os tokens e o modelo de cada conversa, pela mesma
            tabela de preço que cobra o cliente.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumo por empresa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ordenado pelo que mais gastou. Sem busca, empresas sem uso da IA no
            período ficam fora — procure pelo nome para achar qualquer conta e
            creditar ★ nela.
          </p>
          <div className="relative mt-3 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar empresa por nome ou slug"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {carregandoLista ? (
            <Skeleton className="h-40 w-full" />
          ) : consumidoras.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {termo
                ? `Nenhuma empresa encontrada para "${busca}".`
                : `Nenhuma empresa usou o Astro nos ${rotuloDoPeriodo(dias)}.`}
            </p>
          ) : (
            <>
              {/*
                No retrato a tabela media 861 px dentro de 372 — cinco colunas
                de número mais três botões não cabem num telefone, e rolar de
                lado para ler uma linha é pior do que não ter tabela. Abaixo de
                `md` cada empresa vira um cartão; da largura de tablet em diante
                a tabela volta, que é onde ela compara bem.
              */}
              <div className="flex flex-col gap-3 md:hidden">
                {consumidoras.map((empresa) => (
                  <div
                    key={empresa.id}
                    className="flex flex-col gap-3 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{empresa.nome}</span>
                      {empresa.contaDeTeste && (
                        <Badge variant="secondary">teste</Badge>
                      )}
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <Dado rotulo="★ consumidas">
                        {formatarEstrelas(empresa.consumoNoPeriodo)}
                      </Dado>
                      <Dado rotulo="Saldo ★">
                        {formatarEstrelas(empresa.saldo)}
                      </Dado>
                      <Dado rotulo="Tokens">
                        {empresa.tokens.toLocaleString("pt-BR")}
                      </Dado>
                      <Dado rotulo="Custo Gemini">
                        {formatBRL(empresa.custoGeminiReal)}
                      </Dado>
                    </dl>

                    <AcoesDaEmpresa
                      empresa={empresa}
                      onCreditar={setCreditando}
                      onPrecificar={setPrecificando}
                      onReiniciar={setReiniciando}
                    />
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">★ consumidas</TableHead>
                      <TableHead className="text-right">Saldo ★</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Custo Gemini</TableHead>
                      <TableHead className="w-px" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumidoras.map((empresa) => (
                      <TableRow key={empresa.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{empresa.nome}</span>
                            {empresa.contaDeTeste && (
                              <Badge variant="secondary">teste</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarEstrelas(empresa.consumoNoPeriodo)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarEstrelas(empresa.saldo)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {empresa.tokens.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(empresa.custoGeminiReal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <AcoesDaEmpresa
                            empresa={empresa}
                            onCreditar={setCreditando}
                            onPrecificar={setPrecificando}
                            onReiniciar={setReiniciando}
                          />
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

      <div className="mt-4">
        <ConversorDeTokens />
      </div>

      <CreditarStarsDialog
        empresa={creditando}
        onClose={() => setCreditando(null)}
      />

      <ReiniciarAstroDialog
        empresa={reiniciando}
        onClose={() => setReiniciando(null)}
      />

      <PrecosDaEmpresaDialog
        empresa={precificando}
        onClose={() => setPrecificando(null)}
      />
    </>
  );
}

/** Busca sem acento e sem caixa: "acai" acha "Açaí". */
function normalizar(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Numero({
  rotulo,
  valor,
  detalhe,
  carregando,
}: {
  rotulo: string;
  valor?: string;
  detalhe?: string;
  carregando: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
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

/**
 * Os três botões da empresa, iguais no cartão e na tabela.
 *
 * No retrato eles ocupam a largura (`flex-1`): três alvos de toque lado a lado
 * num telefone ficam estreitos demais para acertar sem errar o vizinho.
 */
function AcoesDaEmpresa({
  empresa,
  onCreditar,
  onPrecificar,
  onReiniciar,
}: {
  empresa: Empresa;
  onCreditar: (empresa: Empresa) => void;
  onPrecificar: (empresa: Empresa) => void;
  onReiniciar: (empresa: Empresa) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex-1 md:flex-none"
        onClick={() => onCreditar(empresa)}
      >
        <Plus className="size-3.5" />
        Creditar ★
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 md:flex-none"
        onClick={() => onPrecificar(empresa)}
        title="Quanto cada ação custa nesta empresa"
      >
        <Tag className="size-3.5" />
        Preços
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 md:flex-none"
        onClick={() => onReiniciar(empresa)}
        title="Ver por que o Astro não responde e reiniciar"
      >
        <RotateCcw className="size-3.5" />
        Reiniciar
      </Button>
    </div>
  );
}
