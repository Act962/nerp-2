"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { BarcodeScanner } from "@/features/shopper/components/barcode-scanner";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { cn } from "@/lib/utils";
import { Camera, CheckCircle2, ClipboardList, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type CollectorOperation,
  type CollectorProduct,
  findProductByCode,
  useRegisterAdjustment,
  useRegisterEntry,
  useRegisterOutput,
} from "../hooks/use-collector";
import { useCountInventoryItem } from "../hooks/use-inventory";
import {
  OPERATION_LABEL,
  QUANTITY_LABEL,
  previewStock,
} from "../lib/collector";
import { InventorySessionPicker } from "./inventory-session-picker";

const OPERATIONS: CollectorOperation[] = ["ENTRADA", "SAIDA", "INVENTARIO"];

interface HistoryItem {
  key: string;
  productName: string;
  operation: CollectorOperation;
  quantity: number;
  previousStock: number;
  newStock: number;
}

export function Coletor() {
  const [operation, setOperation] = useState<CollectorOperation>("ENTRADA");
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<CollectorProduct | null>(null);
  const [quantity, setQuantity] = useState("");
  const [searching, setSearching] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  // Inventário conta DENTRO de uma sessão, para poder ser retomado depois.
  const [session, setSession] = useState<{
    id: string;
    name: string;
    blind: boolean;
  } | null>(null);

  const codeRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  const entry = useRegisterEntry();
  const output = useRegisterOutput();
  const adjustment = useRegisterAdjustment();
  const countItem = useCountInventoryItem();
  const saving =
    entry.isPending ||
    output.isPending ||
    adjustment.isPending ||
    countItem.isPending;

  const lookup = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      const found = await findProductByCode(trimmed);
      if (!found) {
        toast.error(`Nenhum produto com o código ${trimmed}`);
        setProduct(null);
        return;
      }
      setProduct(found);
      setQuantity("");
      setCode("");
      // Achou: o próximo gesto é digitar a quantidade, não bipar de novo.
      setTimeout(() => quantityRef.current?.focus(), 50);
    } catch {
      toast.error("Não consegui buscar o produto");
    } finally {
      setSearching(false);
    }
  }, []);

  // Leitor físico (emula teclado): funciona sem abrir a câmera. Desligado
  // enquanto a câmera está ativa para os dois não dispararem no mesmo bipe.
  useBarcodeScan(!cameraOn, (scanned) => void lookup(scanned));

  useEffect(() => {
    if (!product) codeRef.current?.focus();
  }, [product]);

  const parsedQuantity = Number(quantity.replace(",", "."));
  // Numa contagem cega o operador não vê saldo nem divergência — é o que
  // impede confirmar o número da tela em vez de contar a prateleira.
  const blindCount = operation === "INVENTARIO" && Boolean(session?.blind);
  const preview = product
    ? previewStock(operation, product.currentStock, parsedQuantity)
    : null;
  const canConfirm =
    Boolean(product) && quantity.trim() !== "" && !preview?.error && !saving;

  const reset = () => {
    setProduct(null);
    setQuantity("");
    setCode("");
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const pushHistory = (item: Omit<HistoryItem, "key">) => {
    setHistory((prev) => [
      { ...item, key: `${item.productName}-${prev.length}-${item.newStock}` },
      ...prev,
    ]);
  };

  const confirm = () => {
    if (!product || !preview || preview.error) return;
    const done = (previousStock: number, newStock: number) => {
      pushHistory({
        productName: product.name,
        operation,
        quantity: parsedQuantity,
        previousStock,
        newStock,
      });
      toast.success(`${OPERATION_LABEL[operation]} registrada`);
      reset();
    };

    if (operation === "ENTRADA") {
      entry.mutate(
        { productId: product.id, quantity: parsedQuantity, type: "ENTRADA" },
        { onSuccess: () => done(product.currentStock, preview.newStock) },
      );
      return;
    }
    if (operation === "SAIDA") {
      output.mutate(
        { productId: product.id, quantity: parsedQuantity, type: "SAIDA" },
        { onSuccess: () => done(product.currentStock, preview.newStock) },
      );
      return;
    }
    if (session) {
      // Só registra a contagem; o estoque só muda quando a sessão é aplicada,
      // em bloco e com o relatório de divergência na frente.
      countItem.mutate(
        {
          countId: session.id,
          productId: product.id,
          countedQuantity: parsedQuantity,
        },
        {
          onSuccess: () => {
            pushHistory({
              productName: product.name,
              operation,
              quantity: parsedQuantity,
              previousStock: product.currentStock,
              newStock: parsedQuantity,
            });
            toast.success("Contagem registrada");
            reset();
          },
        },
      );
      return;
    }

    adjustment.mutate(
      { productId: product.id, countedQuantity: parsedQuantity },
      {
        onSuccess: (result) => {
          if (result.difference === 0) {
            toast.success("Contagem conferida — o saldo já estava certo");
          }
          done(result.previousStock, result.newStock);
        },
      },
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {/* Operação primeiro: ela muda o significado do número que vem depois. */}
      <div className="grid grid-cols-3 gap-2">
        {OPERATIONS.map((op) => (
          <Button
            key={op}
            type="button"
            variant={operation === op ? "default" : "outline"}
            className="h-12"
            onClick={() => setOperation(op)}
          >
            {OPERATION_LABEL[op]}
          </Button>
        ))}
      </div>

      {operation === "INVENTARIO" && !session && (
        <InventorySessionPicker onSelect={setSession} />
      )}

      {operation === "INVENTARIO" && session && (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{session.name}</span>
            {session.blind && <Badge variant="outline">cega</Badge>}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSession(null);
              reset();
            }}
          >
            Trocar
          </Button>
        </div>
      )}

      {!product && (operation !== "INVENTARIO" || session) && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <Label htmlFor="collector-code">Código de barras ou SKU</Label>
            <div className="flex gap-2">
              <Input
                id="collector-code"
                ref={codeRef}
                value={code}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Bipe ou digite"
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void lookup(code);
                }}
                className="h-12 text-base"
              />
              <Button
                type="button"
                className="h-12"
                onClick={() => void lookup(code)}
                disabled={searching || !code.trim()}
              >
                {searching ? <Spinner /> : <Search className="size-4" />}
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => setCameraOn((on) => !on)}
            >
              {cameraOn ? (
                <>
                  <X className="size-4" />
                  Fechar câmera
                </>
              ) : (
                <>
                  <Camera className="size-4" />
                  Ler com a câmera
                </>
              )}
            </Button>

            {cameraOn && (
              <BarcodeScanner
                onDetect={(scanned) => {
                  setCameraOn(false);
                  void lookup(scanned);
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {product && preview && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {product.sku ?? product.barcode ?? "sem código"}
                  {!blindCount && (
                    <>
                      {" · saldo atual "}
                      <span className="font-medium tabular-nums">
                        {product.currentStock} {product.unit}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Trocar produto"
                onClick={reset}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="collector-quantity">
                {QUANTITY_LABEL[operation]}
              </Label>
              <Input
                id="collector-quantity"
                ref={quantityRef}
                value={quantity}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                onChange={(event) => setQuantity(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canConfirm) {
                    event.preventDefault();
                    confirm();
                  }
                }}
                className="h-14 text-center text-2xl tabular-nums"
              />
            </div>

            {/* Prévia antes de gravar: no chão da loja, descobrir o engano
                depois vira um segundo movimento e histórico sujo. */}
            {quantity.trim() !== "" && !blindCount && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  preview.error
                    ? "border-destructive/40 text-destructive"
                    : "bg-muted/40",
                )}
              >
                {preview.error ? (
                  preview.error
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      Saldo depois desta operação
                    </span>
                    <span className="font-semibold tabular-nums">
                      {preview.newStock} {product.unit}
                      {preview.difference !== 0 && (
                        <span
                          className={cn(
                            "ml-2 font-normal",
                            preview.difference > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400",
                          )}
                        >
                          ({preview.difference > 0 ? "+" : ""}
                          {preview.difference})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button
              type="button"
              className="h-14 text-base"
              onClick={confirm}
              disabled={!canConfirm}
            >
              {saving ? <Spinner /> : <CheckCircle2 className="size-5" />}
              Confirmar {OPERATION_LABEL[operation].toLowerCase()}
            </Button>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Nesta sessão
          </p>
          {history.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{item.productName}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">
                  {OPERATION_LABEL[item.operation]}
                </Badge>
                <span className="tabular-nums text-muted-foreground">
                  {item.previousStock} → {item.newStock}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
