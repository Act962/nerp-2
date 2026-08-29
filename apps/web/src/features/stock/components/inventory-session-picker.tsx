"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ClipboardList, Plus } from "lucide-react";
import { useState } from "react";
import {
  useCreateInventoryCount,
  useInventoryCounts,
} from "../hooks/use-inventory";

/**
 * Escolha da sessão de contagem, antes de bipar qualquer coisa.
 *
 * A contagem precisa pertencer a uma sessão para poder ser retomada — de outro
 * corredor, de outro aparelho, no dia seguinte. Contar solto é o que se perde
 * quando a aba fecha.
 */
export function InventorySessionPicker({
  onSelect,
}: {
  onSelect: (count: { id: string; name: string; blind: boolean }) => void;
}) {
  const { data, isPending } = useInventoryCounts("OPEN");
  const create = useCreateInventoryCount();
  const [name, setName] = useState("");
  const [blind, setBlind] = useState(true);

  const abertas = data?.counts ?? [];

  const abrir = () => {
    const nome = name.trim();
    if (!nome) return;
    create.mutate(
      { name: nome, blind },
      {
        onSuccess: ({ id }) => {
          setName("");
          onSelect({ id, name: nome, blind });
        },
      },
    );
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="inventory-name">Nova contagem</Label>
          <div className="flex gap-2">
            <Input
              id="inventory-name"
              value={name}
              placeholder="Ex.: Mercearia — corredor 3"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  abrir();
                }
              }}
              className="h-12"
            />
            <Button
              type="button"
              className="h-12"
              onClick={abrir}
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? <Spinner /> : <Plus className="size-4" />}
            </Button>
          </div>
          <label
            htmlFor="inventory-blind"
            className="flex items-center justify-between gap-4 rounded-md border p-3"
          >
            <span className="flex flex-col">
              <span className="text-sm font-medium">Contagem cega</span>
              {/* O motivo de existir: vendo o saldo, a tendência é confirmar o
                  número da tela em vez de contar a prateleira. */}
              <span className="text-xs text-muted-foreground">
                Esconde o saldo do sistema enquanto conta. Recomendado.
              </span>
            </span>
            <Switch
              id="inventory-blind"
              checked={blind}
              onCheckedChange={setBlind}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Contagens abertas
          </p>
          {isPending ? (
            <div className="py-4 text-center">
              <Spinner />
            </div>
          ) : abertas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma contagem aberta.
            </p>
          ) : (
            abertas.map((count) => (
              <Button
                key={count.id}
                type="button"
                variant="outline"
                className="h-auto justify-start py-3"
                onClick={() =>
                  onSelect({
                    id: count.id,
                    name: count.name,
                    blind: count.blind,
                  })
                }
              >
                <ClipboardList className="size-4 shrink-0" />
                <span className="flex min-w-0 flex-col items-start">
                  <span className="truncate">{count.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {count.itemCount} produto(s) contado(s)
                    {count.blind ? " · cega" : ""}
                  </span>
                </span>
              </Button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
