"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Star, Trash2 } from "lucide-react";
import {
  useDeleteReceiptTemplate,
  useSetDefaultReceiptTemplate,
} from "../hooks/use-receipt-templates";
import type { ReceiptPaper, ReceiptTemplate, ReceiptType } from "../lib/types";
import { NewTemplateDialog } from "./new-template-dialog";

export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  FISCAL: "Fiscal",
  NAO_FISCAL: "Não fiscal",
  ORCAMENTO: "Orçamento",
};

export const RECEIPT_PAPER_LABELS: Record<ReceiptPaper, string> = {
  MM80: "80mm",
  MM58: "58mm",
  A4: "A4",
};

export function TemplateList({
  templates,
  selectedId,
  onSelect,
  isLoading,
}: {
  templates: ReceiptTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  const setDefault = useSetDefaultReceiptTemplate();
  const del = useDeleteReceiptTemplate();

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Templates</h2>
        <NewTemplateDialog onCreated={onSelect} />
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 pr-3">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
          {!isLoading && templates.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Nenhum template ainda. Crie o primeiro.
            </p>
          )}
          {templates.map((template) => {
            const isSelected = template.id === selectedId;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelect(template.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-accent"
                    : "hover:bg-accent/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {template.name}
                  </span>
                  {template.isDefault && (
                    <Badge variant="default" className="gap-1">
                      <Star className="size-3" />
                      Padrão
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">
                    {RECEIPT_TYPE_LABELS[template.type]}
                  </Badge>
                  <Badge variant="outline">
                    {RECEIPT_PAPER_LABELS[template.paper]}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {!template.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={setDefault.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefault.mutate({ id: template.id });
                      }}
                    >
                      <Star className="size-3" />
                      Definir padrão
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    disabled={del.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      del.mutate({ id: template.id });
                    }}
                  >
                    <Trash2 className="size-3" />
                    Excluir
                  </Button>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
