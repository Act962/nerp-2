"use client";

import Link from "next/link";
import { useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CheckCircle2, FilePenLine, Info, Search } from "lucide-react";
import { useProntidaoFiscal } from "../hooks/use-perfil-tributario";
import { EditarFiscalEmLoteDialog } from "./editar-fiscal-em-lote-dialog";

const ROTULOS = {
  ncm: "Sem NCM",
  cfop: "Sem CFOP",
  cstIcms: "Sem CSOSN/CST",
  cstPis: "Sem CST PIS",
  cstCofins: "Sem CST COFINS",
  formato: "Código inválido",
} as const;

/**
 * Quantos produtos já podem sair em nota e o que falta nos outros — a lista de
 * tarefas do cadastro fiscal antes da primeira NFC-e.
 */
export function ProntidaoFiscal() {
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebouncedValue(busca);
  const { data, isPending } = useProntidaoFiscal(buscaDebounced);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dialogAberto, setDialogAberto] = useState(false);

  const itens = data?.itens ?? [];
  const todosMarcados =
    itens.length > 0 && itens.every((i) => selecionados.has(i.id));

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const percentual =
    data && data.total > 0 ? (data.prontos / data.total) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cadastro fiscal"
        description="Produtos prontos para sair em nota fiscal e o que falta nos demais"
      >
        <Button
          disabled={selecionados.size === 0}
          onClick={() => setDialogAberto(true)}
        >
          <FilePenLine className="size-4" />
          Editar {selecionados.size > 0 ? selecionados.size : ""} selecionados
        </Button>
      </PageHeader>

      {data && !data.regime && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Regime tributário não configurado</AlertTitle>
          <AlertDescription>
            Até lá, a conferência assume Simples Nacional. Configure o regime e
            os padrões de tributação em{" "}
            <Link href="/integracoes" className="underline">
              Integrações → Focus NFe
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {isPending || !data ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {data.prontos}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    de {data.total} produtos ativos prontos
                  </span>
                </p>
              </div>
              {data.semGtin > 0 && (
                <p className="text-sm text-muted-foreground">
                  {data.semGtin} sem código de barras válido — saem como
                  &ldquo;SEM GTIN&rdquo;, não bloqueia.
                </p>
              )}
            </div>
            <Progress value={percentual} />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ROTULOS) as (keyof typeof ROTULOS)[])
                .filter((campo) => data.porCampo[campo] > 0)
                .map((campo) => (
                  <Badge key={campo} variant="secondary">
                    {ROTULOS[campo]}: {data.porCampo[campo]}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, SKU ou código de barras"
          className="pl-8"
        />
      </div>

      {data && data.pendentes === 0 && !isPending ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <CheckCircle2 className="size-5 text-primary" />
            Nenhum produto pendente{buscaDebounced ? " nesta busca" : ""}.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={todosMarcados}
                    onCheckedChange={(marcar) =>
                      setSelecionados(
                        marcar ? new Set(itens.map((i) => i.id)) : new Set(),
                      )
                    }
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>NCM</TableHead>
                <TableHead>CFOP</TableHead>
                <TableHead>ICMS</TableHead>
                <TableHead>O que falta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selecionados.has(item.id)}
                      onCheckedChange={() => alternar(item.id)}
                      aria-label={`Selecionar ${item.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/produtos/${item.id}/editar`}
                      className="font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    {item.sku && (
                      <p className="text-xs text-muted-foreground">
                        {item.sku}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.ncm ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.cfop ?? "padrão"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.cstIcms ?? "padrão"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.pendencias.map((p) => (
                        <Badge key={p.campo + p.mensagem} variant="outline">
                          {p.mensagem}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.truncado && (
        <p className="text-sm text-muted-foreground">
          Mostrando os primeiros {itens.length} de {data.pendentes} pendentes.
          Corrija estes ou use a busca para ver os demais.
        </p>
      )}

      <EditarFiscalEmLoteDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        productIds={[...selecionados]}
        onSalvo={() => setSelecionados(new Set())}
      />
    </div>
  );
}
