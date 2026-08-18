"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  useDeleteMediaTypePrice,
  useUpsertMediaTypePrice,
} from "../hooks/use-catalog-pdv";

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  BASE: "Padrão da org",
  SUGGESTED: "Sugerido",
  NONE: "—",
};

interface CatalogPdvPriceRowProps {
  storeId: string;
  mediaTypeId: string;
  code: string;
  name: string;
  pricingBasis: "AREA" | "FLAT";
  price: number | null;
  priceSource: "MANUAL" | "BASE" | "SUGGESTED" | "NONE";
  manualPriceId: string | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function CatalogPdvPriceRow({
  storeId,
  mediaTypeId,
  code,
  name,
  pricingBasis,
  price,
  priceSource,
  manualPriceId,
}: CatalogPdvPriceRowProps) {
  const [editValue, setEditValue] = useState<string | null>(null);
  const upsert = useUpsertMediaTypePrice();
  const remove = useDeleteMediaTypePrice();

  const isEditing = editValue !== null;

  const handleSave = () => {
    const parsed = Number(editValue);
    if (!editValue || Number.isNaN(parsed) || parsed < 0) {
      setEditValue(null);
      return;
    }
    upsert.mutate(
      { storeId, mediaTypeId, price: parsed },
      { onSuccess: () => setEditValue(null) },
    );
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{code}</TableCell>
      <TableCell>{name}</TableCell>
      <TableCell>
        <Badge variant="outline">
          {pricingBasis === "AREA" ? "Por área" : "Fixo"}
        </Badge>
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            autoFocus
            type="number"
            min={0}
            step="0.01"
            className="h-8 w-28"
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={handleSave}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSave();
              if (event.key === "Escape") setEditValue(null);
            }}
          />
        ) : (
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => setEditValue(price != null ? String(price) : "")}
          >
            {price != null ? formatCurrency(price) : "—"}
          </button>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={priceSource === "MANUAL" ? "default" : "secondary"}
          className="text-xs"
        >
          {SOURCE_LABEL[priceSource]}
        </Badge>
      </TableCell>
      <TableCell>
        {priceSource === "MANUAL" && manualPriceId && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            title="Voltar ao preço automático"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ id: manualPriceId })}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
