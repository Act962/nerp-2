"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FIXTURE_PRESETS, type FixturePreset } from "../engine/fixture-presets";
import type { FixtureTemplate } from "../engine/types";
import { formatMmAsMeters } from "../engine/units";
import {
  useDeleteFixtureTemplate,
  usePlanogramFixtureTemplates,
} from "../hooks/use-planogram-fixture-templates";

interface CreateFixtureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (preset: FixturePreset, name: string) => void;
  onCreateFromTemplate: (template: FixtureTemplate, name: string) => void;
}

export function CreateFixtureDialog({
  open,
  onOpenChange,
  onCreate,
  onCreateFromTemplate,
}: CreateFixtureDialogProps) {
  const { templates } = usePlanogramFixtureTemplates();
  const deleteTemplate = useDeleteFixtureTemplate();

  // Uma seleção só entre padrões salvos e modelos de fábrica: `templateId` não
  // nulo vence, porque o padrão carrega as alturas exatas dos níveis.
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState(FIXTURE_PRESETS[0].id);
  const [name, setName] = useState("");
  const [shelfCount, setShelfCount] = useState(FIXTURE_PRESETS[0].shelfCount);

  useEffect(() => {
    if (!open) return;
    const orgDefault = templates.find((entry) => entry.isDefault);
    setTemplateId(orgDefault?.id ?? null);
    setPresetId(FIXTURE_PRESETS[0].id);
    setName("");
    setShelfCount(FIXTURE_PRESETS[0].shelfCount);
  }, [open, templates]);

  const preset =
    FIXTURE_PRESETS.find((entry) => entry.id === presetId) ??
    FIXTURE_PRESETS[0];
  const selectedTemplate = templates.find((entry) => entry.id === templateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar gôndola</DialogTitle>
          <DialogDescription>
            Escolha um modelo com medidas de mercado. Tudo pode ser ajustado
            depois — inclusive adicionar ou remover prateleiras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Padrões da loja
              </p>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((entry) => (
                  <div
                    key={entry.id}
                    className={`relative rounded-lg border p-3 transition-colors hover:border-primary ${
                      entry.id === templateId
                        ? "border-primary bg-primary/5"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full pr-6 text-left"
                      onClick={() => setTemplateId(entry.id)}
                    >
                      <p className="flex items-center gap-1 text-sm font-medium">
                        {entry.isDefault && (
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                        )}
                        {entry.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMmAsMeters(entry.widthMm)} ×{" "}
                        {formatMmAsMeters(entry.heightMm)} ·{" "}
                        {entry.shelves.length} níveis
                        {entry.moduleCount > 1
                          ? ` · ${entry.moduleCount} módulos`
                          : ""}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir padrão ${entry.name}`}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        deleteTemplate.mutate(
                          { id: entry.id },
                          {
                            onSuccess: () => {
                              if (templateId === entry.id) setTemplateId(null);
                              toast.success("Padrão excluído");
                            },
                          },
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {templates.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground">
              Modelos de mercado
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {FIXTURE_PRESETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setTemplateId(null);
                  setPresetId(entry.id);
                  setShelfCount(entry.shelfCount);
                }}
                className={`rounded-lg border p-3 text-left transition-colors hover:border-primary ${
                  entry.id === presetId && !templateId
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
              >
                <p className="text-sm font-medium">{entry.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMmAsMeters(entry.widthMm)} ×{" "}
                  {formatMmAsMeters(entry.heightMm)} · prof.{" "}
                  {formatMmAsMeters(entry.depthMm)}
                </p>
              </button>
            ))}
          </div>

          <Field>
            <FieldLabel htmlFor="fixture-name">Nome</FieldLabel>
            <Input
              id="fixture-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Limpeza — corredor 4"
            />
          </Field>

          {!selectedTemplate && (
            <Field>
              <FieldLabel htmlFor="shelf-count">Prateleiras</FieldLabel>
              <Input
                id="shelf-count"
                type="number"
                min={1}
                max={12}
                value={shelfCount}
                onChange={(event) =>
                  setShelfCount(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </Field>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              if (selectedTemplate) {
                onCreateFromTemplate(selectedTemplate, name.trim());
              } else {
                onCreate({ ...preset, shelfCount }, name.trim());
              }
              onOpenChange(false);
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
