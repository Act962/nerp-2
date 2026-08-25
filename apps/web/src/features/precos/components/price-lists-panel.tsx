"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Star, Tags } from "lucide-react";
import { useState } from "react";
import {
  useCreatePriceList,
  useDeletePriceList,
  useListPriceLists,
  useUpdatePriceList,
} from "../hooks/use-precos";
import { PriceTableEditor } from "./price-table-editor";

export function PriceListsPanel() {
  const { data: lists = [], isLoading } = useListPriceLists();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = lists.find((l) => l.id === selectedId) ?? lists[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Tabelas</CardTitle>
          <CreatePriceListDialog />
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <Spinner />}
          {!isLoading && lists.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma tabela criada ainda.
            </p>
          )}
          {lists.map((list) => (
            <button
              type="button"
              key={list.id}
              onClick={() => setSelectedId(list.id)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition hover:bg-accent ${
                (selected?.id ?? "") === list.id
                  ? "border-primary bg-accent"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Tags className="size-4 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium">
                    {list.name}
                    {list.isDefault && (
                      <Star className="size-3.5 fill-yellow-500 text-yellow-500" />
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {list.productPriceCount} produto(s) com faixa
                    {list.isActive ? "" : " · inativa"}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {selected ? (
        <PriceTableEditor priceList={selected} />
      ) : (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Selecione ou crie uma tabela pra editar as faixas.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CreatePriceListDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const create = useCreatePriceList();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 size-4" />
          Nova tabela
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tabela de preço</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Nome</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Distribuidor"
            />
          </Field>
          <Field>
            <FieldLabel>Descrição (opcional)</FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quando usar essa tabela"
            />
          </Field>
          <Field>
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <FieldLabel>Usar como padrão da organização</FieldLabel>
            </div>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            disabled={create.isPending || !name.trim()}
            onClick={() => {
              create.mutate(
                {
                  name: name.trim(),
                  description: description.trim() || undefined,
                  isDefault,
                },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setName("");
                    setDescription("");
                    setIsDefault(false);
                  },
                },
              );
            }}
          >
            {create.isPending && <Spinner />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
