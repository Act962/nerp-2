"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, Undo2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { StandardPhotoOrientation } from "@/lib/photo-standard";
import type { BookVariableValues } from "../../lib/book-variables";
import {
  createImageElement,
  createPhotoSlotElement,
  createShapeElement,
  createTextElement,
  type CoverBackground,
  type CoverElement,
  type CoverShapeKind,
} from "../../lib/cover-layout";
import { useUploadCoverImage } from "../../hooks/use-books";
import { CoverBackgroundPopover } from "./cover-background-popover";
import { CoverPropertiesPanel } from "./cover-properties-panel";
import { CoverToolbar } from "./cover-toolbar";

const CoverStage = dynamic(
  () => import("./cover-stage").then((mod) => mod.CoverStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video items-center justify-center rounded-lg border">
        <Spinner />
      </div>
    ),
  },
);

interface LayoutEditorProps {
  elements: CoverElement[];
  onElementsChange: (
    update: (current: CoverElement[]) => CoverElement[],
  ) => void;
  background: CoverBackground;
  onBackgroundChange: (background: CoverBackground) => void;
  saveStatus: "idle" | "saving" | "saved";
  onSetDefault?: () => void;
  setDefaultLabel?: string;
  onImportBrands: () => void;
  canImportBrands: boolean;
  // Slots de foto e variáveis por item só fazem sentido no layout de página:
  // a capa é única e não tem PDV associado.
  supportsPhotoSlots?: boolean;
  variableValues?: BookVariableValues;
  photoPreviewUrls?: string[];
  logos?: { organization?: string | null; supplier?: string | null };
}

export function LayoutEditor({
  elements,
  onElementsChange,
  background,
  onBackgroundChange,
  saveStatus,
  onSetDefault,
  setDefaultLabel,
  onImportBrands,
  canImportBrands,
  supportsPhotoSlots = false,
  variableValues,
  photoPreviewUrls,
  logos,
}: LayoutEditorProps) {
  const uploadImage = useUploadCoverImage();
  // Multi-seleção: shift-clique adiciona/remove. Resize/rotação valem em grupo
  // via Transformer; o painel de propriedades só com exatamente 1 selecionado.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Histórico pra desfazer/refazer. Guarda snapshots do array de elementos.
  // `commit` empilha o estado ANTES da mudança; dedup por referência evita
  // várias entradas num mesmo gesto (ex.: arraste em grupo comita N nós).
  const pastRef = useRef<CoverElement[][]>([]);
  const futureRef = useRef<CoverElement[][]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const commit = (updater: (current: CoverElement[]) => CoverElement[]) => {
    const top = pastRef.current[pastRef.current.length - 1];
    if (top !== elements) {
      pastRef.current.push(elements);
      if (pastRef.current.length > 60) pastRef.current.shift();
      futureRef.current = [];
      setCanUndo(true);
    }
    onElementsChange(updater);
  };

  const undo = () => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(elements);
    setCanUndo(pastRef.current.length > 0);
    setSelectedIds([]);
    onElementsChange(() => prev);
  };

  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(elements);
    setCanUndo(true);
    setSelectedIds([]);
    onElementsChange(() => next);
  };

  const selected =
    selectedIds.length === 1
      ? (elements.find((element) => element.id === selectedIds[0]) ?? null)
      : null;

  const select = (id: string | null, additive = false) => {
    if (id === null) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      if (additive) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      // Clicar (sem shift) num nó JÁ selecionado mantém a seleção — é o que
      // permite arrastar o grupo inteiro; senão o mouse-down colapsaria pra 1.
      if (prev.includes(id)) return prev;
      return [id];
    });
  };

  const addElement = (element: CoverElement) => {
    commit((current) => [...current, element]);
    setSelectedIds([element.id]);
  };

  const updateElement = (id: string, patch: Partial<CoverElement>) => {
    commit((current) =>
      current.map((element) =>
        element.id === id
          ? ({ ...element, ...patch } as CoverElement)
          : element,
      ),
    );
  };

  const deleteElement = (id: string) => {
    commit((current) => current.filter((element) => element.id !== id));
    setSelectedIds([]);
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    commit((current) => current.filter((el) => !ids.has(el.id)));
    setSelectedIds([]);
  };

  // Duplica os selecionados deslocados 16px; seleciona as cópias. Preserva todas
  // as propriedades (variáveis, foto de referência, etc.).
  const duplicateSelected = () => {
    if (selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    const clones = elements
      .filter((el) => ids.has(el.id))
      .map((el) => ({
        ...el,
        id: crypto.randomUUID(),
        x: el.x + 16,
        y: el.y + 16,
      }));
    commit((current) => [...current, ...clones]);
    setSelectedIds(clones.map((c) => c.id));
  };

  // Atalhos (fora de campos de texto): Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z ou
  // Ctrl+Y refaz, Ctrl/Cmd+D duplica, Delete/Backspace apaga.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        redo();
      } else if (mod && key === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const addImage = async (file: File) => {
    const imageKey = await uploadImage.mutateAsync(file);
    addElement(
      createImageElement(imageKey, {
        x: 60 + Math.random() * 100,
        y: 60 + Math.random() * 100,
      }),
    );
  };

  // Enviar um arquivo por cima também troca a origem: um espaço preso ao logo
  // da organização/indústria ignora `imageKey`, e sem isso o upload sumia sem
  // aviso.
  const replaceImage = async (id: string, file: File) => {
    const imageKey = await uploadImage.mutateAsync(file);
    updateElement(id, { imageKey, imageSource: "upload" });
  };

  const addShape = (kind: CoverShapeKind) =>
    addElement(createShapeElement(kind));

  const addPhotoSlot = (orientation: StandardPhotoOrientation) => {
    const usedIndexes = elements
      .filter((element) => element.type === "photoSlot")
      .map((element) => element.slotIndex);
    const nextIndex = usedIndexes.length ? Math.max(...usedIndexes) + 1 : 0;
    addElement(
      createPhotoSlotElement(
        nextIndex,
        {
          x: 60 + usedIndexes.length * 24,
          y: 60 + usedIndexes.length * 24,
        },
        orientation,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <CoverToolbar
        onAddText={() => addElement(createTextElement())}
        onAddImage={addImage}
        onAddShape={addShape}
        onAddPhotoSlot={supportsPhotoSlots ? addPhotoSlot : undefined}
        onImportBrands={onImportBrands}
        canImportBrands={canImportBrands}
        onSetDefault={onSetDefault}
        setDefaultLabel={setDefaultLabel}
        isUploadingImage={uploadImage.isPending}
        saveStatus={saveStatus}
        backgroundControl={
          <CoverBackgroundPopover
            background={background}
            onChange={onBackgroundChange}
            onUploadImage={uploadImage.mutateAsync}
            isUploadingImage={uploadImage.isPending}
          />
        }
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={undo}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="size-3.5" /> Desfazer
        </Button>
        <span className="text-xs text-muted-foreground">
          Shift+clique seleciona vários · arraste para mover o grupo · Ctrl+Z
          desfaz
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <CoverStage
          elements={elements}
          background={background}
          selectedIds={selectedIds}
          onSelect={select}
          onChange={updateElement}
          variableValues={variableValues}
          photoPreviewUrls={photoPreviewUrls}
          logos={logos}
        />
        <div className="space-y-3 rounded-lg border p-3">
          {selectedIds.length >= 1 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedIds.length === 1
                  ? "1 selecionado"
                  : `${selectedIds.length} selecionados`}
              </span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={duplicateSelected}
                >
                  <Copy className="size-3.5" /> Duplicar
                </Button>
                {selectedIds.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1 text-destructive"
                    onClick={deleteSelected}
                  >
                    <Trash2 className="size-3.5" /> Excluir
                  </Button>
                )}
              </div>
            </div>
          )}
          {selectedIds.length > 1 ? (
            <p className="text-sm text-muted-foreground">
              Vários elementos selecionados. Arraste um deles para mover todos.
              Shift+clique adiciona ou remove da seleção.
            </p>
          ) : (
            <CoverPropertiesPanel
              element={selected}
              onChange={updateElement}
              onDelete={deleteElement}
              onReplaceImage={replaceImage}
              photoPreviewUrls={photoPreviewUrls}
              photoSlotIndexes={elements
                .filter((el) => el.type === "photoSlot")
                .map((el) => el.slotIndex)
                .sort((a, b) => a - b)}
              allowItemScope={supportsPhotoSlots}
            />
          )}
        </div>
      </div>
    </div>
  );
}
