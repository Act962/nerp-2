"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useUpdatePdvPhoto } from "@/features/pdv-photos/hooks/use-pdv-photos";
import { ListOrdered, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useAddBookPage, useReorderBookPages } from "../../hooks/use-books";
import type { BookVariableValues } from "../../lib/book-variables";
import type { LayoutLogos } from "../templates/layout-preview";
import { AddPageSheet } from "./add-page-sheet";
import { BookPageCardV2, type BookPageV2 } from "./book-page-card-v2";
import { ReorderPagesDialog } from "./reorder-pages-dialog";

// Renderiza páginas do NOVO modelo (BookPage). Reorder por setas ↑/↓ (uma
// posição por clique) — cobre "posicionar a página extra entre as de foto".
interface BookPagesListV2Props {
  bookId: string;
  supplierId: string | null;
  pages: BookPageV2[];
  logos: LayoutLogos;
  variableValues: BookVariableValues;
  // Número global (1-based) da primeira página desta lista, pra âncora de
  // scroll do "Ir para página" e pro rótulo "Página X/N" bater com o número.
  pageNumberStart?: number;
  totalPages?: number;
}

export function BookPagesListV2({
  bookId,
  supplierId,
  pages,
  logos,
  variableValues,
  pageNumberStart,
  totalPages,
}: BookPagesListV2Props) {
  const reorder = useReorderBookPages();
  const addPage = useAddBookPage();
  const updatePhoto = useUpdatePdvPhoto({ silent: true });
  const [openAddPage, setOpenAddPage] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  // Página após a qual inserir (null = adicionar no fim).
  const [insertAfterPageId, setInsertAfterPageId] = useState<string | null>(
    null,
  );

  // Mesma lógica do fluxo legado: a página nasce no "Salvar" (evita página
  // fantasma se o promotor abandonar). Se anexar fotos falhar, a página já
  // existe — guardamos o id pra um novo "Salvar" reaproveitar.
  const createdPageIdRef = useRef<string | null>(null);
  const handleConfirmPage = async ({
    storeId,
    mediaTypeId,
    photoKeys,
    pageTemplateId,
  }: {
    storeId: string;
    mediaTypeId?: string;
    photoKeys: string[];
    pageTemplateId?: string | null;
  }) => {
    if (!createdPageIdRef.current) {
      const { pdvPhotoId } = await addPage.mutateAsync({
        bookId,
        storeId,
        mediaTypeId,
        pageTemplateId,
        afterPageId: insertAfterPageId ?? undefined,
      });
      createdPageIdRef.current = pdvPhotoId;
    }
    if (photoKeys.length > 0) {
      await updatePhoto.mutateAsync({
        id: createdPageIdRef.current,
        photos: photoKeys,
      });
    }
    createdPageIdRef.current = null;
  };

  // Numeração sequencial das fotos no book inteiro (para a legenda "FOTO N"):
  // percorre as páginas na ordem e conta só os slots preenchidos.
  let running = 1;
  const numbersByPage = pages.map((page) => {
    const map: Record<number, number> = {};
    for (const item of [...page.items]
      .filter((it) => it.photoKey)
      .sort((a, b) => a.slotIndex - b.slotIndex)) {
      map[item.slotIndex] = running++;
    }
    return map;
  });

  // Troca a página do índice `from` com a vizinha `to` e persiste a nova ordem.
  const move = (from: number, to: number) => {
    if (to < 0 || to >= pages.length || reorder.isPending) return;
    const ids = pages.map((p) => p.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorder.mutate({ bookId, orderedPageIds: ids });
  };

  const isSavingPage = addPage.isPending || updatePhoto.isPending;

  const reorderControls =
    pages.length > 1 ? (
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setReorderOpen(true)}
          title="Reordenar páginas por busca (melhor para muitos itens)"
        >
          <ListOrdered className="size-4" />
          Reordenar páginas
        </Button>
      </div>
    ) : null;

  const reorderDialog = reorderOpen ? (
    <ReorderPagesDialog
      open={reorderOpen}
      onOpenChange={setReorderOpen}
      isSaving={reorder.isPending}
      items={pages.map((p, i) => ({
        id: p.id,
        name: p.isExtra
          ? `Página ${i + 1} — Página extra`
          : (p.storeName ?? `Página ${i + 1}`),
      }))}
      onSave={(orderedPageIds) => {
        reorder.mutate({ bookId, orderedPageIds });
        setReorderOpen(false);
      }}
    />
  ) : null;

  const addPageButton = (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2 border-dashed py-6"
      disabled={isSavingPage}
      onClick={() => {
        setInsertAfterPageId(null);
        setOpenAddPage(true);
      }}
    >
      {isSavingPage ? <Spinner /> : <Plus className="size-4" />}
      Adicionar página
    </Button>
  );

  // Só monta quando abre (o sheet consulta lojas e tipos de mídia no topo).
  // No V2 não oferecemos "Duplicar página" (duplica como item solo, do modelo
  // legado) — só a criação de página por loja/cliente + indústria do book.
  const addPageSheet = openAddPage ? (
    <AddPageSheet
      open={openAddPage}
      onOpenChange={setOpenAddPage}
      onConfirm={handleConfirmPage}
      onDuplicate={async () => {}}
      isSaving={isSavingPage}
      supplierId={supplierId}
      existingPages={[]}
    />
  ) : null;

  if (pages.length === 0) {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma página automática ainda. Clique em "Gerar automático" na
            tela de books, ou use "Adicionar página" para incluir uma loja
            manualmente.
          </CardContent>
        </Card>
        {addPageButton}
        {addPageSheet}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reorderControls}
      {pages.map((page, index) => (
        <div
          key={page.id}
          id={
            pageNumberStart != null
              ? `bookpg-${pageNumberStart + index}`
              : undefined
          }
          className="scroll-mt-4"
        >
          <BookPageCardV2
            bookId={bookId}
            supplierId={supplierId}
            page={page}
            position={(pageNumberStart ?? 1) + index}
            total={totalPages ?? pages.length}
            logos={logos}
            variableValues={variableValues}
            photoNumbers={numbersByPage[index]}
            onMoveUp={() => move(index, index - 1)}
            onMoveDown={() => move(index, index + 1)}
            onInsertAfter={() => {
              setInsertAfterPageId(page.id);
              setOpenAddPage(true);
            }}
            canMoveUp={index > 0}
            canMoveDown={index < pages.length - 1}
          />
        </div>
      ))}

      {addPageButton}
      {addPageSheet}
      {reorderDialog}
    </div>
  );
}
