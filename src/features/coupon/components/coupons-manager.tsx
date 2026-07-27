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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { Factory, Plus, Ticket, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCoupons,
  useCreateCoupon,
  useDeleteCoupon,
} from "../hooks/use-coupons";

type CouponType = "PERCENT" | "FIXED";

function CouponForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateCoupon();
  const { suppliers } = useSupplier({ pageSize: 100 });
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CouponType>("PERCENT");
  const [value, setValue] = useState("10");
  const [funder, setFunder] = useState("");
  const [barcode, setBarcode] = useState("");
  const [endsAt, setEndsAt] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const numeric = Number(value);
    if (title.trim().length < 2 || !(numeric > 0)) {
      toast.error("Informe título e valor válidos");
      return;
    }
    create.mutate(
      {
        title: title.trim(),
        type,
        value: numeric,
        funderSupplierId: funder || undefined,
        barcode: barcode.trim() || undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        perShopperLimit: 1,
      },
      {
        onSuccess: () => {
          toast.success("Cupom criado");
          setTitle("");
          setBarcode("");
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
          <DialogTitle>Novo cupom</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-title">Título</Label>
            <Input
              id="coupon-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: R$ 2 OFF no Nescau"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-type">Tipo</Label>
              <Select
                value={type}
                onValueChange={(next) => setType(next as CouponType)}
              >
                <SelectTrigger id="coupon-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">% de desconto</SelectItem>
                  <SelectItem value="FIXED">R$ de desconto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-value">Valor</Label>
              <Input
                id="coupon-value"
                type="number"
                min={1}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-funder">Indústria patrocinadora</Label>
            <Select value={funder} onValueChange={setFunder}>
              <SelectTrigger id="coupon-funder">
                <SelectValue placeholder="Nenhuma (loja banca)" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-barcode">
              Código de barras do produto (opcional)
            </Label>
            <Input
              id="coupon-barcode"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="Vazio = vale para todos os produtos"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-ends">Validade (opcional)</Label>
            <Input
              id="coupon-ends"
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Spinner />}
              Criar cupom
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CouponsManager() {
  const { data, isLoading } = useCoupons();
  const remove = useDeleteCoupon();
  const [open, setOpen] = useState(false);
  const coupons = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo cupom
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : coupons.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          Nenhum cupom. Crie um — ex.: um desconto patrocinado por uma
          indústria.
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Ticket className="size-4 text-muted-foreground" />
                    <span className="font-medium">
                      {coupon.type === "PERCENT"
                        ? `${coupon.value}% OFF`
                        : `- R$ ${coupon.value}`}
                    </span>
                    {coupon.sponsored && (
                      <Badge variant="outline" className="gap-1">
                        <Factory className="size-3" /> Indústria
                      </Badge>
                    )}
                    {!coupon.isActive && (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-muted-foreground text-sm">
                    {coupon.title} · {coupon.redemptions} resgates
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  onClick={() =>
                    remove.mutate(
                      { id: coupon.id },
                      {
                        onSuccess: () => toast.success("Cupom excluído"),
                        onError: (error) => toast.error(error.message),
                      },
                    )
                  }
                >
                  <Trash2 className="size-4 text-red-600" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CouponForm open={open} onOpenChange={setOpen} />
    </div>
  );
}
