"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useUpdatePdvPhoto } from "@/features/pdv-photos/hooks/use-pdv-photos";
import { ListOrdered, Plus } from "lucide-react";
import {
  useAddBookPage,
  useDuplicateBookPage,
  useRemoveBookItem,
  useReorderBookItems,
} from "../../hooks/use-books";
import { formatPeriod } from "../../lib/book-format";
import { AddPageSheet } from "./add-page-sheet";
import { BookPageCard, type BookPageItem } from "./book-page-card";
import { ReorderPagesDialog } from "./reorder-pages-dialog";

interface BookPagesListProps {
  bookId: string;
  periodMonth: number;
  periodYear: number;
  items: (BookPageItem & { order: number })[];
  industryLogo?: string | null;
  organizationName?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  bookPageLayout?: unknown;
  bookPageBackground?: unknown;
  logos?: { organization?: string | null; supplier?: string | null };
  // Número global (1-based) da primeira página desta lista, pra âncora de
  // scroll do "Ir para página" da barra inferior.
  pageNumberStart?: number;
}

export function BookPagesList({
  bookId,
  periodMonth,
  periodYear,
  items,
  industryLogo,
  organizationName,
  supplierId,
  supplierName,
  bookPageLayout,
  bookPageBackground,
  logos,
  pageNumberStart,
}: BookPagesListProps) {
  const addPage = useAddBookPage();
  const duplicatePage = useDuplicateBookPage();
  const updatePhoto = useUpdatePdvPhoto({ silent: true });
  const removeItem = useRemoveBookItem();
  const reorderItems = useReorderBookItems();
  const [openAddPage, setOpenAddPage] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);

  // A página só nasce no "Salvar": criar o PdvPhoto lá no passo 1 deixaria uma
  // página fantasma vazia toda vez que o promotor abandonasse o fluxo — e em
  // 4G de supermercado isso acontece bastante.
  //
  // São duas mutations sem transação entre elas. Se a segunda (anexar fotos)
  // falhar, a página JÁ existe: guarda o id pra um novo "Salvar" reaproveitar
  // em vez de criar uma segunda página vazia.
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

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    setOrderedIds(items.map((item) => item.pdvPhotoId));
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // O delay é o que resolve o conflito com o scroll no celular: toque curto
    // rola a página, toque longo começa a arrastar.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    reorderItems.mutate({ bookId, orderedPdvPhotoIds: next });
  };

  const itemsById = new Map(items.map((item) => [item.pdvPhotoId, item]));
  const orderedItems = orderedIds
    .map((id) => itemsById.get(id))
    .filter((item): item is (typeof items)[number] => !!item);

  const periodLabel = formatPeriod(periodMonth, periodYear);
  const isSavingPage = addPage.isPending || updatePhoto.isPending;

  const addPageButton = (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2 border-dashed py-6"
      disabled={isSavingPage}
      onClick={() => setOpenAddPage(true)}
    >
      {isSavingPage ? <Spinner /> : <Plus className="size-4" />}
      Adicionar página
    </Button>
  );

  const reorderControls =
    orderedItems.length > 1 ? (
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
      isSaving={reorderItems.isPending}
      items={orderedItems.map((item, i) => ({
        id: item.pdvPhotoId,
        name: item.storeName || `Página ${i + 1}`,
      }))}
      onSave={(orderedPdvPhotoIds) => {
        setOrderedIds(orderedPdvPhotoIds);
        reorderItems.mutate({ bookId, orderedPdvPhotoIds });
        setReorderOpen(false);
      }}
    />
  ) : null;

  // Só monta quando abre: o sheet consulta lojas e tipos de mídia no topo do
  // componente, e montado o tempo todo essas duas idas ao banco aconteciam em
  // toda abertura de book, para um formulário que ninguém tinha aberto.
  const addPageSheet = openAddPage ? (
    <AddPageSheet
      open={openAddPage}
      onOpenChange={setOpenAddPage}
      onConfirm={handleConfirmPage}
      onDuplicate={async (itemId) => {
        await duplicatePage.mutateAsync({ bookId, itemId });
      }}
      isSaving={isSavingPage || duplicatePage.isPending}
      supplierId={supplierId}
      existingPages={orderedItems.map((item) => ({
        id: item.id,
        storeName: item.storeName,
      }))}
    />
  ) : null;

  if (orderedItems.length === 0) {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma página ainda. Clique em "Adicionar página" e escolha a loja
            pra começar a montar o book.
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {orderedItems.map((item, index) => (
              <div
                key={item.pdvPhotoId}
                id={
                  pageNumberStart != null
                    ? `bookpg-${pageNumberStart + index}`
                    : undefined
                }
                className="scroll-mt-4"
              >
                <BookPageCard
                  item={item}
                  periodLabel={periodLabel}
                  position={index + 1}
                  total={orderedItems.length}
                  industryLogo={industryLogo}
                  organizationName={organizationName}
                  bookId={bookId}
                  supplierId={supplierId}
                  supplierName={supplierName ?? null}
                  bookPageLayout={bookPageLayout}
                  bookPageBackground={bookPageBackground}
                  logos={logos}
                  onRemove={() =>
                    removeItem.mutate({ bookId, pdvPhotoId: item.pdvPhotoId })
                  }
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {addPageButton}
      {addPageSheet}
      {reorderDialog}
    </div>
  );
}
