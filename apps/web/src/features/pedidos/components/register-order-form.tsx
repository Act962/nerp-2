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
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Copy, Plus, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useQueryCollaborators } from "@/features/collaborators/hooks/use-collaborators";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { constructUrl } from "@/hooks/use-construct-url";
import { useMutationCreateKitchenOrders } from "../hooks/use-pedidos";

const NO_PRODUCT = "__none__";

const registerOrderSchema = z
  .object({
    tableNumber: z.string().min(1, "Informe a mesa"),
    attendantId: z.string().min(1, "Selecione o atendente"),
    items: z
      .array(
        z.object({
          dishName: z.string().optional(),
          productId: z.string().optional(),
          quantity: z.string().optional(),
        }),
      )
      .min(1, "Adicione ao menos um prato"),
  })
  .superRefine((data, ctx) => {
    data.items.forEach((item, index) => {
      if (!item.productId && !item.dishName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione um produto ou informe observações",
          path: ["items", index, "productId"],
        });
      }
    });
  });

type RegisterOrderForm = z.infer<typeof registerOrderSchema>;

const emptyItem = {
  dishName: "",
  productId: "",
  quantity: "1",
};

interface RegisterOrderFormProps {
  // Estado controlado (opcional) — permite abrir a partir do dropdown do header.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Renderiza o botão "Novo pedido" próprio. No header desativamos isso e o
  // trigger passa a ficar no ButtonGroup / dropdown.
  showTrigger?: boolean;
}

export function RegisterOrderForm({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: RegisterOrderFormProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const createOrders = useMutationCreateKitchenOrders();

  // QR code para o app do garçom: precisa do slug da org ativa + origin atual +
  // um joinToken assinado (server-side) que permite a quem escaneia deslogado se
  // cadastrar e entrar na org direto na área do garçom.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);
  const { data: joinLink } = useQuery(
    orpc.kitchen.waiterJoinLink.queryOptions({ input: {} }),
  );
  const waiterUrl =
    joinLink && origin
      ? `${origin}/registrar-pedido/${joinLink.slug}?joinToken=${joinLink.joinToken}`
      : "";

  const waiterDisplayUrl =
    joinLink && origin
      ? `${origin}/registrar-pedido/${joinLink.slug}?<joinToken=hash>`
      : "";

  const copyWaiterUrl = async () => {
    if (!waiterUrl) return;
    try {
      await navigator.clipboard.writeText(waiterUrl);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  // Reusa a query de produtos existente p/ o select opcional.
  const { data: productsData } = useQuery(
    orpc.products.list.queryOptions({ input: { limit: 100 } }),
  );
  const products = productsData?.products ?? [];

  const { data: collaborators } = useQueryCollaborators(true);

  const form = useForm<RegisterOrderForm>({
    resolver: zodResolver(registerOrderSchema),
    defaultValues: {
      tableNumber: "",
      attendantId: "",
      items: [{ ...emptyItem }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = (data: RegisterOrderForm) => {
    const items = data.items.map((item) => {
      const quantity = item.quantity ? Number(item.quantity) : 1;

      const product = item.productId
        ? products.find((p) => p.id === item.productId)
        : undefined;
      const notes = item.dishName?.trim() || undefined;
      const dishName = product?.name ?? notes ?? "Pedido";

      return {
        dishName,
        productId: item.productId || undefined,
        notes,
        quantity: quantity && Number.isFinite(quantity) ? quantity : 1,
        // estimatedMinutes não é enviado: vem do prepTimeMinutes do produto.
      };
    });

    createOrders.mutate(
      {
        tableNumber: data.tableNumber,
        attendantId: data.attendantId,
        items,
        // sem columnId ⇒ cai na coluna isInitial
      },
      {
        onSuccess: () => {
          form.reset({
            tableNumber: "",
            attendantId: "",
            items: [{ ...emptyItem }],
          });
          setOpen(false);
        },
      },
    );
  };

  const isLoading = createOrders.isPending;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <SheetTrigger asChild>
          <Button>
            <Plus className="size-4" />
            Novo pedido
          </Button>
        </SheetTrigger>
      )}
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Registrar pedidos</SheetTitle>
          <SheetDescription>
            Adicione um ou mais pratos para a mesma mesa. Cada prato vira um
            card na coluna inicial do kanban.
          </SheetDescription>
        </SheetHeader>

        <form
          id="register-order-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center">
            <div className="rounded-md bg-white p-2">
              {waiterUrl ? (
                <QRCodeSVG
                  value={waiterUrl}
                  size={140}
                  marginSize={1}
                  level="M"
                  aria-label="QR para o app do garçom"
                />
              ) : (
                <div className="size-35 animate-pulse rounded bg-muted" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Escaneie para abrir o app do garçom
            </p>
            {waiterDisplayUrl && (
              <p className="break-all text-[10px] text-muted-foreground select-none">
                {waiterDisplayUrl}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyWaiterUrl}
              disabled={!waiterUrl}
              className="mt-1"
            >
              <Copy className="size-3.5" />
              Copiar link do app
            </Button>
          </div>

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
                />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="attendantId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Atendente</FieldLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    id={field.name}
                    className="w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue
                      placeholder={
                        collaborators && collaborators.length > 0
                          ? "Selecione o atendente"
                          : "Cadastre um colaborador primeiro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {collaborators?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5">
                            {c.photoUrl && (
                              <AvatarImage
                                src={constructUrl(c.photoUrl)}
                                alt={c.name}
                              />
                            )}
                            <AvatarFallback className="text-[10px]">
                              {c.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">
                            · {c.role}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    aria-label="Remover prato"
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
                        onValueChange={(value) => {
                          const productId = value === NO_PRODUCT ? "" : value;
                          field.onChange(productId);
                        }}
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
                          <SelectItem value={NO_PRODUCT}>
                            Sem produto
                          </SelectItem>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
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
                        placeholder="Ex.: sem cebola, ponto da carne, retirar do cardápio..."
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
              Adicionar prato
            </Button>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" form="register-order-form" disabled={isLoading}>
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
