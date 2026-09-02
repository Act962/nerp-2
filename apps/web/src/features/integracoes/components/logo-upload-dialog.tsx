"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { uploadToR2 } from "@/lib/upload-to-r2";
import type { ProviderManifest } from "../catalog/types";
import { useDefinirLogoProvedor } from "../hooks/use-integracoes";
import { ProviderLogo } from "./provider-logo";

/**
 * Logo do provedor — GLOBAL, só a administração do sistema edita.
 *
 * SVG não entra: `/api/s3/upload` bloqueia `image/svg+xml` de propósito (é um
 * documento que pode carregar script). PNG com fundo transparente é o formato
 * certo para os 44px do card.
 */
export function LogoUploadDialog({
  manifest,
  logoKey,
  open,
  onOpenChange,
}: {
  manifest: ProviderManifest;
  logoKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const definir = useDefinirLogoProvedor();
  const [enviando, setEnviando] = useState(false);
  const ocupado = enviando || definir.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Logo de {manifest.nome}</DialogTitle>
          <DialogDescription>
            Vale para todas as organizações. PNG ou WebP com fundo transparente;
            SVG não é aceito no envio.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <ProviderLogo manifest={manifest} logoKey={logoKey} />
          <Input
            type="file"
            accept=".png,.webp,.jpg,.jpeg"
            disabled={ocupado}
            className="file:mr-2 file:text-muted-foreground file:text-xs"
            onChange={async (event) => {
              const arquivo = event.target.files?.[0];
              if (!arquivo) return;
              setEnviando(true);
              try {
                const chave = await uploadToR2(arquivo);
                await definir.mutateAsync({
                  providerId: manifest.id,
                  logoKey: chave,
                });
                onOpenChange(false);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Falha no envio.",
                );
              } finally {
                setEnviando(false);
              }
            }}
          />
        </div>

        {logoKey && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-destructive hover:text-destructive"
            disabled={ocupado}
            onClick={async () => {
              await definir.mutateAsync({
                providerId: manifest.id,
                logoKey: null,
              });
              onOpenChange(false);
            }}
          >
            Remover logo
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
