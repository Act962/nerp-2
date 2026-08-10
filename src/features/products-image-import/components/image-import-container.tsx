"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  ImageIcon,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useMatchBySku, useSetProductImages } from "../hooks/use-image-import";
import { skuFromFilename } from "../lib/sku-from-filename";

// Tipos de imagem aceitos localmente (mesma whitelist da rota /api/s3/upload).
const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
]);

type ItemStatus =
  | "MATCHED_NEW" // casou e produto está sem imagem — sobe direto
  | "MATCHED_EXISTS" // casou e produto já tem imagem — sobe como adicional
  | "UNMATCHED" // sem produto pra esse SKU
  | "UNSUPPORTED"; // arquivo não é imagem suportada

interface ItemRow {
  key: string; // id local (path completo)
  file: File;
  sku: string;
  previewUrl: string; // objectURL pra preview
  status: ItemStatus;
  productId?: string;
  productName?: string;
  productSku?: string | null;
  hasThumbnail?: boolean;
  imagesCount?: number;
  // Estado do upload:
  uploadStatus?: "idle" | "uploading" | "done" | "error";
  uploadError?: string;
}

export function ImageImportContainer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const matchMutation = useMatchBySku();
  const setImagesMutation = useSetProductImages();

  // Libera as URLs de objeto quando o componente desmonta ou a lista troca.
  useEffect(() => {
    return () => {
      for (const item of items) {
        if (item.previewUrl.startsWith("blob:"))
          URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [items]);

  const summary = useMemo(() => {
    const matched = items.filter(
      (item) =>
        item.status === "MATCHED_NEW" || item.status === "MATCHED_EXISTS",
    ).length;
    const unmatched = items.filter(
      (item) => item.status === "UNMATCHED",
    ).length;
    const unsupported = items.filter(
      (item) => item.status === "UNSUPPORTED",
    ).length;
    const done = items.filter((item) => item.uploadStatus === "done").length;
    const errors = items.filter((item) => item.uploadStatus === "error").length;
    return {
      total: items.length,
      matched,
      unmatched,
      unsupported,
      done,
      errors,
    };
  }, [items]);

  async function handleFilesChosen(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = [...fileList];

    // Fase 1 — classifica e prepara previews. Só arquivos de imagem entram
    // na tentativa de match; o resto vira UNSUPPORTED só pra o usuário ver.
    const rows: ItemRow[] = files.map((file) => {
      const isImg = IMAGE_MIME.has(file.type);
      return {
        key:
          // webkitRelativePath vem preenchido quando o input tem webkitdirectory
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name,
        file,
        sku: skuFromFilename(file.name),
        previewUrl: isImg ? URL.createObjectURL(file) : "",
        status: isImg ? "UNMATCHED" : "UNSUPPORTED",
        uploadStatus: "idle",
      };
    });

    // Fase 2 — pede ao server pra casar os SKUs (só das imagens).
    const imageRows = rows.filter((row) => row.status !== "UNSUPPORTED");
    if (imageRows.length === 0) {
      setItems(rows);
      toast.error("Nenhum arquivo de imagem válido na pasta selecionada");
      return;
    }

    setIsProcessing(true);
    try {
      const { matches } = await matchMutation.mutateAsync({
        skus: imageRows.map((row) => row.sku),
      });
      const byIndex = new Map<number, (typeof matches)[number]>();
      matches.forEach((match, index) => byIndex.set(index, match));

      let imgIndex = 0;
      const enriched = rows.map((row) => {
        if (row.status === "UNSUPPORTED") return row;
        const match = byIndex.get(imgIndex++);
        if (!match?.product) return { ...row, status: "UNMATCHED" as const };
        return {
          ...row,
          status: (match.product.hasThumbnail
            ? "MATCHED_EXISTS"
            : "MATCHED_NEW") as ItemStatus,
          productId: match.product.id,
          productName: match.product.name,
          productSku: match.product.sku,
          hasThumbnail: match.product.hasThumbnail,
          imagesCount: match.product.imagesCount,
        };
      });
      setItems(enriched);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao consultar produtos",
      );
      setItems(rows);
    } finally {
      setIsProcessing(false);
    }
  }

  async function uploadAndLink(row: ItemRow) {
    if (!row.productId) return;
    // 1) presigned + PUT
    const contentType = row.file.type || "application/octet-stream";
    const res = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: row.file.name,
        contentType,
        size: row.file.size,
        isImage: true,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Falha ao obter URL de upload");
    }
    const { presignedUrl, key } = await res.json();
    const put = await fetch(presignedUrl, {
      method: "PUT",
      body: row.file,
      headers: { "Content-Type": contentType },
    });
    if (!put.ok) throw new Error("Falha ao enviar arquivo");

    // 2) vincula a key ao produto. Append + define thumbnail SE ainda não tem.
    await setImagesMutation.mutateAsync({
      productId: row.productId,
      keys: [key],
      mode: "append",
      setThumbnailIfEmpty: true,
    });
  }

  async function handleUploadAll() {
    const eligible = items.filter(
      (item) =>
        (item.status === "MATCHED_NEW" || item.status === "MATCHED_EXISTS") &&
        item.uploadStatus !== "done",
    );
    if (eligible.length === 0) {
      toast.error("Nada pra enviar");
      return;
    }
    // Concorrência limitada — evita esgotar rede / limite do R2.
    const CONCURRENCY = 4;
    let cursor = 0;
    async function worker() {
      while (cursor < eligible.length) {
        const idx = cursor++;
        const row = eligible[idx];
        setItems((prev) =>
          prev.map((r) =>
            r.key === row.key ? { ...r, uploadStatus: "uploading" } : r,
          ),
        );
        try {
          await uploadAndLink(row);
          setItems((prev) =>
            prev.map((r) =>
              r.key === row.key ? { ...r, uploadStatus: "done" } : r,
            ),
          );
        } catch (error) {
          setItems((prev) =>
            prev.map((r) =>
              r.key === row.key
                ? {
                    ...r,
                    uploadStatus: "error",
                    uploadError:
                      error instanceof Error ? error.message : "Erro",
                  }
                : r,
            ),
          );
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, eligible.length) }, worker),
    );
    toast.success("Upload concluído");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="size-5" />
              Importar imagens em massa
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione uma pasta com fotos nomeadas pelo SKU do produto (ex.:{" "}
              <code>NB-4060.jpg</code>). O sistema faz o match com o catálogo,
              mostra o que casou e você confirma o envio.
            </p>
          </div>
          <div className="flex gap-2">
            {/* <input> escondido — o Button abaixo aciona pelo ref. */}
            <input
              ref={inputRef}
              type="file"
              multiple
              // @ts-expect-error webkitdirectory é atributo não-standard mas
              // funciona em Chrome/Edge/Safari — o gancho central da feature.
              webkitdirectory=""
              // Arquivo isolado também é aceito (sem pasta): navegadores fora
              // do Chrome ignoram `webkitdirectory`.
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFilesChosen(e.target.files)}
            />
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FolderOpen className="mr-2 size-4" />
              )}
              Selecionar pasta
            </Button>
            <Button
              onClick={handleUploadAll}
              disabled={
                summary.matched === 0 ||
                setImagesMutation.isPending ||
                isProcessing
              }
            >
              <Upload className="mr-2 size-4" />
              Enviar {summary.matched > 0 && `(${summary.matched})`}
            </Button>
          </div>
        </CardHeader>

        {items.length > 0 && (
          <CardContent className="flex flex-col gap-3">
            {/* Resumo */}
            <div className="flex flex-wrap gap-2 text-sm">
              <SummaryPill
                icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                label={`${summary.matched} pronto${summary.matched === 1 ? "" : "s"}`}
              />
              <SummaryPill
                icon={<XCircle className="size-4 text-destructive" />}
                label={`${summary.unmatched} sem produto`}
              />
              {summary.unsupported > 0 && (
                <SummaryPill
                  icon={<AlertTriangle className="size-4 text-amber-600" />}
                  label={`${summary.unsupported} formato inválido`}
                />
              )}
              {summary.done > 0 && (
                <SummaryPill
                  icon={<Upload className="size-4 text-emerald-600" />}
                  label={`${summary.done} enviada${summary.done === 1 ? "" : "s"}`}
                />
              )}
              {summary.errors > 0 && (
                <SummaryPill
                  icon={<XCircle className="size-4 text-destructive" />}
                  label={`${summary.errors} com erro`}
                />
              )}
            </div>

            <Separator />

            {/* Lista */}
            <ul className="flex flex-col divide-y">
              {items.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  <div className="relative size-12 shrink-0 overflow-hidden rounded border bg-muted">
                    {row.previewUrl ? (
                      // biome-ignore lint/performance/noImgElement: preview local
                      <img
                        src={row.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <AlertTriangle className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {row.file.name}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        SKU: {row.sku}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <StatusText row={row} />
                    </div>
                  </div>

                  <div className="shrink-0">
                    <UploadStatusBadge row={row} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Amostra pequena: preview do que já subiu (thumbnail atualizado). */}
            {summary.done > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {items
                  .filter((r) => r.uploadStatus === "done")
                  .slice(0, 12)
                  .map((row) => (
                    <div
                      key={`done-${row.key}`}
                      className="relative size-16 overflow-hidden rounded border"
                      title={row.productName}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.previewUrl}
                        alt={row.productName ?? ""}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Amostra "como fica o produto no server" para 1 dos itens já enviados —
          confirma que a imagem foi persistida (usa constructUrl). */}
      {items.some((r) => r.uploadStatus === "done" && r.productId) && (
        <p className="text-xs text-muted-foreground">
          Dica: recarregue <code>/produtos</code> pra ver as miniaturas
          atualizadas. Cada imagem foi vinculada ao produto correspondente e
          fica disponível também no catálogo online.
        </p>
      )}
    </div>
  );
}

function SummaryPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5">
      {icon}
      {label}
    </span>
  );
}

function StatusText({ row }: { row: ItemRow }) {
  if (row.status === "UNSUPPORTED") return <span>Formato não suportado</span>;
  if (row.status === "UNMATCHED")
    return (
      <span className="text-muted-foreground">
        Nenhum produto com SKU <strong>{row.sku}</strong>
      </span>
    );
  if (row.status === "MATCHED_NEW")
    return (
      <span>
        <span className="font-medium text-foreground">{row.productName}</span>{" "}
        <Badge variant="secondary" className="ml-1">
          Sem imagem → 1ª foto vira miniatura
        </Badge>
      </span>
    );
  return (
    <span>
      <span className="font-medium text-foreground">{row.productName}</span>{" "}
      <Badge variant="outline" className="ml-1">
        Já tem {row.imagesCount} — será adicionada
      </Badge>
    </span>
  );
}

function UploadStatusBadge({ row }: { row: ItemRow }) {
  if (row.uploadStatus === "done")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        Enviada
      </span>
    );
  if (row.uploadStatus === "uploading")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Enviando…
      </span>
    );
  if (row.uploadStatus === "error")
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-destructive"
        title={row.uploadError}
      >
        <XCircle className="size-3.5" />
        Erro
      </span>
    );
  return null;
}
