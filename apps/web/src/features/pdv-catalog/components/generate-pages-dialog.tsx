"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useMediaTypes } from "@/features/trade-catalog/hooks/use-trade-catalog";
import { SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useGenerateTradeCatalogPages } from "../hooks/use-trade-catalog-doc";

interface GeneratePagesDialogProps {
  catalogId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeneratePagesDialog({
  catalogId,
  open,
  onOpenChange,
}: GeneratePagesDialogProps) {
  const { mediaTypes, isLoading } = useMediaTypes();
  const generatePages = useGenerateTradeCatalogPages();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setOnlyAvailable(false);
  }, [open]);

  const toggleMediaType = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const handleSubmit = () => {
    generatePages.mutate(
      { catalogId, mediaTypeIds: selectedIds, onlyAvailable },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar páginas automaticamente</DialogTitle>
          <DialogDescription>
            Escolha os tipos de mídia — uma página é criada (ou atualizada)
            por mídia, com uma linha por loja mostrando quantidade e preço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
            {isLoading && (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            )}
            {!isLoading && mediaTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum tipo de mídia cadastrado.
              </p>
            )}
            {!isLoading &&
              mediaTypes.map((mediaType) => (
                <label
                  key={mediaType.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedIds.includes(mediaType.id)}
                    onCheckedChange={() => toggleMediaType(mediaType.id)}
                  />
                  {mediaType.name}
                </label>
              ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={onlyAvailable}
              onCheckedChange={(checked) => setOnlyAvailable(checked === true)}
            />
            <Label className="cursor-pointer font-normal">
              Considerar apenas espaços disponíveis (livres)
            </Label>
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={handleSubmit}
            disabled={selectedIds.length === 0 || generatePages.isPending}
          >
            {generatePages.isPending ? (
              <Spinner />
            ) : (
              <SparklesIcon className="size-4" />
            )}
            Gerar páginas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
