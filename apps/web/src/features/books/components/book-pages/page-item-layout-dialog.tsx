"use client";

import { LayoutTemplate, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BookVariableValues } from "../../lib/book-variables";
import {
  DEFAULT_COVER_BACKGROUND,
  buildDefaultPageLayout,
  type CoverBackground,
  type CoverElement,
} from "../../lib/cover-layout";
import { useUpdateBookItemLayout } from "../../hooks/use-books";
import { LayoutEditor } from "../cover-editor/layout-editor";
import { SavePageTemplateDialog } from "../templates/save-page-template-dialog";

interface PageItemLayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  itemId: string;
  storeName: string;
  supplierId: string | null;
  supplierName: string | null;
  // Layout que a página mostra hoje: o próprio dela ou o herdado do book.
  layout: unknown;
  background: unknown;
  variableValues: BookVariableValues;
  photoPreviewUrls: string[];
  logos?: { organization?: string | null; supplier?: string | null };
}

function isElementArray(value: unknown): value is CoverElement[] {
  return Array.isArray(value);
}

function isBackground(value: unknown): value is CoverBackground {
  return (
    !!value &&
    typeof value === "object" &&
    "color" in value &&
    "opacity" in value
  );
}

export function PageItemLayoutDialog({
  open,
  onOpenChange,
  bookId,
  itemId,
  storeName,
  supplierId,
  supplierName,
  layout,
  background,
  variableValues,
  photoPreviewUrls,
  logos,
}: PageItemLayoutDialogProps) {
  const updateItemLayout = useUpdateBookItemLayout();
  const [elements, setElements] = useState<CoverElement[]>(() =>
    isElementArray(layout) ? layout : buildDefaultPageLayout(),
  );
  const [fundo, setFundo] = useState<CoverBackground>(() =>
    isBackground(background) ? background : DEFAULT_COVER_BACKGROUND,
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

  // Reabrir com outra página (ou depois de aplicar um padrão) precisa recarregar
  // o layout de verdade; sem isso o diálogo mostraria o da abertura anterior.
  useEffect(() => {
    if (!open) return;
    setElements(isElementArray(layout) ? layout : buildDefaultPageLayout());
    setFundo(isBackground(background) ? background : DEFAULT_COVER_BACKGROUND);
    setSaveStatus("idle");
  }, [open, layout, background]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só grava depois de uma edição real: abrir o diálogo numa página que segue o
  // book não pode, sozinho, transformá-la em página de layout próprio.
  const hasUserEditedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: useMutation recria `updateItemLayout` a cada render; incluí-lo redispararia o autosave em loop
  useEffect(() => {
    if (!hasUserEditedRef.current) return;
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateItemLayout.mutate(
        { itemId, pageLayout: elements, pageBackground: fundo },
        { onSuccess: () => setSaveStatus("saved") },
      );
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [elements, fundo, itemId]);

  const markEdited = () => {
    hasUserEditedRef.current = true;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editar layout — {storeName}</DialogTitle>
            <DialogDescription>
              As mudanças valem só para esta página e são salvas sozinhas. Para
              levá-las a um padrão reutilizável, use "Salvar padrão de página".
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11 gap-2 md:h-9"
              onClick={() => {
                markEdited();
                setElements(buildDefaultPageLayout());
                setFundo(DEFAULT_COVER_BACKGROUND);
              }}
            >
              <RotateCcw className="size-4" /> Restaurar layout padrão
            </Button>
            <Button
              size="sm"
              className="h-11 gap-2 md:h-9"
              onClick={() => setSaveTemplateOpen(true)}
            >
              <LayoutTemplate className="size-4" /> Salvar padrão de página
            </Button>
          </div>

          <LayoutEditor
            elements={elements}
            onElementsChange={(update) => {
              markEdited();
              setElements((current) => update(current));
            }}
            background={fundo}
            onBackgroundChange={(next) => {
              markEdited();
              setFundo(next);
            }}
            saveStatus={saveStatus}
            onImportBrands={() => {}}
            canImportBrands={false}
            supportsPhotoSlots
            variableValues={variableValues}
            photoPreviewUrls={photoPreviewUrls}
            logos={logos}
          />
        </DialogContent>
      </Dialog>

      <SavePageTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        bookId={bookId}
        itemId={itemId}
        supplierId={supplierId}
        supplierName={supplierName}
      />
    </>
  );
}
