"use client";

import { Badge } from "@/components/ui/badge";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  useAutoGenerateBook,
  useAutoGeneratePreview,
} from "../hooks/use-books";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

interface AutoGenerateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select" | "preview";

export function AutoGenerateWizard({
  open,
  onOpenChange,
}: AutoGenerateWizardProps) {
  const router = useRouter();
  // Indústria via combobox com busca no servidor (a lista de suppliers pode ser
  // grande; um Select simples truncava em 10 e escondia indústrias como a
  // Pepsico). `pageSize` alto + `search` garantem que qualquer uma apareça.
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierLabel, setSupplierLabel] = useState("");
  const { suppliers, isLoading: suppliersLoading } = useSupplier({
    search: supplierSearch || undefined,
    pageSize: 100,
  });
  const now = new Date();

  const [step, setStep] = useState<Step>("select");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [name, setName] = useState("");
  const [excludedStores, setExcludedStores] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setStep("select");
      setSupplierId(null);
      setExcludedStores(new Set());
      setName("");
    }
  }, [open]);

  const { preview, isLoading } = useAutoGeneratePreview({
    supplierId: step === "preview" ? supplierId : null,
    periodMonth: Number(month),
    periodYear: Number(year),
  });

  const autoGenerate = useAutoGenerateBook();

  // Nome sugerido: "Book <Mês>/<Ano>" — o layout default da capa já usa
  // {{nomeBook}} + logo da indústria, então repetir o nome dela seria ruído.
  useEffect(() => {
    if (name.trim()) return;
    setName(`Book ${MONTHS[Number(month) - 1] ?? ""}/${year}`.trim());
  }, [month, year, name]);

  const selectedStores = useMemo(
    () => (preview?.stores ?? []).filter((s) => !excludedStores.has(s.storeId)),
    [preview, excludedStores],
  );

  const totals = useMemo(() => {
    if (!preview) return { photos: 0, pages: 0 };
    let photos = 0;
    let pages = 0;
    for (const s of selectedStores) {
      photos += s.photosCount;
      pages += s.pagesPlanned.length;
    }
    return { photos, pages };
  }, [preview, selectedStores]);

  const canAdvance = !!supplierId && !!month && !!year;
  const canConfirm =
    !!preview &&
    preview.isComplete &&
    selectedStores.length > 0 &&
    !!name.trim();

  const confirm = () => {
    if (!supplierId) return;
    autoGenerate.mutate(
      {
        name: name.trim(),
        supplierId,
        periodMonth: Number(month),
        periodYear: Number(year),
        storeIds: selectedStores.map((s) => s.storeId),
      },
      {
        onSuccess: (r) => {
          onOpenChange(false);
          router.push(`/books/${r.bookId}`);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar book automaticamente</DialogTitle>
          <DialogDescription>
            Escolha a indústria e o período. As fotos aprovadas dos promotores
            viram páginas — uma por supermercado — seguindo o padrão de layout
            da indústria.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <Field>
              <FieldLabel>Indústria</FieldLabel>
              <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    // biome-ignore lint/a11y/useSemanticElements: combobox trigger
                    role="combobox"
                    aria-expanded={supplierOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn(!supplierLabel && "text-muted-foreground")}>
                      {supplierLabel || "Selecione a indústria"}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar indústria..."
                      value={supplierSearch}
                      onValueChange={setSupplierSearch}
                    />
                    <CommandList>
                      <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                        {suppliersLoading
                          ? "Buscando..."
                          : "Nenhuma indústria encontrada."}
                      </CommandEmpty>
                      <CommandGroup>
                        {suppliers.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.id}
                            onSelect={() => {
                              setSupplierId(s.id);
                              setSupplierLabel(s.name);
                              setSupplierOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                supplierId === s.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Mês</FieldLabel>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((label, i) => (
                      <SelectItem key={label} value={String(i + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="wizard-year">Ano</FieldLabel>
                <Input
                  id="wizard-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {isLoading && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}

            {preview && (
              <>
                <Field>
                  <FieldLabel htmlFor="wizard-book-name">
                    Nome do book
                  </FieldLabel>
                  <Input
                    id="wizard-book-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`Book ${MONTHS[preview.periodMonth - 1]}/${preview.periodYear}`}
                  />
                </Field>

                {preview.totalStores === 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-medium">Nenhuma foto aprovada</p>
                      <p className="mt-1">
                        Não há fotos aprovadas dessa indústria neste período.
                        Aprove as fotos em "Fotos para aprovação" antes de
                        gerar.
                      </p>
                    </div>
                  </div>
                )}

                {!preview.isComplete && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-medium">
                        Padrões obrigatórios faltando
                      </p>
                      <p className="mt-1">
                        Esta indústria ainda não tem:{" "}
                        <strong>{preview.missingRequired.join(", ")}</strong>. O
                        book só pode ser gerado depois de configurar esses
                        padrões.{" "}
                        <Link
                          href={`/padroes/industria/${preview.supplierId}`}
                          className="underline"
                          onClick={() => onOpenChange(false)}
                        >
                          Configurar agora
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {preview.totalStores > 0 && (
                  <>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="flex flex-wrap gap-4">
                        <span>
                          <strong>{selectedStores.length}</strong> loja(s)
                        </span>
                        <span>
                          <strong>{totals.photos}</strong> foto(s)
                        </span>
                        <span>
                          <strong>{totals.pages}</strong> página(s)
                        </span>
                      </div>
                    </div>

                    <div className="rounded-md border">
                      <div className="max-h-72 overflow-y-auto divide-y">
                        {preview.stores.map((store) => {
                          const excluded = excludedStores.has(store.storeId);
                          const checkboxId = `wizard-store-${store.storeId}`;
                          return (
                            <label
                              key={store.storeId}
                              htmlFor={checkboxId}
                              className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/30"
                            >
                              <Checkbox
                                id={checkboxId}
                                checked={!excluded}
                                onCheckedChange={(v) => {
                                  const next = new Set(excludedStores);
                                  if (v) next.delete(store.storeId);
                                  else next.add(store.storeId);
                                  setExcludedStores(next);
                                }}
                              />
                              <div className="flex-1 text-sm">
                                <div className="font-medium">
                                  {store.storeName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {[store.city, store.state]
                                    .filter(Boolean)
                                    .join(" / ") || "—"}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {store.pagesPlanned.map((page, idx) => (
                                  <Badge
                                    key={`${store.storeId}-${idx}`}
                                    variant="secondary"
                                    className="text-xs"
                                    title={
                                      page.orientation === "LANDSCAPE"
                                        ? "horizontal"
                                        : "vertical"
                                    }
                                  >
                                    {page.size}
                                    {page.orientation === "LANDSCAPE"
                                      ? "H"
                                      : "V"}
                                  </Badge>
                                ))}
                              </div>
                              <div className="w-16 text-right text-xs text-muted-foreground">
                                {store.photosCount} foto(s)
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "select" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!canAdvance}>
                Avançar
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                <ChevronLeft className="size-4" />
                Voltar
              </Button>
              <Button
                onClick={confirm}
                disabled={!canConfirm || autoGenerate.isPending}
              >
                {autoGenerate.isPending && <Spinner />}
                Gerar book
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
