"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import {
  useAddOrgPanel,
  useOrgPanelTemplates,
} from "../hooks/use-org-dashboard";

// Diálogo para escolher um template de painel. Mostra as 8 categorias
// (Comercial, Estoque, ...) com as opções de template dentro de cada uma.
// Um clique adiciona o painel + os widgets pré-configurados do template.
//
// Não é um wizard multi-passo: o admin escolhe já sabendo o que quer, ou
// olha as descrições. Se quiser refinar depois, edita widget por widget na
// aba Widgets.
export function PanelTemplatePicker({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useOrgPanelTemplates();
  const add = useAddOrgPanel();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar painel</DialogTitle>
          <DialogDescription>
            Escolha uma categoria — o painel nasce com widgets pré-configurados
            que você pode ajustar depois.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <Loader2 className="mx-auto size-5 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {data.categories.map((category) => {
              const templates = data.templates.filter(
                (template) => template.category === category.key,
              );
              if (templates.length === 0) return null;
              return (
                <section key={category.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ background: category.defaultColor }}
                    />
                    <h4 className="font-medium text-sm">{category.label}</h4>
                    <span className="text-muted-foreground text-xs">
                      {category.description}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {templates.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        disabled={add.isPending}
                        onClick={() =>
                          add.mutate(
                            { templateKey: template.key },
                            { onSuccess: () => onOpenChange(false) },
                          )
                        }
                        className="flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {template.label}
                          </p>
                          <Badge variant="secondary" className="text-[10px]">
                            {template.widgets.length} widget
                            {template.widgets.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {template.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
