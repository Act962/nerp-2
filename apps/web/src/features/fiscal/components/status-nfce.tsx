"use client";

import type { InferRouterOutputs } from "@orpc/server";
import Link from "next/link";
import type { fiscalRoutes } from "@/app/router/fiscal";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  RotateCw,
} from "lucide-react";
import { useState } from "react";
import { useReenviarNfce, useTentarNfceNovamente } from "../hooks/use-nfce";
import { CancelarNfceDialog } from "./cancelar-nfce-dialog";

type Documento = NonNullable<
  InferRouterOutputs<typeof fiscalRoutes>["daVenda"]
>;

/**
 * Situação da NFC-e na tela de venda concluída. O caixa precisa saber, sem
 * ambiguidade, se o cliente sai com nota — e o que fazer quando não sai.
 */
export function StatusNfce({
  documento,
  carregando,
}: {
  documento: Documento | null | undefined;
  carregando: boolean;
}) {
  const tentar = useTentarNfceNovamente();
  const reenviar = useReenviarNfce();
  const [cancelando, setCancelando] = useState(false);

  if (carregando || !documento)
    return (
      <Linha icone={<Loader2 className="size-4 animate-spin" />}>
        Emitindo NFC-e…
      </Linha>
    );

  const homologacao = documento.ambiente === "HOMOLOGACAO";

  switch (documento.status) {
    case "AUTHORIZED": {
      // Erro percebido no balcão (valor, item, cliente desistiu): dá para
      // cancelar ali mesmo, dentro dos 30 minutos da SEFAZ.
      const cancelavel =
        documento.cancelavelAte !== null &&
        new Date(documento.cancelavelAte).getTime() > Date.now();
      return (
        <Linha
          icone={<CheckCircle2 className="size-4 text-success" />}
          tom="sucesso"
        >
          <span>
            NFC-e nº {documento.numero} autorizada
            {homologacao && " (homologação — sem valor fiscal)"}
          </span>
          {cancelavel && (
            <span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelando(true)}
              >
                <Ban className="size-3.5" />
                Cancelar nota
              </Button>
              <CancelarNfceDialog
                nota={cancelando ? documento : null}
                onOpenChange={setCancelando}
              />
            </span>
          )}
        </Linha>
      );
    }
    case "PENDING":
    case "PROCESSING": {
      // Tentativa registrada e ainda pendente = o provedor não respondeu.
      const parado = documento.status === "PENDING" && documento.tentativas > 0;
      return (
        <Linha
          icone={
            parado ? (
              <AlertTriangle className="size-4 text-amber-600" />
            ) : (
              <Loader2 className="size-4 animate-spin" />
            )
          }
        >
          {parado
            ? "Sem resposta do emissor — a nota será enviada assim que ele voltar."
            : "Aguardando a SEFAZ…"}
          {parado && (
            <Button
              size="sm"
              variant="outline"
              disabled={tentar.isPending}
              onClick={() => tentar.mutate({ documentoId: documento.id })}
            >
              <RotateCw className="size-3.5" />
              Tentar agora
            </Button>
          )}
        </Linha>
      );
    }
    case "REJECTED":
      return (
        <Linha
          icone={<AlertTriangle className="size-4 text-destructive" />}
          tom="erro"
        >
          <span>
            NFC-e rejeitada ({documento.rejeicao?.codigo}):{" "}
            {documento.rejeicao?.motivo}
          </span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/produtos/fiscal">Corrigir cadastro</Link>
            </Button>
            <Button
              size="sm"
              disabled={reenviar.isPending}
              onClick={() => reenviar.mutate({ documentoId: documento.id })}
            >
              <RotateCw className="size-3.5" />
              Reenviar
            </Button>
          </span>
        </Linha>
      );
    case "DENIED":
      return (
        <Linha
          icone={<AlertTriangle className="size-4 text-destructive" />}
          tom="erro"
        >
          Uso denegado pela SEFAZ ({documento.rejeicao?.codigo}). Procure o
          contador: há irregularidade no cadastro da empresa ou do cliente.
        </Linha>
      );
    case "CANCELLED":
      return (
        <Linha icone={<Ban className="size-4" />}>
          NFC-e nº {documento.numero} cancelada
        </Linha>
      );
    case "VOIDED":
      return (
        <Linha icone={<AlertTriangle className="size-4" />}>
          O número {documento.numero} foi inutilizado. A venda pode emitir uma
          nova NFC-e.
        </Linha>
      );
    default:
      return (
        <Linha icone={<AlertTriangle className="size-4" />}>
          NFC-e {documento.status.toLowerCase()}
        </Linha>
      );
  }
}

function Linha({
  icone,
  tom,
  children,
}: {
  icone: React.ReactNode;
  tom?: "sucesso" | "erro";
  children: React.ReactNode;
}) {
  const cor =
    tom === "sucesso"
      ? "border-success/40 bg-success/10"
      : tom === "erro"
        ? "border-destructive/40 bg-destructive/10"
        : "bg-muted/50";
  return (
    // <output> tem papel "status": leitor de tela anuncia a mudança.
    <output
      className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${cor}`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{icone}</span>
        <div className="flex flex-1 flex-col gap-2">{children}</div>
      </div>
    </output>
  );
}
