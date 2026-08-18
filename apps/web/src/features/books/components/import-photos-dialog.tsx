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
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  type PdvPhotoFilters,
  usePdvFilterOptions,
  usePdvPhotos,
} from "@/features/pdv-photos/hooks/use-pdv-photos";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useImportBookPhotos } from "../hooks/use-books";

const ALL = "__all__";

interface ImportPhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  defaultSupplierId: string | null;
  existingPhotoIds: string[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ImportPhotosDialog({
  open,
  onOpenChange,
  bookId,
  defaultSupplierId,
  existingPhotoIds,
}: ImportPhotosDialogProps) {
  const { suppliers } = useSupplier();
  const filterOptions = usePdvFilterOptions();
  const importPhotos = useImportBookPhotos();

  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? ALL);
  const [section, setSection] = useState(ALL);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSupplierId(defaultSupplierId ?? ALL);
    setSection(ALL);
    setSelected([]);
  }, [open, defaultSupplierId]);

  const filters = useMemo<PdvPhotoFilters>(
    () => ({
      supplierId: supplierId === ALL ? undefined : supplierId,
      section: section === ALL ? undefined : section,
    }),
    [supplierId, section],
  );

  const { photos, isLoading } = usePdvPhotos(filters, open);

  const existing = useMemo(() => new Set(existingPhotoIds), [existingPhotoIds]);
  const candidates = useMemo(
    () => photos.filter((photo) => !existing.has(photo.id)),
    [photos, existing],
  );
  const candidateIds = useMemo(
    () => candidates.map((photo) => photo.id),
    [candidates],
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedVisibleCount = candidateIds.filter((id) =>
    selectedSet.has(id),
  ).length;
  const allSelected =
    candidateIds.length > 0 && selectedVisibleCount === candidateIds.length;
  const someSelected = selectedVisibleCount > 0 && !allSelected;

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const toggleAll = () => {
    setSelected((current) => {
      if (allSelected) {
        const remove = new Set(candidateIds);
        return current.filter((id) => !remove.has(id));
      }
      return Array.from(new Set([...current, ...candidateIds]));
    });
  };

  const handleImport = () => {
    if (selected.length === 0) return;
    importPhotos.mutate(
      { bookId, pdvPhotoIds: selected },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar fotos do PDV</DialogTitle>
          <DialogDescription>
            Selecione as capturas que farão parte do book.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <Field>
            <FieldLabel>Indústria</FieldLabel>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Seção</FieldLabel>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {filterOptions.sections.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {!isLoading && candidates.length > 0 && (
          <div className="flex items-center justify-between border-b pb-2">
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <Checkbox
                checked={
                  allSelected ? true : someSelected ? "indeterminate" : false
                }
                className="pointer-events-none"
              />
              Selecionar todas ({candidates.length})
            </button>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar seleção ({selected.length})
              </button>
            )}
          </div>
        )}

        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {!isLoading && candidates.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma captura disponível para importar.
            </p>
          )}

          {!isLoading &&
            candidates.map((photo) => {
              const chips = [
                photo.storeName,
                photo.section,
                photo.code,
                photo.supplierName,
              ].filter((value): value is string => !!value);
              const isChecked = selectedSet.has(photo.id);

              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => toggle(photo.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-muted/50"
                >
                  <Checkbox
                    checked={isChecked}
                    className="pointer-events-none"
                  />
                  {photo.photos[0] && (
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-md border">
                      <Image
                        src={constructUrl(photo.photos[0])}
                        alt="Foto do PDV"
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatDate(photo.capturedAt)}
                      <span className="text-muted-foreground">
                        {" "}
                        · {photo.photos.length} foto(s)
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {chips.join(" · ") || "Sem detalhes"}
                    </p>
                  </div>
                </button>
              );
            })}
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
            onClick={handleImport}
            disabled={selected.length === 0 || importPhotos.isPending}
          >
            {importPhotos.isPending && <Spinner />}
            Importar {selected.length > 0 && `(${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
