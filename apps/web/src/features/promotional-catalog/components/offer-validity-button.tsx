"use client";

import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type CatalogConfig, isOfferExpired } from "../types";

// Formata sem `toLocaleString` de propósito: o valor vai no `title`, que também
// é renderizado no servidor — locale do Node divergindo do browser hidrataria
// diferente.
function formatValidity(isoLocal: string) {
  const [date, time] = isoLocal.split("T");
  const [year, month, day] = (date ?? "").split("-");
  if (!year || !month || !day) return isoLocal;
  return time ? `${day}/${month}/${year} ${time}` : `${day}/${month}/${year}`;
}

// Validade da oferta DESTA página: controla só a expiração no link público
// (a página some quando vence) — não aparece na arte.
export function OfferValidityButton({
  config,
  onConfigChange,
}: {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}) {
  const expired = isOfferExpired(config);
  const summary = config.offerValidUntil
    ? expired
      ? `Página vencida em ${formatValidity(config.offerValidUntil)}`
      : `Válida até ${formatValidity(config.offerValidUntil)}`
    : "Validade da oferta (desta página)";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={summary}
          aria-label={summary}
          className={cn(
            "h-9 w-9 shrink-0 rounded-lg",
            config.offerValidUntil &&
              (expired
                ? "border-destructive/60 text-destructive"
                : "border-primary/60 text-primary"),
          )}
        >
          <CalendarClock className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="page-validity" className="text-[13px]">
            Validade da oferta (desta página)
          </Label>
          {config.offerValidUntil && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onConfigChange({ offerValidUntil: undefined })}
            >
              Limpar
            </Button>
          )}
        </div>
        <Input
          id="page-validity"
          type="datetime-local"
          className="h-9"
          value={config.offerValidUntil ?? ""}
          onChange={(e) =>
            onConfigChange({ offerValidUntil: e.target.value || undefined })
          }
        />
        <p className="text-[11px] text-muted-foreground">
          {config.offerValidUntil
            ? expired
              ? "⚠️ Página vencida — fica oculta no link público."
              : "Após esta data, esta página some do link público."
            : "Sem prazo. Defina uma data/hora para expirar esta página."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
