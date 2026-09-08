"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/features/financeiro/lib/money";
import {
  ATALHOS,
  type Periodo,
  paraDate,
  paraDia,
} from "@/features/financeiro/lib/periodo";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { pt } from "react-day-picker/locale";

/**
 * Seletor de período do financeiro.
 *
 * Fica no topo da página, acima das abas, e vale para as quatro que falam de
 * período. Só aplica no "Aplicar": mexer no calendário dispara consulta a cada
 * clique, e o primeiro clique de um intervalo é sempre uma data solta — o DRE
 * recarregaria inteiro para um período que o usuário ainda está montando.
 */
export function PeriodFilter({
  value,
  onChange,
}: {
  value: Periodo;
  onChange: (periodo: Periodo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rascunho, setRascunho] = useState<DateRange | undefined>();

  const intervalo = rascunho ?? {
    from: paraDate(value.from),
    to: paraDate(value.to),
  };

  const aplicar = (periodo: Periodo) => {
    onChange(periodo);
    setRascunho(undefined);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(aberto) => {
        setOpen(aberto);
        // Fechar sem aplicar descarta o rascunho: reabrir mostra o período que
        // está valendo, não a meia seleção abandonada.
        if (!aberto) setRascunho(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start gap-2">
          <CalendarIcon className="size-4 shrink-0" />
          <span className="tabular-nums">
            {formatDate(value.from)} – {formatDate(value.to)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-fit overflow-hidden p-0">
        <div className="hidden w-40 flex-col gap-0.5 border-r px-2 py-2 sm:flex">
          {ATALHOS.map((atalho) => (
            <Button
              key={atalho.label}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => aplicar(atalho.periodo())}
            >
              {atalho.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-col">
          <Calendar
            mode="range"
            defaultMonth={intervalo.from}
            selected={intervalo}
            onSelect={setRascunho}
            numberOfMonths={2}
            locale={pt}
            className="border-none"
          />
          <div className="flex justify-end gap-2 border-t px-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              // Sem as duas pontas não há intervalo — aplicar aqui mandaria
              // `to` vazio e o servidor devolveria de "from" até o infinito.
              disabled={!intervalo.from || !intervalo.to}
              onClick={() => {
                if (!intervalo.from || !intervalo.to) return;
                aplicar({
                  from: paraDia(intervalo.from),
                  to: paraDia(intervalo.to),
                });
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
