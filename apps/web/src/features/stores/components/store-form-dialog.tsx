"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LogoUploader } from "@/components/logo-uploader/uploader";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  useCreateStore,
  useMatchDirectoryStore,
  useStore,
  useUpdateStore,
} from "../hooks/use-stores";

const storeFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  code: z.string().optional(),
  managerName: z.string().optional(),
  document: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  coverImageKey: z.string().optional(),
  notes: z.string().optional(),
  areaM2: z.string().optional(),
  monthlyCost: z.string().optional(),
  customersPerDay: z.string().optional(),
});

type DirectoryMatch = {
  latitude: number | null;
  longitude: number | null;
  directoryStoreId: string;
  name: string;
  city: string | null;
  distanceM: number | null;
};

type StoreFormValues = z.infer<typeof storeFormSchema>;

const emptyValues: StoreFormValues = {
  name: "",
  code: "",
  managerName: "",
  document: "",
  city: "",
  state: "",
  address: "",
  coverImageKey: "",
  notes: "",
  areaM2: "",
  monthlyCost: "",
  customersPerDay: "",
};

function toNullableNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface StoreFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string;
}

export function StoreFormDialog({
  open,
  onOpenChange,
  storeId,
}: StoreFormDialogProps) {
  const isEditing = !!storeId;
  const { store, isLoading: isLoadingStore } = useStore(storeId ?? "");
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const matchDirectory = useMatchDirectoryStore();
  // Preview de dedup (só no cadastro): match no diretório + ponto escolhido.
  const [match, setMatch] = useState<DirectoryMatch | null>(null);
  const [linkedDirectoryId, setLinkedDirectoryId] = useState<string | null>(
    null,
  );
  const [checked, setChecked] = useState(false);

  const form = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    setMatch(null);
    setLinkedDirectoryId(null);
    setChecked(false);
    if (isEditing && store) {
      form.reset({
        name: store.name,
        code: store.code ?? "",
        managerName: store.managerName ?? "",
        city: store.city ?? "",
        state: store.state ?? "",
        address: store.address ?? "",
        coverImageKey: store.coverImageKey ?? "",
        notes: store.notes ?? "",
        areaM2: store.areaM2 != null ? String(store.areaM2) : "",
        monthlyCost: store.monthlyCost != null ? String(store.monthlyCost) : "",
        customersPerDay:
          store.customersPerDay != null ? String(store.customersPerDay) : "",
      });
    }
    if (!isEditing) {
      form.reset(emptyValues);
    }
  }, [open, isEditing, store, form]);

  const isSaving = createStore.isPending || updateStore.isPending;

  // Confere no diretório Tradegram se o endereço já é uma loja cadastrada.
  const checkDirectory = () => {
    const values = form.getValues();
    if (!values.name || values.name.length < 2) {
      toast.error("Informe o nome da loja antes de conferir");
      return;
    }
    matchDirectory.mutate(
      {
        name: values.name,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        document: values.document || undefined,
      },
      {
        onSuccess: (result) => {
          setChecked(true);
          setMatch(
            result.match
              ? {
                  latitude: result.latitude,
                  longitude: result.longitude,
                  directoryStoreId: result.match.directoryStoreId,
                  name: result.match.name,
                  city: result.match.city,
                  distanceM: result.match.distanceM,
                }
              : {
                  latitude: result.latitude,
                  longitude: result.longitude,
                  directoryStoreId: "",
                  name: "",
                  city: null,
                  distanceM: null,
                },
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const onSubmit = (values: StoreFormValues) => {
    const payload = {
      ...values,
      coverImageKey: values.coverImageKey || null,
      areaM2: toNullableNumber(values.areaM2),
      monthlyCost: toNullableNumber(values.monthlyCost),
      customersPerDay: toNullableNumber(values.customersPerDay),
    };
    if (isEditing && storeId) {
      updateStore.mutate(
        { id: storeId, ...payload },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }
    createStore.mutate(
      {
        ...payload,
        latitude: match?.latitude ?? null,
        longitude: match?.longitude ?? null,
        directoryStoreId: linkedDirectoryId,
        document: values.document || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset(emptyValues);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar loja" : "Nova loja"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações da loja."
              : "Cadastre uma loja (ponto de venda) para mapear e registrar PDVs."}
          </DialogDescription>
        </DialogHeader>
        {isEditing && isLoadingStore ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <FieldGroup>
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Cliente / Loja
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        placeholder="Ex.: Supermercado Central - Unidade Centro"
                        disabled={isSaving}
                      />
                      {fieldState.error && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <div className="flex items-start gap-4">
                  <Controller
                    name="code"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Código</FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          placeholder="Ex.: LJ-001"
                          disabled={isSaving}
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    name="managerName"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Gerente da loja
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          placeholder="Ex.: Maria Souza"
                          disabled={isSaving}
                        />
                      </Field>
                    )}
                  />
                </div>
                <div className="flex items-start gap-4">
                  <Controller
                    name="city"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Cidade</FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          placeholder="Ex.: São Paulo"
                          disabled={isSaving}
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    name="state"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Estado</FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          placeholder="Ex.: SP"
                          disabled={isSaving}
                        />
                      </Field>
                    )}
                  />
                </div>
                <Controller
                  name="address"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Endereço</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="Ex.: Av. Paulista, 1000"
                        disabled={isSaving}
                      />
                    </Field>
                  )}
                />

                {!isEditing && (
                  <>
                    <Controller
                      name="document"
                      control={form.control}
                      render={({ field }) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>
                            CNPJ (opcional)
                          </FieldLabel>
                          <Input
                            {...field}
                            id={field.name}
                            placeholder="Reforça a busca no Tradegram"
                            disabled={isSaving}
                          />
                        </Field>
                      )}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={matchDirectory.isPending}
                      onClick={checkDirectory}
                    >
                      {matchDirectory.isPending ? (
                        <Spinner />
                      ) : (
                        <Search className="size-4" />
                      )}
                      Conferir no Tradegram
                    </Button>

                    {checked && match && match.directoryStoreId && (
                      <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
                        <p className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
                          <Building2 className="size-4" /> Já existe no
                          Tradegram
                        </p>
                        <p className="text-amber-900/90 dark:text-amber-200/90">
                          «{match.name}»{match.city ? ` · ${match.city}` : ""}
                          {match.distanceM != null
                            ? ` · a ${match.distanceM} m`
                            : ""}
                        </p>
                        {linkedDirectoryId ? (
                          <p className="text-xs text-emerald-700 dark:text-emerald-300">
                            Vinculada ao Tradegram
                            {form.getValues("name") === match.name
                              ? " (nome adotado)"
                              : ""}
                            .
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                form.setValue("name", match.name);
                                setLinkedDirectoryId(match.directoryStoreId);
                              }}
                            >
                              Usar o nome do Tradegram
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setLinkedDirectoryId(match.directoryStoreId)
                              }
                            >
                              Manter meu nome
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {checked && match && !match.directoryStoreId && (
                      <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                        {match.latitude != null
                          ? "Nenhuma loja parecida no Tradegram — será cadastrada como nova."
                          : "Não consegui localizar o endereço; a loja será cadastrada mesmo assim."}
                      </p>
                    )}
                  </>
                )}
                <Controller
                  name="coverImageKey"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>Foto da fachada (vitrine pública)</FieldLabel>
                      <LogoUploader
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </Field>
                  )}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Métricas da loja</p>
                  <p className="text-xs text-muted-foreground">
                    Usadas no Catálogo PDV pra sugerir preço por m² e no mapa de
                    calor de fluxo.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <Controller
                    name="areaM2"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Área total (m²)
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Ex.: 1200"
                          disabled={isSaving}
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    name="monthlyCost"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Custo mensal (R$)
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Ex.: 85000"
                          disabled={isSaving}
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    name="customersPerDay"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Clientes/dia
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="number"
                          min={0}
                          step="1"
                          placeholder="Ex.: 3000"
                          disabled={isSaving}
                        />
                      </Field>
                    )}
                  />
                </div>
                <Controller
                  name="notes"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Observações</FieldLabel>
                      <Textarea
                        {...field}
                        id={field.name}
                        placeholder="Informações gerais sobre a loja"
                        disabled={isSaving}
                      />
                    </Field>
                  )}
                />
              </FieldGroup>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Spinner />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
