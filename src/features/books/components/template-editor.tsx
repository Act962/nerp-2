"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  usePageTemplate,
  useSupplierBrands,
  useUpdatePageTemplate,
} from "../hooks/use-books";
import { formatPeriod } from "../lib/book-format";
import { buildSampleValues } from "../lib/book-variables";
import {
  DEFAULT_COVER_BACKGROUND,
  createImageElement,
  type CoverBackground,
  type CoverElement,
} from "../lib/cover-layout";
import { isBackground, isElementArray } from "./templates/layout-preview";

// Editor Konva standalone: opera sobre um BookPageTemplate direto (sem book).
// Autosave a cada 600 ms depois da primeira edição real. O `LayoutEditor`
// arrasta o canvas + os painéis Konva; dynamic() com fallback pra não
// bloquear a rota enquanto o bundle vem.
const LayoutEditor = dynamic(
  () => import("./cover-editor/layout-editor").then((mod) => mod.LayoutEditor),
  {
    loading: () => (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    ),
  },
);

interface TemplateEditorProps {
  templateId: string;
}

export function TemplateEditor({ templateId }: TemplateEditorProps) {
  const { template, isLoading } = usePageTemplate(templateId);
  const updateTemplate = useUpdatePageTemplate();
  const { brands } = useSupplierBrands(template?.supplierId ?? null);

  const [name, setName] = useState<string>("");
  const [elements, setElements] = useState<CoverElement[] | null>(null);
  const [background, setBackground] = useState<CoverBackground | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  // Seed inicial: só quando o template carrega e o estado local ainda está
  // vazio. Evita sobrescrever edições do usuário se a query invalida.
  useEffect(() => {
    if (!template) return;
    setName((current) => current || template.name);
    setElements(
      (current) =>
        current ?? (isElementArray(template.layout) ? template.layout : []),
    );
    setBackground(
      (current) =>
        current ??
        (isBackground(template.background)
          ? template.background
          : DEFAULT_COVER_BACKGROUND),
    );
  }, [template]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUserEditedRef = useRef(false);
  const markEdited = () => {
    hasUserEditedRef.current = true;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: updateTemplate é recriado a cada render; incluí-lo redispararia o autosave em loop
  useEffect(() => {
    if (!elements || !background) return;
    if (!hasUserEditedRef.current) return;
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateTemplate.mutate(
        {
          id: templateId,
          name: name.trim() || undefined,
          layout: elements,
          background,
        },
        { onSuccess: () => setSaveStatus("saved") },
      );
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [elements, background, name, templateId]);

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

  if (isLoading || !template) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!elements || !background) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>Layout deste padrão está corrompido ou vazio.</p>
      </div>
    );
  }

  // Preview usa valores de exemplo — o padrão não pertence a um book, então
  // não temos loja/produto reais aqui. Período mostra o mês atual, que é o
  // que o auto-gerador usa por padrão.
  const now = new Date();
  const variableValues = {
    ...buildSampleValues(),
    industria: template.supplierName ?? "Indústria",
    nomeBook: template.supplierName ? `Book ${template.supplierName}` : "Book",
    periodo: formatPeriod(now.getMonth() + 1, now.getFullYear()),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/padroes" aria-label="Voltar para padrões">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex flex-col">
            <Input
              value={name}
              onChange={(e) => {
                markEdited();
                setName(e.target.value);
              }}
              placeholder="Nome do padrão"
              className="h-10 w-72 text-lg font-semibold"
            />
            <p className="text-sm text-muted-foreground">
              {template.supplierName ?? "Padrão geral da organização"}
            </p>
          </div>
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
        canImportBrands={!!template.supplierId && brands.length > 0}
        supportsPhotoSlots
        variableValues={variableValues}
      />
    </div>
  );
}
