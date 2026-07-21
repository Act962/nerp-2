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
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePlanogramStore } from "../engine/planogram-store-context";
import { formatMmAsMeters } from "../engine/units";
import {
  usePlanogramFixtureTemplates,
  useSaveFixtureTemplate,
} from "../hooks/use-planogram-fixture-templates";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  fixtureId,
}: SaveTemplateDialogProps) {
  const fixtures = usePlanogramStore((state) => state.fixtures);
  const shelves = usePlanogramStore((state) => state.shelves);
  const order = usePlanogramStore((state) => state.order);

  const { templates } = usePlanogramFixtureTemplates();
  const saveTemplate = useSaveFixtureTemplate();

  const fixture = fixtures[fixtureId];
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (open && fixture) {
      setName(fixture.name);
      setIsDefault(false);
    }
  }, [open, fixture]);

  if (!fixture) return null;

  const moduleIds = order.modulesByFixture[fixtureId] ?? [];
  // As prateleiras do primeiro módulo definem o padrão: os demais módulos de
  // uma mesma gôndola repetem os mesmos níveis.
  const firstModuleId = moduleIds[0];
  const templateShelves = (order.shelvesByModule[firstModuleId] ?? [])
    .map((id) => shelves[id])
    .filter(Boolean)
    .sort((a, b) => a.yMm - b.yMm)
    .map((shelf) => ({
      yMm: shelf.yMm,
      widthMm: shelf.widthMm,
      depthMm: shelf.depthMm,
      thicknessMm: shelf.thicknessMm,
      kind: shelf.kind,
      colorHex: shelf.colorHex,
    }));

  const trimmedName = name.trim();
  const willOverwrite = templates.some(
    (template) => template.name.toLowerCase() === trimmedName.toLowerCase(),
  );

  function handleSave() {
    saveTemplate.mutate(
      {
        name: trimmedName,
        kind: fixture.kind,
        widthMm: fixture.widthMm,
        heightMm: fixture.heightMm,
        depthMm: fixture.depthMm,
        baseHeightMm: fixture.baseHeightMm,
        colorHex: fixture.colorHex,
        moduleCount: Math.max(1, moduleIds.length),
        shelves: templateShelves,
        isDefault,
      },
      {
        onSuccess: () => {
          toast.success(willOverwrite ? "Padrão atualizado" : "Padrão salvo");
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(error.message ?? "Não foi possível salvar o padrão"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar gôndola como padrão</DialogTitle>
          <DialogDescription>
            Guarda as medidas, a cor, a quantidade de módulos e a altura de cada
            nível. Toda gôndola nova pode partir daqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-2.5 text-xs">
            <p>
              {formatMmAsMeters(fixture.widthMm)} ×{" "}
              {formatMmAsMeters(fixture.heightMm)} · prof.{" "}
              {formatMmAsMeters(fixture.depthMm)}
            </p>
            <p className="text-muted-foreground">
              {moduleIds.length} módulo(s) · {templateShelves.length} nível(is)
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="template-name">Nome do padrão</FieldLabel>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Gôndola padrão 1,30m"
            />
            {willOverwrite && (
              <p className="text-xs text-amber-600">
                Já existe um padrão com esse nome — salvar vai substituí-lo.
              </p>
            )}
          </Field>

          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <div className="text-xs">
              <p>Usar como padrão da loja</p>
              <p className="text-muted-foreground">
                Vem pré-selecionado ao criar uma gôndola nova.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!trimmedName || saveTemplate.isPending}
            onClick={handleSave}
          >
            {saveTemplate.isPending ? "Salvando..." : "Salvar padrão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
