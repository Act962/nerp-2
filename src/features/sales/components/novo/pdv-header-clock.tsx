"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

// Relógio + data curtos do PDV. Fica no header (bloco direito, antes da
// Balança) — foi movido pra cá pra liberar altura da antiga CaixaInfoBar
// que ocupava uma faixa branca no topo do /vendas/novo.
export function PdvHeaderClock() {
  const [now, setNow] = useState<Date | null>(null);
  // Só inicia no cliente pra evitar mismatch de hidratação com o relógio.
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden items-center gap-1.5 text-sm tabular-nums md:flex">
      <Clock className="size-4 text-muted-foreground" />
      <span className="font-semibold">
        {now ? now.toLocaleTimeString("pt-BR") : "--:--:--"}
      </span>
      <span className="text-muted-foreground capitalize">
        {now
          ? now.toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
            })
          : ""}
      </span>
    </div>
  );
}
