"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
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
import { useEffect, useMemo, useState } from "react";
import {
  useBook,
  useGenerateBook,
  useSendBook,
  useSetBookPhotoNumbers,
} from "../hooks/use-books";
import { formatPeriod } from "../lib/book-format";
import { buildSampleValues } from "../lib/book-variables";
import { AddExtraPageButton } from "./book-pages/add-extra-page-button";
import { BookBottomBar, type BookView } from "./book-pages/book-bottom-bar";
import { BookCoverCard } from "./book-pages/book-cover-card";
import { BookPagesGrid } from "./book-pages/book-pages-grid";
import { BookPagesList } from "./book-pages/book-pages-list";
import { BookPagesListV2 } from "./book-pages/book-pages-list-v2";
import { BookSlidesEditor } from "./book-pages/book-slides-editor";
import { BookStatusBadge } from "./book-status-badge";

interface BookEditorProps {
  bookId: string;
}

// Rola até a página `bookpg-N`. `scrollIntoView` acha sozinho o container que
// rola (o layout usa <main overflow-y-auto>) — como o zoom é por largura (sem
// CSS zoom), as coordenadas ficam corretas.
function scrollToBookPage(pageNumber: number) {
  document
    .getElementById(`bookpg-${pageNumber}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const setPhotoNumbers = useSetBookPhotoNumbers();
  const [pendingMode, setPendingMode] = useState<"queue" | "sync" | null>(null);
  const [view, setView] = useState<BookView>("list");
  // Zoom do conteúdo (%) — como no Canva. Feito pela LARGURA do container: o
  // preview da página é posicionado em `cqw` (container query), então mudar a
  // largura escala tudo junto, INCLUSIVE as fotos. CSS `zoom` quebraria o cqw.
  const [zoom, setZoom] = useState(100);
  // Página alvo do "Ir para página" quando ainda estamos na grade: troca pra
  // lista e rola depois que ela renderiza.
  const [pendingScroll, setPendingScroll] = useState<number | null>(null);

  const goToPage = (pageNumber: number) => {
    if (view !== "list") {
      setView("list");
      setPendingScroll(pageNumber);
    } else {
      scrollToBookPage(pageNumber);
    }
  };
  useEffect(() => {
    if (view !== "list" || pendingScroll == null) return;
    // Espera a lista renderizar as âncoras antes de rolar.
    const raf = requestAnimationFrame(() => {
      scrollToBookPage(pendingScroll);
      setPendingScroll(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [view, pendingScroll]);

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
  const v2Count = book.pages?.length ?? 0;
  const contentPages = v2Count + book.items.length;
  const totalPages = 1 + contentPages + 1;
  // Numeração global (1-based) das páginas: capa=1, páginas V2 a partir de 2,
  // itens legados logo depois, página final = totalPages.
  const legacyStart = 2 + v2Count;

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
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Switch
              id="numerar-fotos"
              checked={book.showPhotoNumbers}
              onCheckedChange={(checked) =>
                setPhotoNumbers.mutate({
                  id: bookId,
                  showPhotoNumbers: checked,
                })
              }
              disabled={setPhotoNumbers.isPending}
            />
            <Label
              htmlFor="numerar-fotos"
              className="cursor-pointer text-sm font-normal"
              title='Tarja "FOTO N" dentro de cada foto. Desligar vale para o book inteiro; não afeta os textos do layout que usam a variável {{numeroFoto}}.'
            >
              Numerar as fotos
            </Label>
          </div>
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

      {/* O zoom é da leitura (Lista/Grade). Nos slides o canvas tem o próprio
          enquadramento, e encolher a página só dificultaria a edição. */}
      <div
        className="mx-auto"
        style={view === "slides" ? undefined : { width: `${zoom}%` }}
      >
        {view === "slides" ? (
          <BookSlidesEditor
            pages={book.pages ?? []}
            pageLayout={book.pageLayout}
            pageBackground={book.pageBackground}
            logos={logos}
            variableValues={variableValues}
            pageNumberStart={2}
          />
        ) : view === "grid" ? (
          <BookPagesGrid
            supplierId={book.supplierId}
            coverLayout={book.coverLayout}
            closingLayout={book.closingLayout}
            coverBackground={book.coverBackground}
            closingBackground={book.closingBackground}
            pageLayout={book.pageLayout}
            pageBackground={book.pageBackground}
            pages={book.pages ?? []}
            items={book.items}
            logos={logos}
            variableValues={variableValues}
            onGoToPage={goToPage}
          />
        ) : (
          <div className="space-y-6">
            <div id="bookpg-1" className="scroll-mt-4">
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
            </div>

            {v2Count > 0 && (
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
            )}

            {/* Modelo novo (BookPage): renderiza sempre que NÃO for um book só de
              itens legados — inclusive vazio, pois a própria lista traz o botão
              "Adicionar página" e a orientação de "Gerar automático". */}
            {(v2Count > 0 || book.items.length === 0) && (
              <BookPagesListV2
                bookId={bookId}
                supplierId={book.supplierId}
                pages={book.pages ?? []}
                logos={logos}
                variableValues={variableValues}
                pageNumberStart={2}
                totalPages={totalPages}
                showPhotoNumbers={book.showPhotoNumbers}
              />
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
                pageNumberStart={legacyStart}
              />
            )}

            <div id={`bookpg-${totalPages}`} className="scroll-mt-4">
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
        )}
      </div>

      <BookBottomBar
        view={view}
        onViewChange={setView}
        totalPages={totalPages}
        onGoToPage={goToPage}
        zoom={zoom}
        onZoomChange={setZoom}
      />
    </div>
  );
}
