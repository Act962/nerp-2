"use client";

import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUpdateBookPageOwnLayout } from "../../hooks/use-books";
import type { BookVariableValues } from "../../lib/book-variables";
import {
  DEFAULT_COVER_BACKGROUND,
  buildDefaultPageLayout,
  type CoverBackground,
  type CoverElement,
} from "../../lib/cover-layout";
import type { LayoutLogos } from "../templates/layout-preview";
import { LayoutEditor } from "../cover-editor/layout-editor";

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

interface SlideCanvasProps {
  bookPageId: string;
  title: string;
  layout: unknown;
  background: unknown;
  variableValues: BookVariableValues;
  photoPreviewUrls: string[];
  logos?: LayoutLogos;
}

/**
 * A página selecionada, editável direto — sem diálogo.
 *
 * Monta com `key={bookPageId}` na tela de slides: trocar de página desmonta
 * este componente, e é o desmonte que garante o flush do autosave (abaixo).
 */
export function SlideCanvas({
  bookPageId,
  title,
  layout,
  background,
  variableValues,
  photoPreviewUrls,
  logos,
}: SlideCanvasProps) {
  const updatePageLayout = useUpdateBookPageOwnLayout();
  const [elements, setElements] = useState<CoverElement[]>(() =>
    isElementArray(layout) ? layout : buildDefaultPageLayout(),
  );
  const [fundo, setFundo] = useState<CoverBackground>(() =>
    isBackground(background) ? background : DEFAULT_COVER_BACKGROUND,
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só marca depois de uma edição de verdade: abrir uma página que herda o
  // layout do book não pode, sozinho, transformá-la numa página com layout
  // próprio.
  const hasUserEditedRef = useRef(false);
  // O que ainda não foi gravado, já com o `bookPageId` desta página embutido.
  // É o que o flush do desmonte envia — sem isso, trocar de slide antes dos
  // 600ms gravaria o layout desta página NA PÁGINA SEGUINTE.
  const pendingRef = useRef<{
    bookPageId: string;
    pageLayout: CoverElement[];
    pageBackground: CoverBackground;
  } | null>(null);
  const mutateRef = useRef(updatePageLayout.mutate);
  mutateRef.current = updatePageLayout.mutate;

  // `mutateRef` mantém a mutação fora das dependências: `useMutation` a recria
  // a cada render, e incluí-la aqui redispararia o autosave em loop.
  useEffect(() => {
    if (!hasUserEditedRef.current) return;
    setSaveStatus("saving");
    pendingRef.current = {
      bookPageId,
      pageLayout: elements,
      pageBackground: fundo,
    };
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const payload = pendingRef.current;
      if (!payload) return;
      mutateRef.current(payload, {
        onSuccess: () => {
          pendingRef.current = null;
          setSaveStatus("saved");
        },
      });
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [elements, fundo, bookPageId]);

  // Flush no desmonte: trocar de slide (ou sair do editor) não pode descartar
  // uma edição feita nos últimos 600ms.
  useEffect(() => {
    return () => {
      const payload = pendingRef.current;
      if (payload) mutateRef.current(payload);
    };
  }, []);

  const markEdited = () => {
    hasUserEditedRef.current = true;
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="truncate text-sm font-medium">{title}</h2>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={() => {
            markEdited();
            setElements(buildDefaultPageLayout());
            setFundo(DEFAULT_COVER_BACKGROUND);
          }}
        >
          <RotateCcw className="size-4" /> Restaurar padrão
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
    </div>
  );
}
