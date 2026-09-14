"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ReceiptPrintArea,
  triggerReceiptPrint,
} from "@/features/receipt-designer/components/receipt-print";
import { blocksToEscpos } from "@/features/receipt-designer/lib/escpos/render-blocks";
import { presetBlocks } from "@/features/receipt-designer/lib/presets";
import type {
  ReceiptBlock,
  ReceiptPaper,
  ReceiptSaleData,
} from "@/features/receipt-designer/lib/types";
import { useReceiptDefaultTemplate } from "@/features/receipt-designer/hooks/use-receipt-templates";
import { cn } from "@/lib/utils";
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Loader2,
  Printer,
  RotateCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useFilaState } from "../hooks/use-fila-state";
import {
  useMarcarImpresso,
  useTicketsParaImprimir,
} from "../hooks/use-fila-de-impressao";
import { useImpressora } from "../hooks/use-impressora";
import { useWakeLock } from "../hooks/use-wake-lock";
import {
  type TicketParaImprimir,
  ticketParaCupom,
  urlDoTicket,
} from "../lib/ticket-para-cupom";
import { AjustesDaImpressoraDialog } from "./printer-settings";

type Props = {
  org: ReceiptSaleData["org"];
};

export function PrintStation({ org }: Props) {
  const impressora = useImpressora();
  const { data: template } = useReceiptDefaultTemplate();
  const marcarImpresso = useMarcarImpresso();
  const [ligada, setLigada] = useState(false);
  const [codepage, setCodepage] = useState<"CP437" | "CP850" | "CP860">(
    "CP860",
  );
  const [preview, setPreview] = useState<{
    blocks: ReceiptBlock[];
    data: ReceiptSaleData;
    paper: ReceiptPaper;
  } | null>(null);

  const { data: tickets } = useTicketsParaImprimir(ligada);
  const { historico, registrar } = useFilaState();

  // Tickets já despachados nesta sessão. O poll continua correndo enquanto os
  // bytes saem, e sem esta trava o mesmo pedido seria enfileirado de novo.
  const emVoo = useRef(new Set<string>());

  useWakeLock(ligada);

  // Sem template padrão definido, o cupom sai no preset não fiscal em 58mm —
  // que é a bobina do food truck. Mesmo fallback que o PDV já usa.
  const blocks: ReceiptBlock[] =
    template?.template?.blocks ?? presetBlocks("NAO_FISCAL");
  const paper: ReceiptPaper = template?.template?.paper ?? "MM58";

  const imprimirTicket = useCallback(
    async (ticket: TicketParaImprimir, reimpressao = false) => {
      const data = ticketParaCupom(ticket, org, urlDoTicket(ticket.ticketId));

      if (impressora.conectada) {
        const bytes = blocksToEscpos(blocks, data, paper, { codepage });
        await impressora.imprimir(bytes);
      } else {
        // Sem Bluetooth (iPhone, computador, impressora desligada) o cupom
        // ainda sai: cai no diálogo de impressão do navegador, que é o caminho
        // que o PDV já usa.
        setPreview({ blocks, data, paper });
        // Espera o portal montar antes de mandar imprimir.
        await new Promise((resolve) => setTimeout(resolve, 120));
        triggerReceiptPrint(paper);
      }

      await marcarImpresso.mutateAsync({
        ticketId: ticket.ticketId,
        force: reimpressao,
      });
      registrar(ticket);
    },
    [blocks, codepage, impressora, marcarImpresso, org, paper, registrar],
  );

  // O despacho roda em série: a fila da impressora já serializa os bytes, mas
  // marcar como impresso antes da vez faria um pedido sumir se o papel acabasse.
  useEffect(() => {
    if (!ligada || !tickets || tickets.length === 0) return;

    let cancelado = false;

    (async () => {
      for (const ticket of tickets) {
        if (cancelado) return;
        if (emVoo.current.has(ticket.ticketId)) continue;
        emVoo.current.add(ticket.ticketId);

        try {
          await imprimirTicket(ticket);
        } catch (erro) {
          emVoo.current.delete(ticket.ticketId);
          toast.error(
            erro instanceof Error ? erro.message : "Falha ao imprimir o pedido",
          );
          return; // Para a rodada: insistir com a impressora caída só gera ruído.
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [ligada, tickets, imprimirTicket]);

  const conectar = async () => {
    try {
      await impressora.conectar();
      setLigada(true);
      toast.success("Impressora conectada");
    } catch (erro) {
      toast.error(
        erro instanceof Error ? erro.message : "Não foi possível conectar",
      );
    }
  };

  const semSuporte = impressora.estado === "sem-suporte";
  const pendentes = tickets?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full",
                impressora.conectada
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {impressora.estado === "conectando" ? (
                <Loader2 className="size-6 animate-spin" />
              ) : impressora.conectada ? (
                <BluetoothConnected className="size-6" />
              ) : semSuporte ? (
                <BluetoothOff className="size-6" />
              ) : (
                <Bluetooth className="size-6" />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold">
                {impressora.conectada
                  ? (impressora.nome ?? "Impressora conectada")
                  : semSuporte
                    ? "Sem Bluetooth neste aparelho"
                    : "Impressora desconectada"}
              </p>
              <p className="text-sm text-muted-foreground">
                {impressora.detalhe ??
                  (semSuporte
                    ? "Use o Chrome no Android para imprimir direto. Aqui o cupom sai pelo diálogo de impressão."
                    : impressora.conectada
                      ? "Mantenha esta tela aberta enquanto estiver atendendo."
                      : "Conecte uma vez; depois o cupom sai sozinho.")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AjustesDaImpressoraDialog
              ajustes={impressora.ajustes}
              aoSalvar={impressora.aplicarAjustes}
              codepage={codepage}
              aoTrocarCodepage={setCodepage}
              aoImprimirTeste={async () => {
                const teste = ticketParaCupom(
                  TICKET_DE_TESTE,
                  org,
                  urlDoTicket("teste"),
                );
                if (impressora.conectada) {
                  await impressora.imprimir(
                    blocksToEscpos(blocks, teste, paper, { codepage }),
                  );
                } else {
                  setPreview({ blocks, data: teste, paper });
                  await new Promise((r) => setTimeout(r, 120));
                  triggerReceiptPrint(paper);
                }
              }}
            />
            {impressora.conectada ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  impressora.desconectar();
                  setLigada(false);
                }}
              >
                Desconectar
              </Button>
            ) : (
              <Button size="lg" onClick={conectar} disabled={semSuporte}>
                <Bluetooth className="size-5" />
                Conectar impressora
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Printer className="size-5 text-muted-foreground" />
            <p className="font-medium">Fila de impressão</p>
          </div>
          <div className="flex items-center gap-2">
            {pendentes > 0 && (
              <Badge variant="secondary">{pendentes} na fila</Badge>
            )}
            <Button
              variant={ligada ? "secondary" : "default"}
              onClick={() => setLigada((v) => !v)}
            >
              {ligada ? "Pausar" : "Retomar"}
            </Button>
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {ligada
            ? "Cada pedido aceito sai impresso automaticamente."
            : "Pausada: nenhum pedido será impresso enquanto isso."}
        </p>
      </Card>

      <Card className="p-5">
        <p className="font-medium">Últimos impressos</p>
        {historico.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nada impresso ainda nesta sessão.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {historico.map((ticket) => (
              <li
                key={ticket.ticketId}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{ticket.tableNumber}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {ticket.items.map((item) => item.name).join(", ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void imprimirTicket(ticket, true).catch((erro) =>
                      toast.error(
                        erro instanceof Error
                          ? erro.message
                          : "Falha ao reimprimir",
                      ),
                    );
                  }}
                >
                  <RotateCw className="size-4" />
                  Imprimir de novo
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {preview && (
        <ReceiptPrintArea
          blocks={preview.blocks}
          data={preview.data}
          paper={preview.paper}
        />
      )}
    </div>
  );
}

const TICKET_DE_TESTE: TicketParaImprimir = {
  ticketId: "teste",
  tableNumber: "Teste de impressão",
  createdAt: new Date().toISOString(),
  attendantName: "Órbita",
  customerName: "ÁÉÍÓÚ ÃÕ ÇÑ º ª",
  saleNumber: null,
  subtotal: 25,
  discount: 0,
  total: 25,
  items: [
    {
      name: "Hambúrguer artesanal",
      quantity: 1,
      unitPrice: 25,
      total: 25,
      notes: "sem cebola, capricha no bacon",
      estimatedMinutes: 12,
    },
  ],
};
