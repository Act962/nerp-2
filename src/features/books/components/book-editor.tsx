"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  ArrowLeft,
  DownloadIcon,
  ImagePlusIcon,
  SendIcon,
  SparklesIcon,
  TriangleAlert,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useBook, useGenerateBook, useSendBook } from "../hooks/use-books";
import { formatPeriod } from "../lib/book-format";
import { BookPagesList } from "./book-pages/book-pages-list";
import { BookStatusBadge } from "./book-status-badge";
import { ImportPhotosDialog } from "./import-photos-dialog";
import { SaveTemplateDialog } from "./templates/save-template-dialog";

// Os três editores só existem dentro de abas que começam fechadas, e juntos
// arrastam o canvas e os painéis de propriedades. Importados de forma estática
// eles entravam no bundle inicial e atrasavam a abertura do book.
const tabFallback = () => (
  <div className="flex justify-center py-12">
    <Spinner />
  </div>
);

const PageLayoutEditor = dynamic(
  () =>
    import("./book-pages/page-layout-editor").then(
      (mod) => mod.PageLayoutEditor,
    ),
  { loading: tabFallback },
);

const CoverEditor = dynamic(
  () => import("./cover-editor/cover-editor").then((mod) => mod.CoverEditor),
  { loading: tabFallback },
);

const TemplateLibrary = dynamic(
  () =>
    import("./templates/template-library").then((mod) => mod.TemplateLibrary),
  { loading: tabFallback },
);

interface BookEditorProps {
  bookId: string;
}

export function BookEditor({ bookId }: BookEditorProps) {
  const { book, isLoading } = useBook(bookId);
  const generateBook = useGenerateBook();
  const sendBook = useSendBook();
  const [openImport, setOpenImport] = useState(false);
  const [openSaveTemplate, setOpenSaveTemplate] = useState(false);
  const [pendingMode, setPendingMode] = useState<"queue" | "sync" | null>(null);

  if (isLoading || !book) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const isGenerating = book.status === "GENERATING";
  const isFailed = book.status === "FAILED";
  const hasItems = book.items.length > 0;

  const runGenerate = (sync: boolean) => {
    setPendingMode(sync ? "sync" : "queue");
    generateBook.mutate(
      { id: bookId, sync: sync || undefined },
      { onSettled: () => setPendingMode(null) },
    );
  };

  const existingPhotoIds = book.items.map((item) => item.pdvPhotoId);
  // Logos resolvidos na renderização: a capa padrão referencia a origem
  // ("organization"/"supplier"), não uma key fixa, então troca de logo se
  // reflete sozinha em todos os books.
  const logos = {
    organization: book.distributorLogo ?? null,
    supplier: book.supplierLogo,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/books" aria-label="Voltar para books">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{book.name}</h1>
              <BookStatusBadge status={book.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {book.supplierName ? `${book.supplierName} · ` : "Book geral · "}
              {formatPeriod(book.periodMonth, book.periodYear)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {book.status === "READY" && book.pdfKey && (
            <Button asChild variant="outline">
              <a
                href={constructUrl(book.pdfKey)}
                target="_blank"
                rel="noreferrer"
              >
                <DownloadIcon className="size-4" />
                Baixar PDF
                {book.pdfDesatualizado && (
                  <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                    desatualizado
                  </span>
                )}
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpenImport(true)}>
            <ImagePlusIcon className="size-4" />
            Importar fotos
          </Button>
          {book.canApprove && (
            <Button
              variant={book.sentAt ? "outline" : "default"}
              onClick={() =>
                sendBook.mutate({
                  id: bookId,
                  undo: !!book.sentAt || undefined,
                })
              }
              disabled={sendBook.isPending}
              title={
                book.sentAt
                  ? `Enviado por ${book.sentByName ?? "—"}`
                  : "Marcar como enviado à indústria/fornecedor"
              }
            >
              <SendIcon className="size-4" />
              {book.sentAt ? "Enviado ✓" : "Enviar à indústria"}
            </Button>
          )}
          {(isGenerating || isFailed) && (
            <Button
              variant="outline"
              onClick={() => runGenerate(true)}
              disabled={generateBook.isPending || !hasItems}
              title="Renderiza o PDF na hora, sem passar pela fila"
            >
              {pendingMode === "sync" ? (
                <Spinner />
              ) : (
                <Zap className="size-4" />
              )}
              Gerar agora
            </Button>
          )}
          <Button
            onClick={() => runGenerate(false)}
            disabled={isGenerating || generateBook.isPending || !hasItems}
          >
            {pendingMode === "queue" ? (
              <Spinner />
            ) : (
              <SparklesIcon className="size-4" />
            )}
            {isGenerating
              ? "Gerando…"
              : isFailed
                ? "Tentar novamente"
                : "Gerar PDF"}
          </Button>
        </div>
      </div>

      {isFailed && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            A geração do PDF falhou. Clique em <strong>Tentar novamente</strong>{" "}
            ou em <strong>Gerar agora</strong> para renderizar sem a fila.
          </p>
        </div>
      )}

      {book.pdfDesatualizado && !isGenerating && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            O book foi editado depois do último PDF. Clique em{" "}
            <strong>Gerar PDF</strong> para o arquivo refletir o que está na
            tela.
          </p>
        </div>
      )}

      {isGenerating && (
        <p className="text-sm text-muted-foreground">
          Gerando o PDF… Se estiver demorando, use <strong>Gerar agora</strong>{" "}
          para renderizar imediatamente.
        </p>
      )}

      <Tabs defaultValue="photos">
        <TabsList>
          <TabsTrigger value="photos">Páginas</TabsTrigger>
          <TabsTrigger value="cover">Capa e Página Final</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-4">
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="custom">Personalizado</TabsTrigger>
              <TabsTrigger value="templates">Padrões</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-4">
              <BookPagesList
                bookId={bookId}
                periodMonth={book.periodMonth}
                periodYear={book.periodYear}
                items={book.items}
                industryLogo={book.supplierLogo}
                organizationName={book.organizationName}
                supplierId={book.supplierId}
                supplierName={book.supplierName}
                bookPageLayout={book.pageLayout}
                bookPageBackground={book.pageBackground}
                logos={logos}
              />
            </TabsContent>

            <TabsContent value="custom" className="mt-4">
              <PageLayoutEditor
                bookId={bookId}
                supplierId={book.supplierId}
                supplierName={book.supplierName}
                organizationName={book.organizationName}
                periodMonth={book.periodMonth}
                periodYear={book.periodYear}
                pageLayout={book.pageLayout}
                pageBackground={book.pageBackground}
                items={book.items}
                onRequestSaveTemplate={() => setOpenSaveTemplate(true)}
                logos={logos}
              />
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <TemplateLibrary
                bookId={bookId}
                supplierId={book.supplierId}
                supplierName={book.supplierName}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="cover" className="mt-4">
          <CoverEditor
            bookId={bookId}
            bookName={book.name}
            supplierId={book.supplierId}
            supplierName={book.supplierName}
            organizationName={book.organizationName}
            periodMonth={book.periodMonth}
            periodYear={book.periodYear}
            logos={logos}
            coverLayout={book.coverLayout}
            closingLayout={book.closingLayout}
            coverBackground={book.coverBackground}
            closingBackground={book.closingBackground}
            onRequestSaveTemplate={() => setOpenSaveTemplate(true)}
          />
        </TabsContent>
      </Tabs>

      <ImportPhotosDialog
        open={openImport}
        onOpenChange={setOpenImport}
        bookId={bookId}
        defaultSupplierId={book.supplierId}
        existingPhotoIds={existingPhotoIds}
      />

      <SaveTemplateDialog
        open={openSaveTemplate}
        onOpenChange={setOpenSaveTemplate}
        bookId={bookId}
        supplierId={book.supplierId}
        supplierName={book.supplierName}
      />
    </div>
  );
}
