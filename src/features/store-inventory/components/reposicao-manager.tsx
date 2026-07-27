"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CalendarClock, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useBatches,
  useRuptureTasks,
  useSetClearance,
  useUpsertBatch,
} from "../hooks/use-store-inventory";

const NEAR_EXPIRY_DAYS = 30;

function expiryTone(days: number) {
  if (days < 0) return "border-red-300 bg-red-50 text-red-700";
  if (days <= 7) return "border-red-300 bg-red-50 text-red-700";
  if (days <= NEAR_EXPIRY_DAYS)
    return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-muted bg-muted text-muted-foreground";
}

function expiryLabel(days: number) {
  if (days < 0) return `vencido há ${Math.abs(days)}d`;
  if (days === 0) return "vence hoje";
  return `${days}d p/ vencer`;
}

function BatchForm({
  storeId,
  open,
  onOpenChange,
}: {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upsert = useUpsertBatch();
  const [barcode, setBarcode] = useState("");
  const [lote, setLote] = useState("");
  const [validade, setValidade] = useState("");
  const [quantity, setQuantity] = useState("1");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!barcode.trim() || !validade) {
      toast.error("Informe o código de barras e a validade");
      return;
    }
    upsert.mutate(
      {
        storeId,
        barcode: barcode.trim(),
        lote: lote.trim() || undefined,
        validade: new Date(validade).toISOString(),
        quantity: Number(quantity) || 1,
      },
      {
        onSuccess: () => {
          toast.success("Lote registrado");
          setBarcode("");
          setLote("");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lote</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="batch-barcode">Código de barras</Label>
            <Input
              id="batch-barcode"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-validade">Validade</Label>
              <Input
                id="batch-validade"
                type="date"
                value={validade}
                onChange={(event) => setValidade(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-qty">Quantidade</Label>
              <Input
                id="batch-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch-lote">Lote (opcional)</Label>
            <Input
              id="batch-lote"
              value={lote}
              onChange={(event) => setLote(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending && <Spinner />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReposicaoManager({ storeId }: { storeId: string }) {
  const batches = useBatches(storeId);
  const ruptures = useRuptureTasks(storeId);
  const clearance = useSetClearance();
  const [formOpen, setFormOpen] = useState(false);

  const batchList = batches.data ?? [];
  const ruptureList = ruptures.data ?? [];

  function liquidar(barcode: string | null) {
    if (!barcode) {
      toast.error("Produto sem código de barras");
      return;
    }
    const input = window.prompt("Preço de liquidação (R$):");
    if (!input) return;
    const price = Number(input.replace(",", "."));
    if (!(price > 0)) {
      toast.error("Preço inválido");
      return;
    }
    clearance.mutate(
      { storeId, barcode, promotionalPrice: price },
      {
        onSuccess: () => toast.success("Liquidação aplicada no app do cliente"),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" /> Novo lote
        </Button>
      </div>

      <Tabs defaultValue="validade">
        <TabsList>
          <TabsTrigger value="validade" className="gap-1.5">
            <CalendarClock className="size-4" /> Validade ({batchList.length})
          </TabsTrigger>
          <TabsTrigger value="ruptura" className="gap-1.5">
            <AlertTriangle className="size-4" /> Ruptura ({ruptureList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="validade" className="space-y-2 pt-3">
          {batches.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : batchList.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              Nenhum lote registrado. Cadastre para acompanhar as validades.
            </p>
          ) : (
            batchList.map((batch) => (
              <Card key={batch.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">
                      {batch.productName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {batch.quantity} un
                      {batch.lote ? ` · lote ${batch.lote}` : ""} · vence{" "}
                      {new Date(batch.validade).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`whitespace-nowrap ${expiryTone(batch.daysToExpiry)}`}
                    >
                      {expiryLabel(batch.daysToExpiry)}
                    </Badge>
                    {batch.daysToExpiry <= NEAR_EXPIRY_DAYS && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => liquidar(batch.barcode)}
                      >
                        <Tag className="size-4" /> Liquidar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="ruptura" className="space-y-2 pt-3">
          {ruptures.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : ruptureList.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              Sem rupturas. (Depende de estoque mínimo definido por loja.)
            </p>
          ) : (
            ruptureList.map((task) => (
              <Card key={task.barcode ?? task.productName}>
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <p className="truncate font-medium text-sm">
                    {task.productName}
                  </p>
                  <Badge
                    variant="outline"
                    className="whitespace-nowrap border-red-300 bg-red-50 text-red-700"
                  >
                    {task.currentStock} / mín {task.minStock}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <BatchForm storeId={storeId} open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
