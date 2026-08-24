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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useStores } from "@/features/stores/hooks/use-stores";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const NONE = "__none__";

export function NewContractDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [mapObjectId, setMapObjectId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [billing, setBilling] = useState<"MENSAL" | "UNICO">("MENSAL");
  const [categoryId, setCategoryId] = useState("");

  const { stores } = useStores({ pageSize: 100 });
  const { suppliers } = useSupplier({ pageSize: 100 });
  const spacesQuery = useQuery(
    orpc.mapObject.listSpaces.queryOptions({
      input: { storeId, limit: 200 },
      enabled: Boolean(storeId),
    }),
  );
  const categoriesQuery = useQuery(
    orpc.financeiro.categories.list.queryOptions({
      input: { type: "REVENUE" },
    }),
  );

  const createNegotiation = useMutation(
    orpc.spaceNegotiation.create.mutationOptions({}),
  );
  const activate = useMutation(
    orpc.spaceNegotiation.activateContract.mutationOptions({}),
  );
  const isLoading = createNegotiation.isPending || activate.isPending;

  const spaces = spacesQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.categories ?? [];

  const reset = () => {
    setStoreId("");
    setMapObjectId("");
    setSupplierId("");
    setStartDate("");
    setEndDate("");
    setAmount("");
    setBilling("MENSAL");
    setCategoryId("");
  };

  const submit = async () => {
    if (!mapObjectId || !startDate || !endDate || !amount) {
      toast.error("Preencha espaço, início, fim e valor");
      return;
    }
    if (Number(amount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }
    try {
      const negotiation = await createNegotiation.mutateAsync({
        mapObjectId,
        supplierId: supplierId || null,
        startDate,
        endDate,
        amount: Number(amount),
        status: "FECHADA",
      });
      await activate.mutateAsync({
        negotiationId: negotiation.id,
        billing,
        categoryId: categoryId || null,
      });
      toast.success("Contrato ativado — recebíveis gerados no Financeiro");
      queryClient.invalidateQueries({
        queryKey: orpc.spaceNegotiation.listContracts.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.financeiro.entries.list.key(),
      });
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao ativar o contrato",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>
            Vincula uma indústria a um espaço por um período. Ao ativar, gera os
            recebíveis no Financeiro (mensal ou único).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Loja</FieldLabel>
            <Select
              value={storeId}
              onValueChange={(v) => {
                setStoreId(v);
                setMapObjectId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Espaço (ID do espaço)</FieldLabel>
            <Select
              value={mapObjectId}
              onValueChange={setMapObjectId}
              disabled={!storeId || spacesQuery.isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    storeId ? "Selecione o espaço" : "Escolha a loja primeiro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((sp) => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.spaceCode ?? sp.name ?? sp.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Indústria</FieldLabel>
            <Select
              value={supplierId || NONE}
              onValueChange={(v) => setSupplierId(v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem indústria</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex gap-4">
            <Field className="flex-1">
              <FieldLabel htmlFor="c-start">Início</FieldLabel>
              <Input
                id="c-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor="c-end">Fim</FieldLabel>
              <Input
                id="c-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex gap-4">
            <Field className="flex-1">
              <FieldLabel htmlFor="c-amount">
                Valor (R$){billing === "MENSAL" ? " por mês" : ""}
              </FieldLabel>
              <Input
                id="c-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </Field>
            <Field className="flex-1">
              <FieldLabel>Cobrança</FieldLabel>
              <Select
                value={billing}
                onValueChange={(v) => setBilling(v as "MENSAL" | "UNICO")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSAL">Mensal</SelectItem>
                  <SelectItem value="UNICO">Único</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel>Categoria do recebível (Financeiro)</FieldLabel>
            <Select
              value={categoryId || NONE}
              onValueChange={(v) => setCategoryId(v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem categoria</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={isLoading}>
            {isLoading && <Spinner />}
            Ativar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
