"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { cn } from "@/lib/utils";
import { useVincularConta } from "../hooks/use-vincular-conta";

/**
 * A faixa fixa da conta de teste. Fica até a organização ser verificada;
 * vira alerta quando a expiração já foi avisada (23 dias sem acesso).
 * Texto fixo, sem IA.
 */
export function BannerSandbox() {
  const { member } = useCurrentMember();
  const abrir = useVincularConta((s) => s.abrir);

  if (!member?.sandbox) return null;
  const urgente = member.expiraAvisada;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 text-sm",
        urgente
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/20 bg-primary/5",
      )}
    >
      {urgente ? (
        <AlertTriangle className="size-4 shrink-0" />
      ) : (
        <Sparkles className="size-4 shrink-0 text-primary" />
      )}
      <span className="flex-1">
        {urgente
          ? "Sua empresa de teste será apagada em breve por falta de uso. Crie sua conta para manter tudo."
          : "Você está numa empresa de teste. Sem acesso por 30 dias, ela é apagada. Crie sua conta com o Google para manter tudo."}
      </span>
      <Button
        size="sm"
        variant={urgente ? "destructive" : "default"}
        onClick={() => abrir()}
      >
        Manter minha empresa
      </Button>
    </div>
  );
}
