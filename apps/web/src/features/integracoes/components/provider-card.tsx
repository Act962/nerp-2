"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  FileUp,
  ImagePlus,
  Plug,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProviderManifest } from "../catalog/types";
import { ProviderLogo } from "./provider-logo";

export type Instalacao = {
  id: string;
  providerId: string;
  status: "ACTIVE" | "PAUSED" | "ERROR" | "PENDING_AUTH";
  displayName: string | null;
  certificateExpiresAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

const DIAS_DE_AVISO_DO_CERTIFICADO = 30;

export function ProviderCard({
  manifest,
  instalacao,
  logoKey,
  podeGerenciar,
  podeEditarLogo,
  onAbrir,
  onEditarLogo,
}: {
  manifest: ProviderManifest;
  instalacao: Instalacao | null;
  logoKey: string | null;
  podeGerenciar: boolean;
  podeEditarLogo: boolean;
  onAbrir: () => void;
  onEditarLogo: () => void;
}) {
  const emBreve = !manifest.disponivel;
  const soArquivo = manifest.auth.tipo === "ARQUIVO";
  const comErro = instalacao?.status === "ERROR";
  const diasAteVencer = diasAte(instalacao?.certificateExpiresAt);
  const certificadoVencendo =
    diasAteVencer !== null && diasAteVencer <= DIAS_DE_AVISO_DO_CERTIFICADO;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors",
        emBreve ? "opacity-60" : "hover:border-foreground/20",
      )}
    >
      <div className="flex items-start gap-3">
        <ProviderLogo manifest={manifest} logoKey={logoKey} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-sm">{manifest.nome}</span>
            {instalacao && !comErro && (
              <Badge variant="secondary" className="gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Instalado
              </Badge>
            )}
            {comErro && <Badge variant="destructive">Erro</Badge>}
            {emBreve && <Badge variant="outline">Em breve</Badge>}
            {podeEditarLogo && (
              <button
                type="button"
                title="Trocar a logo (global)"
                className="text-muted-foreground hover:text-foreground"
                onClick={onEditarLogo}
              >
                <ImagePlus className="size-3.5" />
              </button>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs">
            {manifest.resumo}
          </p>
        </div>
      </div>

      {instalacao && (
        <p className="text-muted-foreground text-xs">
          {instalacao.lastSyncAt
            ? `Sincronizado ${formatDistanceToNow(new Date(instalacao.lastSyncAt), { locale: ptBR, addSuffix: true })}`
            : "Ainda não sincronizado"}
        </p>
      )}

      {comErro && instalacao?.lastSyncError && (
        <p className="line-clamp-2 text-destructive text-xs">
          {instalacao.lastSyncError}
        </p>
      )}

      {certificadoVencendo && (
        <p className="flex items-start gap-1.5 text-amber-600 text-xs dark:text-amber-500">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {diasAteVencer !== null && diasAteVencer <= 0
            ? "Certificado vencido — emita um novo no portal do provedor."
            : `Certificado vence em ${diasAteVencer} dia${diasAteVencer === 1 ? "" : "s"}.`}
        </p>
      )}

      {/* Pré-requisito aparece ANTES de o usuário abrir o formulário: descobrir
          que precisa falar com o gerente depois de preencher tudo é o pior
          desfecho possível. */}
      {emBreve && manifest.preRequisito && (
        <p className="text-muted-foreground text-xs">{manifest.preRequisito}</p>
      )}

      {!emBreve && (
        <Button
          type="button"
          variant={instalacao ? "outline" : "default"}
          size="sm"
          className="mt-auto gap-1.5 self-start"
          disabled={!podeGerenciar}
          onClick={onAbrir}
        >
          {instalacao ? (
            <>
              <Settings2 className="size-3.5" />
              Gerenciar
            </>
          ) : soArquivo ? (
            <>
              <FileUp className="size-3.5" />
              Enviar extrato
            </>
          ) : (
            <>
              <Plug className="size-3.5" />
              Conectar
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const alvo = new Date(iso).getTime();
  if (Number.isNaN(alvo)) return null;
  return Math.ceil((alvo - Date.now()) / 86_400_000);
}
