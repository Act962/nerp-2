"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  tableNumber: string;
  dishName: string;
}

export function OrderQrDialog({
  open,
  onOpenChange,
  orderId,
  tableNumber,
  dishName,
}: Props) {
  // Resolve a URL absoluta no cliente — depende do host atual (funciona em dev,
  // staging e prod sem hardcode de domínio).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const url = origin ? `${origin}/pedido-cliente/${orderId}` : "";

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acompanhar pedido</DialogTitle>
          <DialogDescription>
            Mesa {tableNumber} · {dishName}. Cliente escaneia o QR para ver o
            status em tempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            {url ? (
              <QRCodeSVG
                value={url}
                size={208}
                marginSize={1}
                level="M"
                aria-label={`QR para o pedido ${orderId}`}
              />
            ) : (
              <div className="size-52 animate-pulse rounded-lg bg-muted" />
            )}
          </div>
          <p className="break-all text-center text-xs text-muted-foreground">
            {url}
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={copyUrl}
            disabled={!url}
          >
            <Copy className="size-4" />
            Copiar link
          </Button>
          <DialogClose asChild>
            <Button>Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
