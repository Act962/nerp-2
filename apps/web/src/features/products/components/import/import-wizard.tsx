"use client";

import { useCallback, useMemo, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRODUCT_IMPORT_FIELDS,
  type ImportMapping,
} from "@/features/products/import-fields";
import {
  useCreateImport,
  useImportStatus,
} from "@/features/products/hooks/use-product-import";

const NONE = "__none__";
const MAX_SIZE = 1024 * 1024 * 10; // 10MB
const PREVIEW_ROWS = 8;

type Step = "upload" | "map" | "progress";

interface ParsedFile {
  columns: string[];
  rows: Record<string, string>[];
}

/** Lê o arquivo no cliente apenas para preview + mapeamento (não envia ainda). */
async function parseFilePreview(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { columns, rows };
}

/** Pré-seleciona colunas cujo nome bate com o label/chave do campo. */
function autoMap(columns: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const field of PRODUCT_IMPORT_FIELDS) {
    const match = columns.find(
      (c) => norm(c) === norm(field.key) || norm(c) === norm(field.label),
    );
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [importId, setImportId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const createImport = useCreateImport();
  const { data: status } = useImportStatus(importId);

  const onDrop = useCallback(async (accepted: File[]) => {
    const selected = accepted[0];
    if (!selected) return;
    try {
      const result = await parseFilePreview(selected);
      if (result.columns.length === 0) {
        toast.error("Não foi possível ler colunas do arquivo");
        return;
      }
      setFile(selected);
      setParsed(result);
      setMapping(autoMap(result.columns));
      setStep("map");
    } catch {
      toast.error("Falha ao ler o arquivo. Verifique o formato (CSV/XLSX).");
    }
  }, []);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    const tooLarge = rejections.some((r) =>
      r.errors.some((e) => e.code === "file-too-large"),
    );
    toast.error(
      tooLarge
        ? "Arquivo muito grande (máximo de 10MB)."
        : "Arquivo inválido. Use CSV ou XLSX.",
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    multiple: false,
    maxFiles: 1,
    maxSize: MAX_SIZE,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv", ".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
  });

  const missingRequired = useMemo(
    () =>
      PRODUCT_IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]).map(
        (f) => f.label,
      ),
    [mapping],
  );

  async function handleImport() {
    if (!file) return;
    if (missingRequired.length > 0) {
      toast.error(
        `Mapeie os campos obrigatórios: ${missingRequired.join(", ")}`,
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload do arquivo bruto para o S3 (mesmo fluxo do Uploader).
      const presignedResponse = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          isImage: false,
        }),
      });
      if (!presignedResponse.ok)
        throw new Error("Falha ao gerar URL de upload");
      const { presignedUrl, key } = await presignedResponse.json();

      const putResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putResponse.ok) throw new Error("Falha ao enviar o arquivo");

      // 2. Cria a importação + dispara o processamento em background.
      const result = await createImport.mutateAsync({
        fileKey: key,
        fileName: file.name,
        mapping,
      });

      setImportId(result.importId);
      setStep("progress");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao iniciar importação",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setParsed(null);
    setMapping({});
    setImportId(null);
  }

  // ---- Passo 1: upload ----
  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selecione a planilha</CardTitle>
          <CardDescription>
            Aceita arquivos CSV ou XLSX. A primeira linha deve conter os nomes
            das colunas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
              isDragActive
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary",
            )}
          >
            <input {...getInputProps()} />
            <UploadCloud className="size-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">
                Arraste o arquivo aqui ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground">
                CSV ou XLSX, até 10MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Passo 2: mapeamento ----
  if (step === "map" && parsed) {
    const previewRows = parsed.rows.slice(0, PREVIEW_ROWS);
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" />
              {file?.name}
            </CardTitle>
            <CardDescription>
              {parsed.rows.length} linha(s) detectada(s). Relacione cada campo
              do produto a uma coluna do arquivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PRODUCT_IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <span className="text-sm font-medium flex items-center gap-1">
                    {field.label}
                    {field.required && (
                      <span className="text-destructive">*</span>
                    )}
                  </span>
                  <Select
                    value={mapping[field.key] ?? NONE}
                    onValueChange={(value) =>
                      setMapping((prev) => {
                        const next = { ...prev };
                        if (value === NONE) delete next[field.key];
                        else next[field.key] = value;
                        return next;
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="— não importar —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— não importar —</SelectItem>
                      {parsed.columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.hint && (
                    <p className="text-xs text-muted-foreground">
                      {field.hint}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Prévia ({previewRows.length} de {parsed.rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {parsed.columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {parsed.columns.map((col) => (
                      <TableCell key={col} className="max-w-[200px] truncate">
                        {row[col]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={reset} disabled={submitting}>
            Trocar arquivo
          </Button>
          <Button onClick={handleImport} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Importar {parsed.rows.length} produto(s)
          </Button>
        </div>
      </div>
    );
  }

  // ---- Passo 3: progresso ----
  const total = status?.totalRows ?? 0;
  const processed = status?.processedRows ?? 0;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isDone = status?.status === "COMPLETED" || status?.status === "FAILED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status?.status === "COMPLETED" ? (
            <CheckCircle2 className="size-5 text-green-600" />
          ) : status?.status === "FAILED" ? (
            <XCircle className="size-5 text-destructive" />
          ) : (
            <Loader2 className="size-5 animate-spin" />
          )}
          {status?.status === "COMPLETED"
            ? "Importação concluída"
            : status?.status === "FAILED"
              ? "Importação falhou"
              : "Importando produtos…"}
        </CardTitle>
        <CardDescription>{file?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {processed} de {total} linha(s) processada(s)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Criados: {status?.createdRows ?? 0}</Badge>
          <Badge variant={status?.failedRows ? "destructive" : "secondary"}>
            Erros: {status?.failedRows ?? 0}
          </Badge>
        </div>

        {status?.errors && status.errors.length > 0 && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Linha</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.errors.map((err, i) => (
                  <TableRow key={i}>
                    <TableCell>{err.row}</TableCell>
                    <TableCell>{err.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {isDone && (
          <div className="flex justify-end">
            <Button onClick={reset}>Nova importação</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
