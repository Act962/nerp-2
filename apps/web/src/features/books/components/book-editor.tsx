"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  ArrowLeft,
  DownloadIcon,
  SendIcon,
  SparklesIcon,
  TriangleAlert,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useBook, useGenerateBook, useSendBook } from "../hooks/use-books";
import { formatPeriod } from "../lib/book-format";
import { buildSampleValues } from "../lib/book-variables";
import { AddExtraPageButton } from "./book-pages/add-extra-page-button";
import { BookCoverCard } from "./book-pages/book-cover-card";
import { BookPagesList } from "./book-pages/book-pages-list";
import { BookPagesListV2 } from "./book-pages/book-pages-list-v2";
import { BookStatusBadge } from "./book-status-badge";

interface BookEditorProps {
  bookId: string;
}

// Editor do book em SCROLL ÚNICO: capa → páginas de fotos (das lojas) →
// página final. Sem tabs — a criação/edição fina de padrões (capa, página
// extra, layout de página de fotos) mora só em /padroes; aqui a coordenadora
// vê o book todo e ajusta pontualmente (trocar/excluir foto, excluir página,
// editar layout da página via dialog).
export function BookEditor({ bookId }: BookEditorProps) {
  const { book, isLoading } = useBook(bookId);
  const generateBook = useGenerateBook();
  const sendBook = useSendBook();
  const [pendingMode, setPendingMode] = useState<"queue" | "sync" | null>(null);

  const variableValues = useMemo(() => {
    if (!book) return buildSampleValues();
    return {
      ...buildSampleValues(),
      nomeBook: book.name,
      periodo: formatPeriod(book.periodMonth, book.periodYear),
      industria: book.supplierName ?? null,
      empresaPdv: book.organizationName,
    };
  }, [book]);

  if (isLoading || !book) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const isGenerating = book.status === "GENERATING";
  const isFailed = book.status === "FAILED";
  const hasItems = book.items.length > 0 || (book.pages?.length ?? 0) > 0;

  const runGenerate = (sync: boolean) => {
    setPendingMode(sync ? "sync" : "queue");
    generateBook.mutate(
      { id: bookId, sync: sync || undefined },
      { onSettled: () => setPendingMode(null) },
    );
  };

  const logos = {
    organization: book.distributorLogo ?? null,
    supplier: book.supplierLogo,
  };

  // Total de páginas do book pro rótulo "Página X/N": capa + páginas de
  // conteúdo (BookPages + itens legados) + página final.
  const contentPages = (book.pages?.length ?? 0) + book.items.length;
  const totalPages = 1 + contentPages + 1;

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

      <div className="space-y-6">
        <BookCoverCard
          bookId={bookId}
          bookName={book.name}
          supplierId={book.supplierId}
          supplierName={book.supplierName}
          organizationName={book.organizationName}
          periodMonth={book.periodMonth}
          periodYear={book.periodYear}
          coverLayout={book.coverLayout}
          closingLayout={book.closingLayout}
          coverBackground={book.coverBackground}
          closingBackground={book.closingBackground}
          logos={logos}
          variableValues={variableValues}
          kind="cover"
          position={1}
          total={totalPages}
        />

        {(book.pages?.length ?? 0) > 0 && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Use as setas ↑/↓ em cada página para reordená-las.
              </p>
              <AddExtraPageButton
                bookId={bookId}
                supplierId={book.supplierId}
                pages={(book.pages ?? []).map((page, index) => ({
                  id: page.id,
                  label: `Página ${index + 1} — ${
                    page.isExtra ? "Página extra" : (page.storeName ?? "Loja")
                  }`,
                }))}
              />
            </div>
            <BookPagesListV2
              bookId={bookId}
              supplierId={book.supplierId}
              pages={book.pages ?? []}
              logos={logos}
              variableValues={variableValues}
            />
          </>
        )}

        {book.items.length > 0 && (
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
        )}

        {book.items.length === 0 && (book.pages?.length ?? 0) === 0 && (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Nenhuma página de conteúdo ainda. Volte para <strong>Books</strong>{" "}
            e use <strong>Gerar automático</strong> para criar 1 página por
            supermercado a partir das fotos aprovadas.
          </div>
        )}

        <BookCoverCard
          bookId={bookId}
          bookName={book.name}
          supplierId={book.supplierId}
          supplierName={book.supplierName}
          organizationName={book.organizationName}
          periodMonth={book.periodMonth}
          periodYear={book.periodYear}
          coverLayout={book.coverLayout}
          closingLayout={book.closingLayout}
          coverBackground={book.coverBackground}
          closingBackground={book.closingBackground}
          logos={logos}
          variableValues={variableValues}
          kind="closing"
          position={totalPages}
          total={totalPages}
        />
      </div>
    </div>
  );
}
