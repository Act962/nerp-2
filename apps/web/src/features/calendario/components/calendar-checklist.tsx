"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToggleChecklistItem } from "../hooks/use-calendario";

export interface ChecklistItemView {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  /** Lojas em que ESTE usuário já marcou; `null` = evento sem loja alvo. */
  doneStoreIds: (string | null)[];
}

/**
 * Checklist de execução — o que o usuário logado marca.
 *
 * Quando o evento vale para várias lojas, a marcação é POR loja: uma ação em 20
 * lojas precisa saber em qual delas o promotor já montou a ponta de gôndola.
 * Com uma loja só (ou nenhuma), o seletor some e vira um check simples.
 */
export function CalendarChecklist({
  items,
  stores,
}: {
  items: ChecklistItemView[];
  stores: { id: string; name: string }[];
}) {
  const toggle = useToggleChecklistItem();
  const [storeId, setStoreId] = useState<string | null>(
    stores.length === 1 ? stores[0].id : null,
  );

  if (items.length === 0) return null;

  const needsStore = stores.length > 0;
  const activeStore = needsStore ? storeId : null;
  const blocked = needsStore && !activeStore;

  const doneCount = items.filter((item) =>
    item.doneStoreIds.includes(activeStore),
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Checklist{" "}
          <span className="tabular-nums text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        </p>

        {stores.length > 1 && (
          <Select
            value={storeId ?? ""}
            onValueChange={(value) => setStoreId(value)}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="Escolha a loja" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {blocked && (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Escolha a loja para marcar o que já foi feito.
        </p>
      )}

      <ul className="space-y-1">
        {items.map((item) => {
          const checked = item.doneStoreIds.includes(activeStore);
          const id = `checklist-${item.id}`;
          return (
            <li key={item.id}>
              <label
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-accent",
                  blocked && "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  disabled={blocked || toggle.isPending}
                  onCheckedChange={(value) =>
                    toggle.mutate({
                      itemId: item.id,
                      storeId: activeStore,
                      done: value === true,
                    })
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block",
                      checked && "text-muted-foreground line-through",
                    )}
                  >
                    {item.title}
                  </span>
                  {item.description && (
                    <span className="block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
                {!item.isRequired && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    opcional
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
