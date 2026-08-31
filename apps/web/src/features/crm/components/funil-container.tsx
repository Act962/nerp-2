"use client";

import { Loader2, Plug } from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels } from "../hooks/use-funnels";
import { Board } from "./board";

/** Escolhe o funil e mostra o board. Funil na URL, como no chat. */
export function FunilContainer() {
  const { data, isPending } = useFunnels();
  const [funnelId, setFunnelId] = useQueryState("funil");

  const funis = data?.funis ?? [];

  useEffect(() => {
    if (!funnelId && funis.length > 0) setFunnelId(funis[0]?.id ?? null);
  }, [funnelId, funis, setFunnelId]);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando…
      </div>
    );
  }

  if (funis.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-10 text-center">
        <div className="space-y-1">
          <p className="font-medium">Nenhum funil ainda</p>
          <p className="max-w-md text-muted-foreground text-sm">
            O funil organiza os clientes em etapas e recebe as conversas do
            WhatsApp. Crie o primeiro na tela de conexão.
          </p>
        </div>
        <Button asChild>
          <Link href="/whatsapp/conexao">
            <Plug className="size-4" />
            Ir para a conexão
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Select
        value={funnelId ?? undefined}
        onValueChange={(valor) => setFunnelId(valor)}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Selecione o funil" />
        </SelectTrigger>
        <SelectContent>
          {funis.map((funil) => (
            <SelectItem key={funil.id} value={funil.id}>
              {funil.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {funnelId ? <Board funnelId={funnelId} /> : null}
    </div>
  );
}
