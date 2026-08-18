"use client";

import { LayoutTemplate, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  useSupplierBrands,
  useTemplateForBook,
  useUpdateBookPageLayout,
} from "../../hooks/use-books";
import {
  buildSampleValues,
  type BookVariableValues,
} from "../../lib/book-variables";
import {
  DEFAULT_COVER_BACKGROUND,
  buildDefaultPageLayout,
  createImageElement,
  type CoverBackground,
  type CoverElement,
} from "../../lib/cover-layout";
import { formatPeriod } from "../../lib/book-format";
import { LayoutEditor } from "../cover-editor/layout-editor";
import { SavePageTemplateDialog } from "../templates/save-page-template-dialog";

interface PageItemPreview {
  storeName: string;
  managerName: string | null;
  coordinatorName: string | null;
  consultantName: string | null;
  responsibleCompany: string | null;
  section: string | null;
  code: string | null;
  actionValue: number | null;
  mediaTypeName: string | null;
  photos: string[];
}

interface PageLayoutEditorProps {
  bookId: string;
  supplierId: string | null;
  supplierName: string | null;
  organizationName: string;
  periodMonth: number;
  periodYear: number;
  pageLayout: unknown;
  pageBackground: unknown;
  items: PageItemPreview[];
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

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function PageLayoutEditor({
  bookId,
  supplierId,
  supplierName,
  organizationName,
  periodMonth,
  periodYear,
  pageLayout,
  pageBackground,
  items,
  logos,
}: PageLayoutEditorProps) {
  const {
    template,
    isLoading: isTemplateLoading,
    error: templateError,
  } = useTemplateForBook(supplierId);
  const updatePageLayout = useUpdateBookPageLayout();
  const { brands } = useSupplierBrands(supplierId);

  const [elements, setElements] = useState<CoverElement[] | null>(
    isElementArray(pageLayout) ? pageLayout : null,
  );
  const [background, setBackground] = useState<CoverBackground | null>(
    isBackground(pageBackground) ? pageBackground : null,
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [savePageTemplateOpen, setSavePageTemplateOpen] = useState(false);

  useEffect(() => {
    if (isTemplateLoading) return;
    setElements(
      (current) =>
        current ??
        (isElementArray(template?.pageLayout)
          ? template.pageLayout
          : buildDefaultPageLayout()),
    );
    setBackground(
      (current) =>
        current ??
        (isBackground(template?.pageBackground)
          ? template.pageBackground
          : DEFAULT_COVER_BACKGROUND),
    );
  }, [isTemplateLoading, template]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só grava depois de uma edição de verdade. Sem isso, abrir a aba já
  // persistiria o layout semeado e o book passaria a gerar o PDF pelo layout
  // customizado sem ninguém ter mudado nada.
  const hasUserEditedRef = useRef(false);
  const markEdited = () => {
    hasUserEditedRef.current = true;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: useMutation recria `updatePageLayout` a cada render; incluí-lo redispararia o autosave em loop
  useEffect(() => {
    if (!elements || !background) return;
    if (!hasUserEditedRef.current) return;
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updatePageLayout.mutate(
        { id: bookId, pageLayout: elements, pageBackground: background },
        { onSuccess: () => setSaveStatus("saved") },
      );
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [elements, background, bookId]);

  // Preenche o preview com o primeiro PDV real do book; sem itens, cai nos
  // valores de exemplo do catálogo de variáveis.
  const variableValues = useMemo<BookVariableValues>(() => {
    const periodLabel = formatPeriod(periodMonth, periodYear);
    const first = items[0];
    if (!first) {
      return {
        ...buildSampleValues(),
        periodo: periodLabel,
        empresaPdv: organizationName,
        industria: supplierName,
      };
    }
    return {
      loja: first.storeName,
      gerente: first.managerName,
      coordenador: first.coordinatorName,
      consultor: first.consultantName,
      empresaPdv: first.responsibleCompany ?? organizationName,
      midia: first.mediaTypeName,
      secao: first.section,
      codigo: first.code,
      valorAcao:
        first.actionValue != null ? currency.format(first.actionValue) : "",
      numeroPagina: `1 / ${items.length}`,
      periodo: periodLabel,
      industria: supplierName,
    };
  }, [items, organizationName, periodMonth, periodYear, supplierName]);

  const photoPreviewUrls = useMemo(
    () => (items[0]?.photos ?? []).map(constructUrl),
    [items],
  );

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
            y: 470,
            width: 90,
            height: 45,
          }),
        ),
    ]);
  };

  // Nunca renderizar vazio: sem isso, uma falha ao carregar o padrão deixa a
  // aba em branco e sem nenhuma pista do que aconteceu.
  if (templateError) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">Não foi possível carregar o padrão</p>
          <p className="mt-1">{templateError.message}</p>
        </div>
      </div>
    );
  }

  if (!elements || !background) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-prose text-sm text-muted-foreground">
          Este layout vale para as páginas de PDV que não têm padrão próprio. As
          variáveis e os espaços de foto são preenchidos com os dados de cada
          PDV na hora de gerar o PDF — o preview usa o primeiro deles.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-11 gap-2 md:h-9"
            onClick={() => {
              markEdited();
              setElements(buildDefaultPageLayout());
              setBackground(DEFAULT_COVER_BACKGROUND);
            }}
          >
            <RotateCcw className="size-4" /> Restaurar layout padrão
          </Button>
          <Button
            size="sm"
            className="h-11 gap-2 md:h-9"
            onClick={() => setSavePageTemplateOpen(true)}
          >
            <LayoutTemplate className="size-4" /> Salvar padrão de página
          </Button>
        </div>
      </div>

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
        onImportBrands={importBrands}
        canImportBrands={!!supplierId && brands.length > 0}
        supportsPhotoSlots
        variableValues={variableValues}
        photoPreviewUrls={photoPreviewUrls}
        logos={logos}
      />

      <SavePageTemplateDialog
        open={savePageTemplateOpen}
        onOpenChange={setSavePageTemplateOpen}
        bookId={bookId}
        supplierId={supplierId}
        supplierName={supplierName}
      />
    </div>
  );
}
