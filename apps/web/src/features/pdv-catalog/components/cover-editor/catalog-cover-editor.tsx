"use client";

import { CoverBackgroundPopover } from "@/features/books/components/cover-editor/cover-background-popover";
import { CoverPropertiesPanel } from "@/features/books/components/cover-editor/cover-properties-panel";
import {
  DEFAULT_COVER_BACKGROUND,
  type CoverBackground,
  type CoverElement,
  buildDefaultClosingLayout,
  buildDefaultCoverLayout,
  createImageElement,
  createTextElement,
} from "@/features/books/lib/cover-layout";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  useUpdateTradeCatalogCoverLayout,
  useUploadCatalogCoverImage,
} from "../../hooks/use-trade-catalog-doc";
import { CatalogCoverToolbar } from "./catalog-cover-toolbar";

const CoverStage = dynamic(
  () =>
    import("@/features/books/components/cover-editor/cover-stage").then(
      (mod) => mod.CoverStage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video items-center justify-center rounded-lg border">
        <Spinner />
      </div>
    ),
  },
);

interface CatalogCoverEditorProps {
  catalogId: string;
  coverLayout: unknown;
  closingLayout: unknown;
  coverBackground: unknown;
  closingBackground: unknown;
}

type PageKey = "cover" | "closing";

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

export function CatalogCoverEditor({
  catalogId,
  coverLayout,
  closingLayout,
  coverBackground,
  closingBackground,
}: CatalogCoverEditorProps) {
  const updateLayout = useUpdateTradeCatalogCoverLayout();
  const uploadImage = useUploadCatalogCoverImage();

  const [activePage, setActivePage] = useState<PageKey>("cover");
  const [cover, setCover] = useState<CoverElement[] | null>(
    isElementArray(coverLayout) ? coverLayout : buildDefaultCoverLayout(),
  );
  const [closing, setClosing] = useState<CoverElement[] | null>(
    isElementArray(closingLayout) ? closingLayout : buildDefaultClosingLayout(),
  );
  const [coverBg, setCoverBg] = useState<CoverBackground | null>(
    isBackground(coverBackground) ? coverBackground : DEFAULT_COVER_BACKGROUND,
  );
  const [closingBg, setClosingBg] = useState<CoverBackground | null>(
    isBackground(closingBackground)
      ? closingBackground
      : DEFAULT_COVER_BACKGROUND,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const elements = activePage === "cover" ? cover : closing;
  const setElements = activePage === "cover" ? setCover : setClosing;
  const background = activePage === "cover" ? coverBg : closingBg;
  const setBackground = activePage === "cover" ? setCoverBg : setClosingBg;
  const selected =
    elements?.find((element) => element.id === selectedId) ?? null;

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    if (!cover || !closing || !coverBg || !closingBg) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateLayout.mutate(
        {
          id: catalogId,
          coverLayout: cover,
          closingLayout: closing,
          coverBackground: coverBg,
          closingBackground: closingBg,
        },
        { onSuccess: () => setSaveStatus("saved") },
      );
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover, closing, coverBg, closingBg, catalogId]);

  const updateElement = (id: string, patch: Partial<CoverElement>) => {
    setElements((current) =>
      (current ?? []).map((element) =>
        element.id === id
          ? ({ ...element, ...patch } as CoverElement)
          : element,
      ),
    );
  };

  const deleteElement = (id: string) => {
    setElements((current) =>
      (current ?? []).filter((element) => element.id !== id),
    );
    setSelectedId(null);
  };

  const addText = () => {
    const element = createTextElement();
    setElements((current) => [...(current ?? []), element]);
    setSelectedId(element.id);
  };

  const addImageElement = async (file: File) => {
    const key = await uploadImage.mutateAsync(file);
    const element = createImageElement(key, {
      x: 60 + Math.random() * 100,
      y: 60 + Math.random() * 100,
    });
    setElements((current) => [...(current ?? []), element]);
    setSelectedId(element.id);
  };

  if (!elements || !background) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={activePage}
        onValueChange={(value) => {
          setActivePage(value as PageKey);
          setSelectedId(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="cover">Capa</TabsTrigger>
          <TabsTrigger value="closing">Contracapa</TabsTrigger>
        </TabsList>

        <TabsContent value={activePage} className="mt-4">
          <CatalogCoverToolbar
            onAddText={addText}
            onAddImage={addImageElement}
            isUploadingImage={uploadImage.isPending}
            saveStatus={saveStatus}
            backgroundControl={
              <CoverBackgroundPopover
                background={background}
                onChange={setBackground}
                onUploadImage={uploadImage.mutateAsync}
                isUploadingImage={uploadImage.isPending}
              />
            }
          />

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
            <CoverStage
              elements={elements}
              background={background}
              selectedIds={selectedId ? [selectedId] : []}
              onSelect={(id) => setSelectedId(id)}
              onChange={updateElement}
            />
            <div className="rounded-lg border p-3">
              <CoverPropertiesPanel
                element={selected}
                onChange={updateElement}
                onDelete={deleteElement}
                onReplaceImage={async (id, file) => {
                  const imageKey = await uploadImage.mutateAsync(file);
                  updateElement(id, { imageKey, imageSource: "upload" });
                }}
                allowItemScope={false}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
