"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  FileCheck,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useUploadCertificate } from "../hooks/use-fiscal-config";

/**
 * Envio do certificado A1.
 *
 * O arquivo vai para o servidor junto com a senha, numa procedure só: sem a
 * senha não dá para abrir o .pfx, e sem abrir não dá para conferir validade e
 * CNPJ. O upload direto por presigned URL (que este componente usava) não
 * conseguia validar nada e deixava o certificado no bucket público.
 */

interface CertificateUploaderProps {
  hasCertificate: boolean;
  filename?: string | null;
  expiresAt?: string | null;
  /** Certificado ainda no bucket público antigo — precisa ser reenviado. */
  legacyStorage?: boolean;
  /** Sem CNPJ salvo não há como validar o titular. */
  disabledReason?: string | null;
}

export function CertificateUploader({
  hasCertificate,
  filename,
  expiresAt,
  legacyStorage = false,
  disabledReason,
}: CertificateUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const upload = useUploadCertificate();

  const blocked = !!disabledReason;

  async function send() {
    if (!file || !password) return;
    const contentBase64 = await fileToBase64(file);
    upload.mutate(
      { filename: file.name, contentBase64, password },
      {
        onSuccess: () => {
          setFile(null);
          setPassword("");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pfx,.p12,application/x-pkcs12,application/pkcs12"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (!picked) return;
          if (!/\.(pfx|p12)$/i.test(picked.name)) {
            toast.error("Envie um arquivo .pfx ou .p12 (certificado A1)");
            return;
          }
          setFile(picked);
        }}
      />

      {hasCertificate && !file ? (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <span className="block truncate">
                {filename ?? "certificado.pfx"}
              </span>
              {expiresAt && (
                <span className="text-xs text-muted-foreground">
                  Válido até {new Date(expiresAt).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={blocked}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1 size-4" />
            Trocar
          </Button>
        </div>
      ) : null}

      {!hasCertificate && !file ? (
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => inputRef.current?.click()}
          disabled={blocked}
        >
          <FileCheck className="size-5" />
          Enviar certificado A1 (.pfx)
        </button>
      ) : null}

      {file ? (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{file.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => {
                setFile(null);
                setPassword("");
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pfx-password" className="text-xs">
              Senha do certificado
            </Label>
            <Input
              id="pfx-password"
              type="password"
              autoComplete="off"
              value={password}
              placeholder="Necessária para validar e usar o certificado"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="self-end"
            disabled={!password || upload.isPending}
            onClick={() => void send()}
          >
            {upload.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Upload className="mr-1 size-4" />
            )}
            {upload.isPending ? "Validando..." : "Enviar e validar"}
          </Button>
        </div>
      ) : null}

      {blocked ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}

      {legacyStorage ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          Este certificado foi enviado para o armazenamento antigo, que não era
          privado. Reenvie o arquivo antes de emitir e apague o objeto antigo no
          bucket de imagens.
        </p>
      ) : null}
    </div>
  );
}

/** Converte em base64 sem estourar a pilha (`btoa` + spread quebra em arquivo grande). */
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}
