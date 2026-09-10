"use client";

import { CheckCircle2, Circle, Compass, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useOnboardingStatus } from "../hooks/use-onboarding";

const CHAVE_DISPENSADO = "nerp:guia:dispensado";

/**
 * "Seu guia": os passos por solução de interesse, com o que já foi feito
 * calculado por contagens. Some ao dispensar ou quando tudo estiver feito.
 */
export function GuiaCard() {
  const { data } = useOnboardingStatus();
  const [dispensado, setDispensado] = useState(true);

  useEffect(() => {
    try {
      setDispensado(localStorage.getItem(CHAVE_DISPENSADO) === "1");
    } catch {
      setDispensado(false);
    }
  }, []);

  if (dispensado || !data || data.guia.total === 0) return null;
  if (data.guia.feitos === data.guia.total) return null;

  const dispensar = () => {
    setDispensado(true);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {}
  };

  const pct = Math.round((data.guia.feitos / data.guia.total) * 100);

  return (
    <div className="relative flex flex-col gap-3 rounded-xl border p-4 sm:p-5">
      <button
        type="button"
        onClick={dispensar}
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Dispensar o guia"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-2">
        <Compass className="size-5 text-primary" />
        <h2 className="font-semibold">Seu guia</h2>
        <span className="text-muted-foreground text-sm">
          {data.guia.feitos} de {data.guia.total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {data.guia.passos.map((passo) => (
          <li key={passo.id}>
            <Link
              href={passo.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              {passo.feito ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span
                className={
                  passo.feito ? "text-muted-foreground line-through" : ""
                }
              >
                {passo.titulo}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
