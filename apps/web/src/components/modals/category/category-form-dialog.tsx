/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <explanation> */
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { useCategories } from "@/context/category/hooks/use-category";
import { useCategoryModal } from "@/hooks/modals/use-category-modal";

import { orpc } from "@/lib/orpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function CategoryFormDialog() {
  const { open, onClose, mode, category } = useCategoryModal();
  const { categories, isLoadingCategories } = useCategories();

  const queryClient = useQueryClient();

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      categoryId: "",
    },
  });

  const name = form.watch("name");

  const createMutation = useMutation(
    orpc.categories.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(orpc.categories.list.queryOptions());
        queryClient.invalidateQueries(
          orpc.categories.listWithoutSubcategory.queryOptions()
        );
        toast.success("Categoria criada com sucesso");
        onClose();
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const updateMutation = useMutation(
    orpc.categories.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(orpc.categories.list.queryOptions());
        toast.success("Categoria atualizada com sucesso");
        onClose();
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const isLoading =
    mode === "create" ? createMutation.isPending : updateMutation.isPending;

  // ---------------------------
  // SLUG UTILS
  // ---------------------------
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    form.setValue("slug", e.target.value);
  };

  // ---------------------------
  // RESET DO FORM AO ABRIR MODAL
  // ---------------------------
  useEffect(() => {
    if (!open) return;

    if (mode === "update" && category) {
      form.reset({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
        categoryId: category.parentId || "",
      });
    } else {
      form.reset({
        name: "",
        slug: "",
        description: "",
        categoryId: category?.id || "",
      });
    }

    setIsSlugManuallyEdited(false);
  }, [open, mode, category, form]);

  // ---------------------------
  // ATUALIZAÇÃO AUTOMÁTICA DO SLUG
  // ---------------------------
  useEffect(() => {
    if (!open) return;
    if (isSlugManuallyEdited) return;

    const slug = generateSlug(name);
    form.setValue("slug", slug);
  }, [name, open, isSlugManuallyEdited, form]);

  // ---------------------------
  // SUBMIT DO FORM
  // ---------------------------
  const onSubmit = (data: CategoryFormData) => {
    if (mode === "create") {
      const categoryId = data.categoryId || undefined;
      createMutation.mutate({ ...data, parentId: categoryId });
    } else {
      if (!category?.id) return;

      const categoryId = data.categoryId || undefined;

      updateMutation.mutate({
        id: category?.id,
        ...data,
        parentId: categoryId,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "update" ? "Editar Categoria" : "Criar Categoria"}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nome *</FieldLabel>
              <Input
                id="name"
                disabled={isLoading}
                {...form.register("name")}
                placeholder="Ex: Eletrônicos"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="slug">Slug *</FieldLabel>
              <Input
                id="slug"
                disabled={isLoading}
                value={form.watch("slug")}
                onChange={handleSlugChange}
                placeholder="eletronicos"
              />
            </Field>

            {(mode === "create" || category?.parentId) && (
              <Field>
                <FieldLabel>Categoria Pai</FieldLabel>

                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select
                      disabled={isLoading}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Categorias</SelectLabel>

                          {isLoadingCategories &&
                            Array.from({ length: 5 }).map((_, i) => (
                              <Skeleton key={i} className="h-4 w-full" />
                            ))}

                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="description">Descrição</FieldLabel>
              <Textarea
                id="description"
                disabled={isLoading}
                rows={3}
                placeholder="Ex: Produtos eletrônicos"
                {...form.register("description")}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>

            <Button disabled={isLoading}>
              {isLoading && <Spinner />}
              {mode === "update" ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
