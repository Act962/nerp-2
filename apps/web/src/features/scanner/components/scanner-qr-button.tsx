"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import { hasFullAccess } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { QrCode, Smartphone } from "lucide-react";
import { usePdvUiStore } from "@/features/sales/pdv-ui-store";
import { useState } from "react";
import {
  useCreateScannerPairing,
  useRevokeScannerPairing,
  useScannerStatus,
} from "../hooks/use-scanner";
import { ScannerQrCard } from "./scanner-qr-card";

/**
 * Botão do QR no cabeçalho, ao lado da tela cheia.
 *
 * Só aparece para dono e administrador: o QR dispensa senha, então quem pode
 * exibi-lo é quem pode transformar um celular em leitor daquele terminal. O
 * servidor recusa de novo em `scanner.createPairing` — o sumiço do botão é
 * conveniência, não a trava.
 */
export function ScannerQrButton() {
  const { data: member } = useQuery(
    orpc.members.getCurrent.queryOptions({ input: {} }),
  );
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const publicarToken = usePdvUiStore((state) => state.setScannerToken);

  const create = useCreateScannerPairing();
  const revoke = useRevokeScannerPairing();
  const { data: status } = useScannerStatus(open ? token : null);

  if (!hasFullAccess(member?.role)) return null;

  const abrir = () => {
    setOpen(true);
    create.mutate(
      {},
      {
        onSuccess: ({ token: novo }) => {
          setToken(novo);
          publicarToken(novo);
        },
      },
    );
  };

  const fechar = (next: boolean) => {
    setOpen(next);
    // Fechar o diálogo encerra o pareamento pendente: QR fora da tela não
    // deveria continuar valendo.
    if (!next && token && status?.status !== "ACTIVE") {
      revoke.mutate({ token });
      setToken(null);
      publicarToken(null);
    }
  };

  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/leitor/${token}`
      : null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Usar celular como leitor"
        title="Usar celular como leitor"
        onClick={abrir}
      >
        <QrCode className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={fechar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Celular como leitor</DialogTitle>
            <DialogDescription>
              Aponte a câmera do celular para o código. Ele vira um leitor deste
              terminal — o que for lido entra direto na venda.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            {create.isPending || !url ? (
              <div className="py-10">
                <Spinner />
              </div>
            ) : (
              <>
                <ScannerQrCard value={url} />
                {status?.status === "ACTIVE" ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <Smartphone className="size-4" />
                    Celular conectado e lendo
                  </p>
                ) : status?.status === "EXPIRED" ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Código expirado.
                    </p>
                    <Button size="sm" variant="outline" onClick={abrir}>
                      Gerar outro
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aguardando o celular abrir...
                  </p>
                )}
                {/* O prazo curto é o que compensa a ausência de senha: foto da
                    tela não serve depois que expira. */}
                <p className="text-center text-xs text-muted-foreground">
                  O código vale por poucos minutos e pareia um aparelho só.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
