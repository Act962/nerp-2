"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useDeleteTradeCatalogPage,
  useReorderTradeCatalogPages,
} from "../../hooks/use-trade-catalog-doc";
import { GeneratePagesDialog } from "../generate-pages-dialog";
import { CatalogPageCard, type CatalogPageItem } from "./catalog-page-card";

interface CatalogPagesListProps {
  catalogId: string;
  pages: CatalogPageItem[];
}

export function CatalogPagesList({ catalogId, pages }: CatalogPagesListProps) {
  const reorderPages = useReorderTradeCatalogPages();
  const deletePage = useDeleteTradeCatalogPage();
  const [openGenerate, setOpenGenerate] = useState(false);

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    setOrderedIds(pages.map((page) => page.id));
  }, [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    reorderPages.mutate({ catalogId, orderedPageIds: next });
  };

  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const orderedPages = orderedIds
    .map((id) => pagesById.get(id))
    .filter((page): page is CatalogPageItem => !!page);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setOpenGenerate(true)}>
          <SparklesIcon className="size-4" />
          Gerar páginas
        </Button>
      </div>

      {orderedPages.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma página ainda. Clique em "Gerar páginas" e escolha os
            tipos de mídia para montar o catálogo automaticamente.
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {orderedPages.map((page, index) => (
                <CatalogPageCard
                  key={page.id}
                  page={page}
                  position={index + 1}
                  total={orderedPages.length}
                  onRemove={() => deletePage.mutate({ id: page.id })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <GeneratePagesDialog
        catalogId={catalogId}
        open={openGenerate}
        onOpenChange={setOpenGenerate}
      />
    </div>
  );
}
