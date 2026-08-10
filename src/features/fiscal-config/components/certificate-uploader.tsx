"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileCheck, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

interface CertificateUploaderProps {
  currentFilename?: string | null;
  currentKey?: string | null;
  onUploaded: (payload: { key: string; filename: string }) => void;
}

// Sobe o .pfx via presigned URL (mesma rota /api/s3/upload que já usamos).
// A rota agora aceita application/x-pkcs12; devolve `key` que gravamos no
// banco. Este componente NUNCA lê o conteúdo — o parsing do certificado (data
// de expiração) fica pra Fase B (precisa de openssl no server ou uma lib como
// node-forge).
export function CertificateUploader({
  currentFilename,
  currentKey,
  onUploaded,
}: CertificateUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pfx")) {
      toast.error("Envie um arquivo .pfx (certificado digital A1)");
      return;
    }
    setUploading(true);
    try {
      // O navegador não conhece o MIME de .pfx em muitos SOs — mandamos
      // explicitamente pra a whitelist do server aceitar.
      const contentType = file.type || "application/x-pkcs12";
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType,
          size: file.size,
          isImage: false,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Falha ao obter URL de upload");
      }
      const { presignedUrl, key } = await res.json();
      const put = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!put.ok) throw new Error("Falha ao enviar arquivo");
      onUploaded({ key, filename: file.name });
      toast.success("Certificado enviado");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha no upload do certificado",
      );
    } finally {
      setUploading(false);
    }
  }

  const hasCurrent = !!currentKey;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pfx,application/x-pkcs12,application/pkcs12"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {hasCurrent ? (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
            <span className="truncate">
              {currentFilename ?? "certificado.pfx"}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Upload className="mr-1 size-4" />
            )}
            Trocar
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <FileCheck className="size-5" />
          )}
          {uploading ? "Enviando..." : "Enviar certificado A1 (.pfx)"}
        </button>
      )}
    </div>
  );
}
