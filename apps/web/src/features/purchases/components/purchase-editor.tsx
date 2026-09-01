"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EditorItem } from "../lib/editor-item";
import { purchaseTotals } from "../lib/purchase-totals";
import {
  useCreatePurchase,
  usePurchase,
  useProcessPurchase,
  useUpdatePurchase,
} from "../hooks/use-purchases";
import { ItemSearch, type PickedProduct } from "./item-search";
import { ITEM_GRID, PurchaseItemRow } from "./purchase-item-row";
import { ProcessPurchaseDialog } from "./process-purchase-dialog";

const SEM_FORNECEDOR = "__sem_fornecedor__";

interface HeaderState {
  supplierId: string | null;
  invoiceNumber: string;
  orderDate: string;
  shipping: number;
  discount: number;
  installments: number;
  firstDueDate: string;
  notes: string;
}

const HEADER_INICIAL: HeaderState = {
  supplierId: null,
  invoiceNumber: "",
  orderDate: new Date().toISOString().slice(0, 10),
  shipping: 0,
  discount: 0,
  installments: 1,
  firstDueDate: "",
  notes: "",
};

/**
 * A tela da nota. Página inteira, não diálogo: uma nota de 40 linhas não cabe
 * num popup, e o rascunho tem URL própria porque a digitação nem sempre
 * termina numa sentada só.
 *
 * O estado dos itens é uma lista imutável em `useState`, no mesmo desenho do
 * carrinho do PDV. Cada edição de linha recalcula derivados na própria linha
 * (total, custo unitário, sugestão de preço) e no rodapé — `useFieldArray`
 * brigaria com isso sem devolver nada em troca.
 */
export function PurchaseEditor({ purchaseId }: { purchaseId?: string }) {
  const router = useRouter();
  const { data: nota, isLoading } = usePurchase(purchaseId);
  const { suppliers } = useSupplier({ pageSize: 100 });

  const criar = useCreatePurchase();
  const atualizar = useUpdatePurchase();
  const processar = useProcessPurchase();

  const [header, setHeader] = useState<HeaderState>(HEADER_INICIAL);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const readOnly = nota !== undefined && nota.status !== "PENDING";
  const salvando = criar.isPending || atualizar.isPending;

  useEffect(() => {
    if (!nota || hidratado) return;
    setHeader({
      supplierId: nota.supplierId,
      invoiceNumber: nota.invoiceNumber ?? "",
      orderDate: nota.orderDate.slice(0, 10),
      shipping: nota.shipping,
      discount: nota.discount,
      installments: nota.installments,
      firstDueDate: nota.firstDueDate?.slice(0, 10) ?? "",
      notes: nota.notes ?? "",
    });
    setItems(
      nota.items.map((item, index) => ({
        lineId: `${item.productId}-${index}`,
        productId: item.productId,
        name: item.productName,
        code: item.product.sku ?? item.product.barcode,
        unit: item.product.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        newSalePrice: item.newSalePrice,
        product: {
          costPrice: item.product.costPrice,
          salePrice: item.product.salePrice,
          currentStock: item.product.currentStock,
          trackStock: item.product.trackStock,
        },
      })),
    );
    setHidratado(true);
  }, [nota, hidratado]);

  const totais = purchaseTotals({
    items,
    discount: header.discount,
    shipping: header.shipping,
  });

  const adicionar = (product: PickedProduct) => {
    setItems((atual) => [
      ...atual,
      {
        lineId: `${product.id}-${atual.length}-${performance.now()}`,
        productId: product.id,
        name: product.name,
        code: product.sku ?? product.barcode,
        unit: product.unit,
        quantity: 1,
        // O custo atual entra como palpite: quase sempre a nota repete o
        // preço da compra anterior, e digitar do zero 40 vezes é pior.
        unitPrice: product.costPrice,
        discount: 0,
        newSalePrice: null,
        product: {
          costPrice: product.costPrice,
          salePrice: product.salePrice,
          currentStock: product.currentStock,
          trackStock: product.trackStock,
        },
      },
    ]);
  };

  const payload = () => ({
    supplierId: header.supplierId,
    invoiceNumber: header.invoiceNumber || null,
    orderDate: header.orderDate || null,
    shipping: header.shipping,
    discount: header.discount,
    installments: header.installments,
    firstDueDate: header.firstDueDate || null,
    notes: header.notes || null,
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      newSalePrice: item.newSalePrice,
    })),
  });

  /** Devolve o id da nota gravada, ou `null` se falhou. */
  const salvar = async (): Promise<string | null> => {
    try {
      if (purchaseId) {
        await atualizar.mutateAsync({ id: purchaseId, ...payload() });
        return purchaseId;
      }
      const criada = await criar.mutateAsync(payload());
      router.replace(`/estoque/entradas/${criada.id}`);
      return criada.id;
    } catch {
      // O toast do erro já sai no hook.
      return null;
    }
  };

  const confirmarProcessamento = async () => {
    const id = await salvar();
    if (!id) return;
    processar.mutate(
      { id },
      {
        onSuccess: () => {
          setConfirmando(false);
          router.push("/estoque/entradas");
        },
      },
    );
  };

  if (purchaseId && isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col overflow-hidden p-4">
      <div className="flex flex-col gap-4 overflow-hidden">
        <FieldGroup className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          <Field className="col-span-2">
            <FieldLabel htmlFor="supplierId">Fornecedor</FieldLabel>
            <Select
              value={header.supplierId ?? SEM_FORNECEDOR}
              disabled={readOnly}
              onValueChange={(value) =>
                setHeader((h) => ({
                  ...h,
                  supplierId: value === SEM_FORNECEDOR ? null : value,
                }))
              }
            >
              <SelectTrigger id="supplierId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_FORNECEDOR}>Sem fornecedor</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="invoiceNumber">Nº da NF</FieldLabel>
            <Input
              id="invoiceNumber"
              value={header.invoiceNumber}
              disabled={readOnly}
              onChange={(event) =>
                setHeader((h) => ({ ...h, invoiceNumber: event.target.value }))
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="orderDate">Data da nota</FieldLabel>
            <Input
              id="orderDate"
              type="date"
              value={header.orderDate}
              disabled={readOnly}
              onChange={(event) =>
                setHeader((h) => ({ ...h, orderDate: event.target.value }))
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="shipping">Frete (R$)</FieldLabel>
            <Input
              id="shipping"
              type="number"
              min={0}
              step="0.01"
              value={header.shipping}
              disabled={readOnly}
              onChange={(event) =>
                setHeader((h) => ({
                  ...h,
                  shipping: Number(event.target.value) || 0,
                }))
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="installments">Parcelas</FieldLabel>
            <Input
              id="installments"
              type="number"
              min={1}
              max={360}
              value={header.installments}
              disabled={readOnly}
              onChange={(event) =>
                setHeader((h) => ({
                  ...h,
                  installments: Math.max(1, Number(event.target.value) || 1),
                }))
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="firstDueDate">1º vencimento</FieldLabel>
            <Input
              id="firstDueDate"
              type="date"
              value={header.firstDueDate}
              disabled={readOnly}
              onChange={(event) =>
                setHeader((h) => ({ ...h, firstDueDate: event.target.value }))
              }
            />
          </Field>
        </FieldGroup>

        <Field>
          <FieldLabel htmlFor="notes">Observações</FieldLabel>
          <Textarea
            id="notes"
            rows={2}
            value={header.notes}
            disabled={readOnly}
            placeholder="Divergências, avarias — o que precisa ficar registrado sobre esta nota"
            onChange={(event) =>
              setHeader((h) => ({ ...h, notes: event.target.value }))
            }
          />
        </Field>

        {!readOnly && (
          <ItemSearch
            onPick={adicionar}
            supplierId={header.supplierId}
            disabled={salvando || processar.isPending}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col rounded-lg border">
          <div
            className={cn(
              ITEM_GRID,
              "border-b px-3 py-2 text-xs font-medium text-muted-foreground",
            )}
          >
            <span>Produto</span>
            <span className="text-center">Qtd.</span>
            <span className="text-right">Compra</span>
            <span className="text-right">Desc.</span>
            <span className="text-right">Total</span>
            <span>Preço de venda</span>
            <span />
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {items.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Nenhum produto na nota. Busque, bipe ou cadastre para começar.
              </p>
            ) : (
              <ul className="divide-y px-3">
                {items.map((item) => (
                  <PurchaseItemRow
                    key={item.lineId}
                    item={item}
                    readOnly={readOnly}
                    onChange={(patch) =>
                      setItems((atual) =>
                        atual.map((linha) =>
                          linha.lineId === item.lineId
                            ? { ...linha, ...patch }
                            : linha,
                        ),
                      )
                    }
                    onRemove={() =>
                      setItems((atual) =>
                        atual.filter((linha) => linha.lineId !== item.lineId),
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </div>

      <footer className="mt-4 flex shrink-0 flex-wrap items-end justify-between gap-4 border-t pt-4">
        <div className="flex gap-6 text-sm tabular-nums">
          <div>
            <p className="text-xs text-muted-foreground">Produtos</p>
            <p>{currencyFormatter(totais.subtotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Descontos</p>
            <p>−{currencyFormatter(totais.totalDiscount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Frete</p>
            <p>{currencyFormatter(header.shipping)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total a pagar</p>
            <p className="text-lg font-semibold">
              {currencyFormatter(totais.total)}
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={salvar}
              disabled={salvando || processar.isPending}
            >
              {salvando && <Spinner />}
              Salvar rascunho
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={items.length === 0 || salvando || processar.isPending}
            >
              Processar entrada
            </Button>
          </div>
        )}
      </footer>

      <ProcessPurchaseDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        items={items}
        total={totais.total}
        installments={header.installments}
        firstDueDate={header.firstDueDate}
        purchaseNumber={nota?.purchaseNumber ?? null}
        invoiceNumber={header.invoiceNumber}
        isPending={salvando || processar.isPending}
        onConfirm={confirmarProcessamento}
      />
    </div>
  );
}
