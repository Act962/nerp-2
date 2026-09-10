"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useVincularConta } from "../hooks/use-vincular-conta";

export function AbrirVinculo({ motivo }: { motivo: string | null }) {
  const abrir = useVincularConta((s) => s.abrir);
  useEffect(() => {
    abrir(motivo ?? undefined);
  }, [abrir, motivo]);
  return (
    <div className="flex gap-2">
      <Button onClick={() => abrir(motivo ?? undefined)}>
        Continuar com o Google
      </Button>
      <Button asChild variant="ghost">
        <Link href="/dashboard">Voltar</Link>
      </Button>
    </div>
  );
}
