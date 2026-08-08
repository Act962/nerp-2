"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Indicador de caixa aberto/fechado, reusável no header do PDV.
export function CaixaStatusBadge({ open }: { open: boolean }) {
  return (
    <Badge
      variant={open ? "default" : "outline"}
      className={cn(open && "bg-emerald-600 hover:bg-emerald-600")}
    >
      {open ? "Caixa aberto" : "Caixa fechado"}
    </Badge>
  );
}
