"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Indicador de caixa aberto/fechado, reusável no header do PDV.
// Quando há sessão aberta, exibe também o caixa e o operador.
export function CaixaStatusBadge({
  open,
  registerName,
  operatorName,
}: {
  open: boolean;
  registerName?: string;
  operatorName?: string;
}) {
  const showDetails = open && (registerName || operatorName);

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant={open ? "default" : "outline"}
        className={cn(open && "bg-emerald-600 hover:bg-emerald-600")}
      >
        {open ? "Caixa aberto" : "Caixa fechado"}
      </Badge>
      {showDetails && (
        <span className="text-sm text-muted-foreground">
          {[registerName, operatorName].filter(Boolean).join(" · ")}
        </span>
      )}
    </div>
  );
}
