"use client";

import { ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMarcarAvisoFv } from "../hooks/use-forca-vendas";
import { formatarDataHora } from "../lib/formatar";

export type AvisoDoVendedor = {
  id: string;
  titulo: string;
  corpo: string;
  link: string | null;
  prioridade: "NORMAL" | "IMPORTANTE" | "URGENTE";
  exigeConfirmacao: boolean;
  inicioEm: string;
  autor: string | null;
  visualizadoEm: string | null;
  confirmadoEm: string | null;
  pendente: boolean;
};

/**
 * Aviso do gestor aberto. Bloqueante (URGENTE) não fecha por fora nem pelo
 * Esc: a home só volta depois do "Li e entendi".
 */
export function AvisoDialog({
  aviso,
  aberto,
  bloqueante,
  onFechar,
}: {
  aviso: AvisoDoVendedor;
  aberto: boolean;
  bloqueante: boolean;
  onFechar: () => void;
}) {
  const marcar = useMarcarAvisoFv();
  const { mutate } = marcar;

  // Abrir conta como visualizado; confirmar é outro passo, quando exigido.
  useEffect(() => {
    if (aberto && !aviso.visualizadoEm) {
      mutate({ avisoId: aviso.id, acao: "VISUALIZAR" });
    }
  }, [aberto, aviso.id, aviso.visualizadoEm, mutate]);

  const precisaConfirmar = aviso.exigeConfirmacao && !aviso.confirmadoEm;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open && !(bloqueante && precisaConfirmar)) onFechar();
      }}
    >
      <DialogContent
        showCloseButton={!(bloqueante && precisaConfirmar)}
        onEscapeKeyDown={(event) => {
          if (bloqueante && precisaConfirmar) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (bloqueante && precisaConfirmar) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{aviso.titulo}</DialogTitle>
          <DialogDescription>
            {aviso.autor ? `${aviso.autor} · ` : ""}
            {formatarDataHora(aviso.inicioEm)}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm whitespace-pre-wrap">{aviso.corpo}</p>
        {aviso.link ? (
          <Button variant="outline" asChild>
            <a href={aviso.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Abrir link
            </a>
          </Button>
        ) : null}
        <DialogFooter>
          {precisaConfirmar ? (
            <Button
              className="w-full"
              disabled={marcar.isPending}
              onClick={() =>
                marcar.mutate(
                  { avisoId: aviso.id, acao: "CONFIRMAR" },
                  { onSuccess: onFechar },
                )
              }
            >
              Li e entendi
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={onFechar}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
