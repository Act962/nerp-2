"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useSupplierBrands,
  useTemplateForBook,
  useUpdateBookCoverLayout,
} from "../../hooks/use-books";
import {
  DEFAULT_COVER_BACKGROUND,
  buildDefaultClosingLayout,
  buildDefaultCoverLayout,
  createImageElement,
  type CoverBackground,
  type CoverElement,
} from "../../lib/cover-layout";
import type { BookVariableValues } from "../../lib/book-variables";
import { formatPeriod } from "../../lib/book-format";
import { LayoutEditor } from "./layout-editor";

interface CoverEditorProps {
  bookId: string;
  bookName: string;
  supplierId: string | null;
  supplierName: string | null;
  organizationName: string;
  periodMonth: number;
  periodYear: number;
  coverLayout: unknown;
  closingLayout: unknown;
  coverBackground: unknown;
  closingBackground: unknown;
  onRequestSaveTemplate: () => void;
  logos?: { organization?: string | null; supplier?: string | null };
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

export function CoverEditor({
  bookId,
  bookName,
  supplierId,
  supplierName,
  organizationName,
  periodMonth,
  periodYear,
  coverLayout,
  closingLayout,
  coverBackground,
  closingBackground,
  onRequestSaveTemplate,
  logos,
}: CoverEditorProps) {
  const { template, isLoading: isTemplateLoading } =
    useTemplateForBook(supplierId);
  const updateLayout = useUpdateBookCoverLayout();
  const { brands } = useSupplierBrands(supplierId);

  const [activePage, setActivePage] = useState<PageKey>("cover");
  const [cover, setCover] = useState<CoverElement[] | null>(
    isElementArray(coverLayout) ? coverLayout : null,
  );
  const [closing, setClosing] = useState<CoverElement[] | null>(
    isElementArray(closingLayout) ? closingLayout : null,
  );
  const [coverBg, setCoverBg] = useState<CoverBackground | null>(
    isBackground(coverBackground) ? coverBackground : null,
  );
  const [closingBg, setClosingBg] = useState<CoverBackground | null>(
    isBackground(closingBackground) ? closingBackground : null,
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  // Pré-popula com o padrão da indústria (ou o da organização, copiado) assim
  // que sabemos que o book ainda não tem capa própria.
  useEffect(() => {
    if (isTemplateLoading) return;
    setCover(
      (current) =>
        current ??
        (isElementArray(template?.coverLayout)
          ? template.coverLayout
          : buildDefaultCoverLayout()),
    );
    setClosing(
      (current) =>
        current ??
        (isElementArray(template?.closingLayout)
          ? template.closingLayout
          : buildDefaultClosingLayout()),
    );
    setCoverBg(
      (current) =>
        current ??
        (isBackground(template?.coverBackground)
          ? template.coverBackground
          : DEFAULT_COVER_BACKGROUND),
    );
    setClosingBg(
      (current) =>
        current ??
        (isBackground(template?.closingBackground)
          ? template.closingBackground
          : DEFAULT_COVER_BACKGROUND),
    );
  }, [isTemplateLoading, template]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só grava depois de uma edição de verdade — abrir a aba não deve escrever
  // no book o layout que acabou de ser semeado a partir do padrão.
  const hasUserEditedRef = useRef(false);
  const markEdited = () => {
    hasUserEditedRef.current = true;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: useMutation recria `updateLayout` a cada render; incluí-lo redispararia o autosave em loop
  useEffect(() => {
    if (!cover || !closing || !coverBg || !closingBg) return;
    if (!hasUserEditedRef.current) return;
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateLayout.mutate(
        {
          id: bookId,
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
  }, [cover, closing, coverBg, closingBg, bookId]);

  const elements = activePage === "cover" ? cover : closing;
  const setElements = activePage === "cover" ? setCover : setClosing;
  const background = activePage === "cover" ? coverBg : closingBg;
  const setBackground = activePage === "cover" ? setCoverBg : setClosingBg;

  const importBrands = () => {
    if (brands.length === 0) return;
    markEdited();
    const spacing = 130;
    const startX = Math.max(40, (960 - brands.length * spacing) / 2);
    setElements((current) => [
      ...(current ?? []),
      ...brands
        .filter((brand) => brand.logo)
        .map((brand, index) =>
          createImageElement(brand.logo as string, {
            x: startX + index * spacing,
            y: 460,
            width: 100,
            height: 50,
          }),
        ),
    ]);
  };

  // A capa usa variáveis de escopo do book ({{nomeBook}}, {{periodo}}...).
  // Sem elas o canvas mostrava os textos vazios, e parecia que nada tinha sido
  // inserido.
  const variableValues = useMemo<BookVariableValues>(
    () => ({
      nomeBook: bookName,
      periodo: formatPeriod(periodMonth, periodYear),
      industria: supplierName,
      empresaPdv: organizationName,
    }),
    [bookName, periodMonth, periodYear, supplierName, organizationName],
  );

  const canImportBrands = useMemo(
    () => !!supplierId && brands.length > 0,
    [supplierId, brands],
  );

  if (!elements || !background) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <Tabs
      value={activePage}
      onValueChange={(value) => setActivePage(value as PageKey)}
    >
      <TabsList>
        <TabsTrigger value="cover">Capa</TabsTrigger>
        <TabsTrigger value="closing">Página final</TabsTrigger>
      </TabsList>

      <TabsContent value={activePage} className="mt-4">
        <LayoutEditor
          elements={elements}
          onElementsChange={(update) => {
            markEdited();
            setElements((current) => update(current ?? []));
          }}
          background={background}
          onBackgroundChange={(next) => {
            markEdited();
            setBackground(next);
          }}
          saveStatus={saveStatus}
          onSetDefault={onRequestSaveTemplate}
          setDefaultLabel="Salvar como padrão"
          onImportBrands={importBrands}
          canImportBrands={canImportBrands}
          variableValues={variableValues}
          logos={logos}
        />
      </TabsContent>
    </Tabs>
  );
}
