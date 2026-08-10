"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { Clock, CreditCard, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCaixaCurrent } from "../hooks/use-caixa";

// "Tipo de usuário" no contexto do caixa. member = operador comum.
const ROLE_LABEL: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  member: "Operador",
};

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  // Só inicia no cliente para evitar mismatch de hidratação com o relógio.
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Cabeçalho do PDV: quem está operando, seu tipo, qual caixa e o horário atual.
export function CaixaInfoBar() {
  const { member } = useCurrentMember();
  const { session } = useCaixaCurrent();
  const now = useNow();

  const roleLabel = member ? (ROLE_LABEL[member.role] ?? member.role) : "";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          <span className="font-medium">{member?.name ?? "—"}</span>
          {roleLabel && <Badge variant="secondary">{roleLabel}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          {session ? (
            <>
              <span className="font-medium">{session.registerName}</span>
              <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">
                Aberto
              </Badge>
            </>
          ) : (
            <span className="text-muted-foreground">Nenhum caixa aberto</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 tabular-nums">
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
        {!session && (
          <Button asChild size="sm">
            <Link href="/vendas/caixa">Abrir caixa</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
