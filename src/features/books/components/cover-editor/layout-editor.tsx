"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    elements.find((element) => element.id === selectedId) ?? null;

  const addElement = (element: CoverElement) => {
    onElementsChange((current) => [...current, element]);
    setSelectedId(element.id);
  };

  const updateElement = (id: string, patch: Partial<CoverElement>) => {
    onElementsChange((current) =>
      current.map((element) =>
        element.id === id
          ? ({ ...element, ...patch } as CoverElement)
          : element,
      ),
    );
  };

  const deleteElement = (id: string) => {
    onElementsChange((current) =>
      current.filter((element) => element.id !== id),
    );
    setSelectedId(null);
  };

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

  const addPhotoSlot = () => {
    const usedIndexes = elements
      .filter((element) => element.type === "photoSlot")
      .map((element) => element.slotIndex);
    const nextIndex = usedIndexes.length ? Math.max(...usedIndexes) + 1 : 0;
    addElement(
      createPhotoSlotElement(nextIndex, {
        x: 60 + usedIndexes.length * 24,
        y: 60 + usedIndexes.length * 24,
      }),
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <CoverStage
          elements={elements}
          background={background}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={updateElement}
          variableValues={variableValues}
          photoPreviewUrls={photoPreviewUrls}
          logos={logos}
        />
        <div className="rounded-lg border p-3">
          <CoverPropertiesPanel
            element={selected}
            onChange={updateElement}
            onDelete={deleteElement}
            onReplaceImage={replaceImage}
            photoPreviewUrls={photoPreviewUrls}
            allowItemScope={supportsPhotoSlots}
          />
        </div>
      </div>
    </div>
  );
}
