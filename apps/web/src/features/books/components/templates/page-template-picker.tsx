"use client";

import { Building2, Factory, LayoutTemplate } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useBookPageTemplates } from "../../hooks/use-books";
import { EDITOR_SELECT_CLASS } from "../cover-editor/editor-controls";

// Valor sentinela: o Select do Radix não aceita "" como value de um item, e
// precisamos de uma opção explícita para "sem padrão próprio".
export const NO_PAGE_TEMPLATE = "__nenhum__";

interface PageTemplatePickerProps {
  supplierId: string | null;
  value: string;
  onChange: (templateId: string) => void;
  label?: string;
  emptyLabel?: string;
  // Texto do gatilho quando não há opção selecionável correspondente ao estado.
  // Sem isso o Radix cai no `emptyLabel` — que diria "Seguir o layout do book"
  // numa página que tem layout próprio, ou seja, o oposto do estado real.
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PageTemplatePicker({
  supplierId,
  value,
  onChange,
  label = "Padrão de página",
  emptyLabel = "Seguir o layout do book",
  placeholder,
  disabled,
  className,
}: PageTemplatePickerProps) {
  const { templates, isLoading } = useBookPageTemplates(supplierId);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="flex items-center gap-1.5 text-xs">
        <LayoutTemplate className="size-3.5" />
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className={`w-full ${EDITOR_SELECT_CLASS}`}>
          <SelectValue
            placeholder={
              isLoading ? "Carregando…" : (placeholder ?? emptyLabel)
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PAGE_TEMPLATE}>{emptyLabel}</SelectItem>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <span className="flex items-center gap-2">
                {template.supplierId ? (
                  <Factory className="size-3.5 shrink-0" />
                ) : (
                  <Building2 className="size-3.5 shrink-0" />
                )}
                {template.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isLoading && templates.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum padrão salvo ainda. Monte um layout em Personalizado e use
          &quot;Salvar como padrão de página&quot;.
        </p>
      )}
    </div>
  );
}
