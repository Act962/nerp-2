"use client";

import { CheckCircle2, Download } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNumeracaoFiscal } from "../hooks/use-notas-fiscais";
import { InutilizarDialog } from "./inutilizar-dialog";

function faixaTexto(inicio: number, fim: number) {
  return inicio === fim ? `nº ${inicio}` : `nº ${inicio} a ${fim}`;
}

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
  });
}

/**
 * A série da NFC-e: o próximo número, os buracos que a SEFAZ espera ver
 * inutilizados e o histórico do que já foi inutilizado.
 */
export function NumeracaoFiscal() {
  const { data, isLoading } = useNumeracaoFiscal();
  const [faixa, setFaixa] = useState<{ inicio: number; fim: number } | null>(
    null,
  );

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Série {data.serie} da NFC-e</CardTitle>
          <CardDescription>
            {data.proximo === null
              ? "Nenhuma nota emitida nesta série ainda."
              : `Próximo número: ${data.proximo}.`}{" "}
            Número que foi reservado e não virou nota — venda que não chegou a
            transmitir, rejeitada que ninguém reenviou — precisa ser inutilizado
            na SEFAZ. Rejeitada aparece aqui só 24 horas depois, para dar tempo
            de corrigir e reenviar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.pulados.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" />
              Nenhum número pulado.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.pulados.map((f) => (
                <li
                  key={f.inicio}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <span>
                    {faixaTexto(f.inicio, f.fim)}
                    <span className="text-muted-foreground">
                      {" "}
                      · {f.fim - f.inicio + 1}{" "}
                      {f.fim === f.inicio ? "número" : "números"}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFaixa(f)}
                  >
                    Inutilizar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data.inutilizacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inutilizações registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faixa</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.inutilizacoes.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell data-label="Faixa" className="font-mono">
                      {faixaTexto(i.numeroInicial, i.numeroFinal)}
                      {i.ambiente === "HOMOLOGACAO" && (
                        <Badge variant="outline" className="ml-2">
                          homologação
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell data-label="Quando">
                      {dataHora(i.inutilizadaEm)}
                    </TableCell>
                    <TableCell data-label="Protocolo" className="font-mono">
                      {i.protocolo}
                    </TableCell>
                    <TableCell data-label="Justificativa">
                      {i.justificativa}
                    </TableCell>
                    <TableCell>
                      {i.temXml && (
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={`/api/fiscal/xml/${i.id}?tipo=inutilizacao`}
                            aria-label="Baixar XML da inutilização"
                          >
                            <Download className="size-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <InutilizarDialog
        faixa={faixa}
        serie={data.serie}
        onOpenChange={(aberto) => {
          if (!aberto) setFaixa(null);
        }}
      />
    </div>
  );
}
