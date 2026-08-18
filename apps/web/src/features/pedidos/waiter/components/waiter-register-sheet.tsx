"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import {
  useWaiterCreateOrder,
  useWaiterProducts,
} from "../hooks/use-waiter-pedidos";

const NO_PRODUCT = "__none__";

const schema = z
  .object({
    tableNumber: z.string().min(1, "Informe a mesa"),
    items: z
      .array(
        z.object({
          productId: z.string().optional(),
          dishName: z.string().optional(),
          quantity: z.string().optional(),
        }),
      )
      .min(1, "Adicione ao menos um item"),
  })
  .superRefine((data, ctx) => {
    data.items.forEach((item, index) => {
      if (!item.productId && !item.dishName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione um produto ou descreva o pedido",
          path: ["items", index, "productId"],
        });
      }
    });
  });

type FormValues = z.infer<typeof schema>;

const emptyItem = {
  productId: "",
  dishName: "",
  quantity: "1",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  attendantId: string;
}

export function WaiterRegisterSheet({
  open,
  onOpenChange,
  orgSlug,
  attendantId,
}: Props) {
  const createOrder = useWaiterCreateOrder(orgSlug, attendantId);
  const { data: products } = useWaiterProducts(orgSlug);
  const productList = products ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tableNumber: "", items: [{ ...emptyItem }] },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const isLoading = createOrder.isPending;

  const onSubmit = (data: FormValues) => {
    const items = data.items.map((item) => {
      const quantity = item.quantity ? Number(item.quantity) : 1;
      const product = item.productId
        ? productList.find((p) => p.id === item.productId)
        : undefined;
      const notes = item.dishName?.trim() || undefined;
      const dishName = product?.name ?? notes ?? "Pedido";

      return {
        dishName,
        productId: item.productId || undefined,
        notes,
        quantity: quantity && Number.isFinite(quantity) ? quantity : 1,
        // estimatedMinutes não é enviado: o servidor cai no prepTimeMinutes
        // do produto vinculado (e no padrão de 15 min se não houver produto).
      };
    });

    createOrder.mutate(
      { orgSlug, attendantId, tableNumber: data.tableNumber, items },
      {
        onSuccess: () => {
          form.reset({ tableNumber: "", items: [{ ...emptyItem }] });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Novo pedido</SheetTitle>
          <SheetDescription>
            Mesma estrutura do painel — sem o campo atendente.
          </SheetDescription>
        </SheetHeader>

        <form
          id="waiter-register-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <Controller
            name="tableNumber"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Mesa</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="18"
                  aria-invalid={fieldState.invalid}
                  disabled={isLoading}
                  inputMode="numeric"
                />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <div className="flex flex-col gap-4">
            {fields.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Item {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={() => remove(index)}
                    disabled={isLoading || fields.length === 1}
                    aria-label="Remover item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <Controller
                  name={`items.${index}.productId`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Produto (opcional)
                      </FieldLabel>
                      <Select
                        value={field.value || NO_PRODUCT}
                        onValueChange={(value) =>
                          field.onChange(value === NO_PRODUCT ? "" : value)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger
                          id={field.name}
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder="Sem produto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PRODUCT}>Sem produto</SelectItem>
                          {productList.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                              {product.prepTimeMinutes
                                ? ` · ${product.prepTimeMinutes} min`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name={`items.${index}.dishName`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Observações</FieldLabel>
                      <Textarea
                        {...field}
                        id={field.name}
                        placeholder="Ex.: sem cebola, ponto da carne..."
                        aria-invalid={fieldState.invalid}
                        disabled={isLoading}
                        rows={3}
                      />
                      {fieldState.error && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name={`items.${index}.quantity`}
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Quantidade</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="number"
                        min={1}
                        placeholder="1"
                        disabled={isLoading}
                      />
                    </Field>
                  )}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => append({ ...emptyItem })}
              disabled={isLoading}
            >
              <Plus className="size-4" />
              Adicionar item
            </Button>
          </div>
        </form>

        <SheetFooter>
          <Button
            type="submit"
            form="waiter-register-form"
            disabled={isLoading}
          >
            {isLoading ? <Spinner /> : <Plus className="size-4" />}
            Registrar pedidos
          </Button>
          <SheetClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Cancelar
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
