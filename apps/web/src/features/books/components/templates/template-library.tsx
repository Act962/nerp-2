"use client";

import { Building2, Check, Factory, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useApplyBookTemplate,
  useBookTemplates,
  useDeleteBookTemplate,
} from "../../hooks/use-books";
import { TemplateThumbnail } from "./template-thumbnail";
import { SaveTemplateDialog } from "./save-template-dialog";

interface TemplateLibraryProps {
  bookId: string;
  supplierId: string | null;
  supplierName: string | null;
}

export function TemplateLibrary({
  bookId,
  supplierId,
  supplierName,
}: TemplateLibraryProps) {
  const { templates, isLoading } = useBookTemplates(supplierId);
  const applyTemplate = useApplyBookTemplate();
  const deleteTemplate = useDeleteBookTemplate();
  const [saveOpen, setSaveOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {supplierName
            ? `Padrões de ${supplierName} e da organização.`
            : "Padrões da organização."}
        </p>
        <Button
          size="sm"
          className="h-11 gap-2 md:h-9"
          onClick={() => setSaveOpen(true)}
        >
          <Star className="size-4" /> Salvar este book como padrão
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">Nenhum padrão salvo ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Monte a capa e as páginas do jeito da indústria e salve como padrão
            pra reaplicar nos próximos books.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const isApplying =
              applyTemplate.isPending && pendingId === template.id;
            return (
              <div
                key={template.id}
                className="flex flex-col overflow-hidden rounded-lg border"
              >
                <TemplateThumbnail
                  coverLayout={template.coverLayout}
                  coverBackground={template.coverBackground}
                />
                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {template.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        {template.supplierId ? (
                          <>
                            <Factory className="size-3" />
                            {template.supplierName}
                          </>
                        ) : (
                          <>
                            <Building2 className="size-3" />
                            Organização
                          </>
                        )}
                      </p>
                    </div>
                    {template.isDefault && (
                      <Badge variant="secondary" className="shrink-0">
                        Padrão
                      </Badge>
                    )}
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11 flex-1 gap-2 md:h-9"
                      disabled={applyTemplate.isPending}
                      onClick={() => {
                        setPendingId(template.id);
                        applyTemplate.mutate({
                          bookId,
                          templateId: template.id,
                        });
                      }}
                    >
                      {isApplying ? <Spinner /> : <Check className="size-4" />}
                      Aplicar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-11 shrink-0 md:size-9"
                      title="Excluir padrão"
                      disabled={deleteTemplate.isPending}
                      onClick={() => deleteTemplate.mutate({ id: template.id })}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SaveTemplateDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        bookId={bookId}
        supplierId={supplierId}
        supplierName={supplierName}
      />
    </div>
  );
}
