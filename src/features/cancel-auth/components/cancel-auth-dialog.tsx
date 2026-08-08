"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { currencyFormatter } from "@/utils/currency-formatter";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useAuthorizeCancelByPin,
  useCancelRequestStatus,
  useCreateCancelRequest,
} from "../hooks/use-cancel-auth";

export type CancelAuthRequest = {
  kind: "REMOVE_ITEM" | "REDUCE_QTY";
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

interface CancelAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: CancelAuthRequest | null;
  cashSessionId?: string | null;
  onApproved: () => void;
}

export function CancelAuthDialog({
  open,
  onOpenChange,
  request,
  cashSessionId,
  onApproved,
}: CancelAuthDialogProps) {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const create = useCreateCancelRequest();
  const authorizePin = useAuthorizeCancelByPin();
  const status = useCancelRequestStatus(requestId, open);

  // Zera o estado a cada abertura/fechamento (nova solicitação, novo token).
  useEffect(() => {
    if (!open) {
      setReason("");
      setPin("");
      setRequestId(null);
      setToken(null);
    }
  }, [open]);

  // Aprovado (por PIN na tela OU por QR no celular): aplica e fecha.
  useEffect(() => {
    if (status.data?.status === "APPROVED") {
      toast.success(
        status.data.approvedByName
          ? `Autorizado por ${status.data.approvedByName}`
          : "Cancelamento autorizado",
      );
      onApproved();
      onOpenChange(false);
    }
    if (status.data?.status === "REJECTED") {
      toast.error("Autorização recusada pelo supervisor");
      onOpenChange(false);
    }
    if (status.data?.status === "EXPIRED") {
      toast.error("Solicitação expirada");
      onOpenChange(false);
    }
  }, [status.data, onApproved, onOpenChange]);

  if (!request) return null;

  const title =
    request.kind === "REMOVE_ITEM" ? "Remover item" : "Reduzir quantidade";

  const requestAuth = () => {
    create.mutate(
      {
        kind: request.kind,
        productName: request.productName,
        quantity: request.quantity,
        unitPrice: request.unitPrice,
        amount: request.amount,
        reason: reason.trim() || undefined,
        cashSessionId: cashSessionId ?? undefined,
      },
      {
        onSuccess: (data) => {
          setRequestId(data.id);
          setToken(data.token);
        },
      },
    );
  };

  const submitPin = () => {
    if (!requestId) return;
    authorizePin.mutate({ requestId, pin });
  };

  const approveUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/autorizar/${token}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title} — autorização</DialogTitle>
          <DialogDescription>
            Esta ação exige a autorização de um supervisor.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="font-medium">{request.productName}</div>
          <div className="text-muted-foreground">
            {request.kind === "REMOVE_ITEM"
              ? `${request.quantity} × ${currencyFormatter(request.unitPrice)}`
              : `Reduzir ${request.quantity} un.`}{" "}
            · {currencyFormatter(request.amount)}
          </div>
        </div>

        {!token ? (
          // Fase 1: o caixa confirma o motivo e gera a solicitação (QR/token).
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
              <Input
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: cliente desistiu do item"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={requestAuth}
                disabled={create.isPending}
              >
                {create.isPending ? "Gerando…" : "Solicitar autorização"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Fase 2: QR para o celular do supervisor OU PIN na própria tela.
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              {approveUrl && (
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG value={approveUrl} size={160} />
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                O supervisor escaneia o QR com o celular para autorizar, ou
                digita o PIN abaixo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">ou</span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cancel-pin">PIN do supervisor</Label>
              <div className="flex gap-2">
                <Input
                  id="cancel-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitPin();
                    }
                  }}
                  placeholder="••••"
                />
                <Button
                  type="button"
                  onClick={submitPin}
                  disabled={authorizePin.isPending || pin.length < 4}
                >
                  {authorizePin.isPending ? "…" : "Autorizar"}
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Aguardando autorização…
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
