"use client";

import {
  Ban,
  Download,
  FileX2,
  MoreVertical,
  RotateCw,
  Send,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useReenviarNfce, useTentarNfceNovamente } from "../hooks/use-nfce";
import { type FiltrosNotas, useNotasFiscais } from "../hooks/use-notas-fiscais";
import {
  CancelarNfceDialog,
  type NotaParaCancelar,
} from "./cancelar-nfce-dialog";

type Status = NonNullable<FiltrosNotas["status"]>;

export const STATUS_NOTA: Record<Status, { rotulo: string; classe: string }> = {
  AUTHORIZED: {
    rotulo: "Autorizada",
    classe: "bg-success/15 text-success border-success/30",
  },
  PENDING: { rotulo: "Aguardando envio", classe: "bg-muted text-foreground" },
  PROCESSING: { rotulo: "Na SEFAZ", classe: "bg-muted text-foreground" },
  REJECTED: {
    rotulo: "Rejeitada",
    classe: "bg-destructive/10 text-destructive border-destructive/30",
  },
  DENIED: {
    rotulo: "Denegada",
    classe: "bg-destructive/10 text-destructive border-destructive/30",
  },
  CANCELLED: {
    rotulo: "Cancelada",
    classe: "bg-muted text-muted-foreground line-through",
  },
  VOIDED: { rotulo: "Inutilizada", classe: "bg-muted text-muted-foreground" },
  CONTINGENCY: {
    rotulo: "Contingência",
    classe: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
};

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Fortaleza",
  });
}

function formatarDocumento(doc: string) {
  return doc.length === 11
    ? doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function TabelaNotas() {
  const [status, setStatus] = useState<Status | "TODOS">("TODOS");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [numero, setNumero] = useState("");
  const paginacao = useCursorPagination();
  const [cancelando, setCancelando] = useState<NotaParaCancelar | null>(null);
  const reenviar = useReenviarNfce();
  const tentar = useTentarNfceNovamente();

  const { data, isLoading, isFetching } = useNotasFiscais({
    status: status === "TODOS" ? undefined : status,
    de: de || undefined,
    ate: ate || undefined,
    numero: Number(numero) > 0 ? Number(numero) : undefined,
    cursor: paginacao.cursor,
  });

  // Trocar filtro volta para a primeira página: o cursor era da lista antiga.
  function filtrar<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      paginacao.reset();
    };
  }

  const agora = Date.now();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filtro-status">Situação</Label>
          <Select
            value={status}
            onValueChange={filtrar((v: string) =>
              setStatus(v as Status | "TODOS"),
            )}
          >
            <SelectTrigger id="filtro-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todas</SelectItem>
              {Object.entries(STATUS_NOTA).map(([valor, { rotulo }]) => (
                <SelectItem key={valor} value={valor}>
                  {rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filtro-de">De</Label>
          <Input
            id="filtro-de"
            type="date"
            value={de}
            onChange={(e) => filtrar(setDe)(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filtro-ate">Até</Label>
          <Input
            id="filtro-ate"
            type="date"
            value={ate}
            onChange={(e) => filtrar(setAte)(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filtro-numero">Número</Label>
          <Input
            id="filtro-numero"
            inputMode="numeric"
            placeholder="Ex.: 1532"
            value={numero}
            onChange={(e) =>
              filtrar(setNumero)(e.target.value.replace(/\D/g, ""))
            }
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data?.itens.length ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          <FileX2 className="size-8" />
          Nenhuma nota com estes filtros.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nota</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Consumidor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.itens.map((n) => {
                const situacao = STATUS_NOTA[n.status];
                const cancelavel =
                  n.cancelavelAte !== null &&
                  new Date(n.cancelavelAte).getTime() > agora;
                const parada = n.status === "PENDING" && n.tentativas > 0;
                return (
                  <TableRow key={n.id}>
                    <TableCell data-label="Nota" className="font-mono">
                      {n.numero}
                      <span className="text-muted-foreground">/{n.serie}</span>
                      {n.ambiente === "HOMOLOGACAO" && (
                        <Badge variant="outline" className="ml-2 font-sans">
                          homologação
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell data-label="Emissão">
                      {dataHora(n.autorizadoEm ?? n.criadoEm)}
                    </TableCell>
                    <TableCell data-label="Venda" className="font-mono">
                      #{n.saleNumber}
                    </TableCell>
                    <TableCell data-label="Consumidor">
                      {n.destinatario ? (
                        formatarDocumento(n.destinatario)
                      ) : (
                        <span className="text-muted-foreground">
                          Não identificado
                        </span>
                      )}
                    </TableCell>
                    <TableCell data-label="Situação">
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline" className={situacao.classe}>
                          {situacao.rotulo}
                        </Badge>
                        {n.rejeicao && n.status !== "AUTHORIZED" && (
                          <span className="max-w-64 text-xs text-muted-foreground">
                            {n.rejeicao.codigo}: {n.rejeicao.motivo}
                          </span>
                        )}
                        {n.cancelamento && (
                          <span className="max-w-64 text-xs text-muted-foreground">
                            {n.cancelamento.justificativa}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      data-label="Valor"
                      className="text-right font-semibold"
                    >
                      {currencyFormatter(n.totalCentavos / 100)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ações da nota ${n.numero}`}
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {n.temXml && (
                            <DropdownMenuItem asChild>
                              <a href={`/api/fiscal/xml/${n.id}?tipo=nota`}>
                                <Download className="size-4" />
                                Baixar XML
                              </a>
                            </DropdownMenuItem>
                          )}
                          {n.temXmlCancelamento && (
                            <DropdownMenuItem asChild>
                              <a
                                href={`/api/fiscal/xml/${n.id}?tipo=cancelamento`}
                              >
                                <Download className="size-4" />
                                Baixar XML do cancelamento
                              </a>
                            </DropdownMenuItem>
                          )}
                          {n.status === "REJECTED" && (
                            <DropdownMenuItem
                              disabled={reenviar.isPending}
                              onClick={() =>
                                reenviar.mutate({ documentoId: n.id })
                              }
                            >
                              <Send className="size-4" />
                              Reenviar com o cadastro atual
                            </DropdownMenuItem>
                          )}
                          {parada && (
                            <DropdownMenuItem
                              disabled={tentar.isPending}
                              onClick={() =>
                                tentar.mutate({ documentoId: n.id })
                              }
                            >
                              <RotateCw className="size-4" />
                              Tentar enviar agora
                            </DropdownMenuItem>
                          )}
                          {cancelavel && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setCancelando({
                                    id: n.id,
                                    numero: n.numero,
                                    serie: n.serie,
                                    cancelavelAte: n.cancelavelAte,
                                  })
                                }
                              >
                                <Ban className="size-4" />
                                Cancelar nota
                              </DropdownMenuItem>
                            </>
                          )}
                          {!n.temXml &&
                            !n.temXmlCancelamento &&
                            n.status !== "REJECTED" &&
                            !parada &&
                            !cancelavel && (
                              <DropdownMenuItem disabled>
                                Nenhuma ação disponível
                              </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Página {paginacao.pageIndex}
          {isFetching && !isLoading && " · atualizando…"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!paginacao.hasPrevious}
            onClick={paginacao.goPrevious}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.nextCursor}
            onClick={() => paginacao.goNext(data?.nextCursor)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <CancelarNfceDialog
        nota={cancelando}
        onOpenChange={(aberto) => {
          if (!aberto) setCancelando(null);
        }}
      />
    </div>
  );
}
