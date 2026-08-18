"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  EyeOff,
  FolderOpen,
  ImageIcon,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMatchBySku, useSetProductImages } from "../hooks/use-image-import";
import { skuFromFilename } from "../lib/sku-from-filename";
import { DriveFolderPicker } from "./drive-folder-picker";
import { OracleImageSearch } from "./oracle-image-search";

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
  key: string; // id local (path completo OU driveFileId)
  // Uma linha OU tem File (origem local) OU tem driveFileId (origem Drive).
  file?: File;
  driveFileId?: string;
  fileName: string;
  sku: string;
  previewUrl: string; // objectURL local ou vazio (Drive: preview aparece só após upload)
  status: ItemStatus;
  productId?: string;
  productName?: string;
  productSku?: string | null;
  hasThumbnail?: boolean;
  imagesCount?: number;
  // Estado do upload:
  uploadStatus?: "idle" | "uploading" | "done" | "error";
  uploadError?: string;
  // "Ocultar" no cliente: some da lista visível e para de contar como
  // elegível pro upload. Nada é apagado no servidor — a foto do produto
  // que já estava vinculada continua vinculada.
  hidden?: boolean;
}

// Fila fica paginada acima disto — abaixo, scroll natural do navegador
// resolve. Escolhido pra 25 itens caberem inteiros na primeira dobra de
// desktop 1080p com o resto do card.
const PAGE_SIZE = 25;

export function ImageImportContainer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  // Chave do item cuja foto está aberta em preview (Dialog). null = fechado.
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // Paginação client-side da fila. Reseta pra 0 quando a fila troca (nova
  // seleção de pasta) ou quando o total encolhe abaixo do começo da página.
  const [page, setPage] = useState(0);
  const hideItem = (key: string) =>
    setItems((prev) =>
      prev.map((r) => (r.key === key ? { ...r, hidden: true } : r)),
    );
  const matchMutation = useMatchBySku();
  const setImagesMutation = useSetProductImages();
  // Drive: estado da conexão + procedures do server.
  const driveConn = useQuery(
    orpc.googleDrive.getConnection.queryOptions({ input: {} }),
  );
  const driveListMutation = useMutation(
    orpc.googleDrive.listChildren.mutationOptions({}),
  );
  const driveCopyMutation = useMutation(
    orpc.googleDrive.copyFileToBucket.mutationOptions({}),
  );

  // Libera as URLs de objeto quando o componente desmonta ou a lista troca.
  useEffect(() => {
    return () => {
      for (const item of items) {
        if (item.previewUrl.startsWith("blob:"))
          URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((row) => !row.hidden),
    [items],
  );
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));

  // Puxa a página pra dentro do range sempre que o total visível encolhe —
  // sem isso, ocultar os últimos itens da página final deixaria o usuário
  // olhando um bloco vazio, com "Página 5" quando só existem 4.
  useEffect(() => {
    if (page > 0 && page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  const pageItems = visibleItems.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const summary = useMemo(() => {
    // Ocultos saem de todas as contagens: se o usuário mandou esconder,
    // não conta como "pronto pra enviar" nem entra no "sem produto" — some.
    const visible = items.filter((item) => !item.hidden);
    const matched = visible.filter(
      (item) =>
        item.status === "MATCHED_NEW" || item.status === "MATCHED_EXISTS",
    ).length;
    const unmatched = visible.filter(
      (item) => item.status === "UNMATCHED",
    ).length;
    const unsupported = visible.filter(
      (item) => item.status === "UNSUPPORTED",
    ).length;
    const done = visible.filter((item) => item.uploadStatus === "done").length;
    const errors = visible.filter(
      (item) => item.uploadStatus === "error",
    ).length;
    const hidden = items.length - visible.length;
    return {
      total: items.length,
      matched,
      unmatched,
      unsupported,
      done,
      errors,
      hidden,
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
        fileName: file.name,
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
      setPage(0);
      toast.error("Nenhum arquivo de imagem válido na pasta selecionada");
      return;
    }

    setIsProcessing(true);
    setPage(0);
    try {
      const { matches } = await matchMutation.mutateAsync({
        skus: imageRows.map((row) => row.sku),
      });
      const byIndex = new Map<number, (typeof matches)[number]>();
      matches.forEach((match, index) => {
        byIndex.set(index, match);
      });

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

  // Ao escolher uma pasta no Drive, lista as imagens dela e faz o match dos
  // SKUs — mesmo pipeline do fluxo local, mas sem `File` no client.
  async function handleDriveFolderChosen(folder: { id: string; name: string }) {
    setDrivePickerOpen(false);
    setIsProcessing(true);
    try {
      // Pagina se necessário — assumimos que uma pasta pode ter ≥200 imagens.
      const allFiles: {
        id: string;
        name: string;
        mimeType: string;
        isImage: boolean;
      }[] = [];
      let pageToken: string | null = null;
      do {
        const page = await driveListMutation.mutateAsync({
          parentId: folder.id,
          onlyImages: true,
          pageToken,
        });
        for (const file of page.files) {
          if (file.isImage) allFiles.push(file);
        }
        pageToken = page.nextPageToken;
      } while (pageToken);

      if (allFiles.length === 0) {
        toast.error("Pasta do Drive sem imagens");
        setIsProcessing(false);
        return;
      }
      setPage(0);

      // Build rows sem previewUrl (preview local só existe pra Files locais).
      const rows: ItemRow[] = allFiles.map((file) => ({
        key: `drive:${file.id}`,
        driveFileId: file.id,
        fileName: file.name,
        sku: skuFromFilename(file.name),
        previewUrl: "",
        status: "UNMATCHED",
        uploadStatus: "idle",
      }));

      // Fase 2 igual ao local — match por SKU.
      const { matches } = await matchMutation.mutateAsync({
        skus: rows.map((row) => row.sku),
      });
      const enriched = rows.map((row, index) => {
        const match = matches[index];
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
        error instanceof Error
          ? error.message
          : "Falha ao listar pasta do Drive",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function uploadAndLink(row: ItemRow) {
    if (!row.productId) return;

    let key: string;
    if (row.driveFileId) {
      // Origem Drive: o server copia direto (sem passar pelo browser). Não
      // precisa presigned porque o download já é privilegiado pelo token.
      const result = await driveCopyMutation.mutateAsync({
        fileId: row.driveFileId,
      });
      key = result.key;
    } else if (row.file) {
      // Origem local: presigned + PUT como no fluxo original.
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
      const { presignedUrl, key: bucketKey } = await res.json();
      const put = await fetch(presignedUrl, {
        method: "PUT",
        body: row.file,
        headers: { "Content-Type": contentType },
      });
      if (!put.ok) throw new Error("Falha ao enviar arquivo");
      key = bucketKey;
    } else {
      throw new Error("Item sem origem (nem arquivo nem Drive)");
    }

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
        !item.hidden &&
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
            {driveConn.data?.connected ? (
              <Button
                variant="outline"
                onClick={() => setDrivePickerOpen(true)}
                disabled={isProcessing}
                title={`Conectado como ${driveConn.data.email ?? ""}`}
              >
                <Cloud className="mr-2 size-4" />
                Escolher no Drive
              </Button>
            ) : (
              <Button variant="outline" asChild disabled={isProcessing}>
                <a href="/api/integrations/google/authorize">
                  <Cloud className="mr-2 size-4" />
                  Conectar Google Drive
                </a>
              </Button>
            )}
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
              {summary.hidden > 0 && (
                <SummaryPill
                  icon={<EyeOff className="size-4 text-muted-foreground" />}
                  label={`${summary.hidden} oculta${summary.hidden === 1 ? "" : "s"}`}
                />
              )}
            </div>

            <Separator />

            {/* Lista — ocultos saem da renderização, não da fila (o contador
                em `summary.hidden` mostra pro usuário quantos ele escondeu).
                Paginada em `PAGE_SIZE` para que uma seleção de pasta com
                milhares de fotos não trave a página nem force scroll infinito. */}
            <ul className="flex flex-col divide-y">
              {pageItems.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => row.previewUrl && setPreviewKey(row.key)}
                    disabled={!row.previewUrl}
                    title={row.previewUrl ? "Abrir prévia" : undefined}
                    className="relative size-12 shrink-0 overflow-hidden rounded border bg-muted transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"
                  >
                    {row.previewUrl ? (
                      // biome-ignore lint/performance/noImgElement: preview local
                      <img
                        src={row.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        {row.driveFileId ? (
                          <Cloud className="size-4 text-muted-foreground" />
                        ) : (
                          <AlertTriangle className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {row.fileName}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        SKU: {row.sku}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <StatusText row={row} />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <UploadStatusBadge row={row} />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Ocultar da lista (não apaga nada)"
                      onClick={() => hideItem(row.key)}
                      className="size-7 text-muted-foreground"
                    >
                      <EyeOff className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Paginação — só aparece quando faz diferença. Sem "Página 1
                de 1" em fila curta, sem pedir seleção quando cabe tudo. */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>
                  Página {page + 1} de {pageCount} • {visibleItems.length}{" "}
                  arquivo{visibleItems.length === 1 ? "" : "s"}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() =>
                      setPage((current) => Math.max(0, current - 1))
                    }
                  >
                    <ChevronLeft className="mr-1 size-3.5" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= pageCount - 1}
                    onClick={() =>
                      setPage((current) => Math.min(pageCount - 1, current + 1))
                    }
                  >
                    Próxima
                    <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Amostra pequena: preview do que já subiu (thumbnail atualizado). */}
            {summary.done > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {items
                  .filter((r) => !r.hidden && r.uploadStatus === "done")
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

      <ImagePreviewDialog
        item={
          previewKey
            ? (items.find((row) => row.key === previewKey) ?? null)
            : null
        }
        onOpenChange={(open) => {
          if (!open) setPreviewKey(null);
        }}
        onHide={(key) => {
          hideItem(key);
          setPreviewKey(null);
        }}
      />

      {/* Amostra "como fica o produto no server" para 1 dos itens já enviados —
          confirma que a imagem foi persistida (usa constructUrl). */}
      {items.some((r) => r.uploadStatus === "done" && r.productId) && (
        <p className="text-xs text-muted-foreground">
          Dica: recarregue <code>/produtos</code> pra ver as miniaturas
          atualizadas. Cada imagem foi vinculada ao produto correspondente e
          fica disponível também no catálogo online.
        </p>
      )}

      {/* Só aparece para orgs com ERP Oracle configurado — auto-oculta caso
          contrário (ver OracleImageSearch). */}
      <OracleImageSearch />

      <DriveFolderPicker
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        onConfirm={handleDriveFolderChosen}
      />
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

// Dialog de zoom para a prévia da imagem. `object-contain` + limite via
// viewport (max-w / max-h) mantém a foto inteira visível, sem cortar. Um
// botão "Ocultar" no cabeçalho permite tirar da fila sem sair da tela.
function ImagePreviewDialog({
  item,
  onOpenChange,
  onHide,
}: {
  item: ItemRow | null;
  onOpenChange: (open: boolean) => void;
  onHide: (key: string) => void;
}) {
  const open = item !== null && !!item.previewUrl;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        {item && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="truncate">{item.fileName}</DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">SKU: {item.sku}</span>
                {item.productName && (
                  <>
                    <span>·</span>
                    <span className="truncate">{item.productName}</span>
                  </>
                )}
              </div>
            </DialogHeader>
            <div className="flex justify-center overflow-hidden rounded-lg border bg-muted/30">
              {/* biome-ignore lint/performance/noImgElement: preview local (blob URL) */}
              <img
                src={item.previewUrl}
                alt={item.fileName}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onHide(item.key)}
              >
                <EyeOff className="mr-2 size-4" />
                Ocultar da lista
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
