"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { useCaixaCurrent } from "@/features/caixa/hooks/use-caixa";
import { CreditCard, UserRound } from "lucide-react";
import Link from "next/link";

// "Tipo de usuário" no contexto do caixa. member = operador comum.
const ROLE_LABEL: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  member: "Operador",
};

// Bloco esquerdo do header quando na tela do PDV: quem está operando +
// caixa atual. Substitui a antiga faixa branca `CaixaInfoBar` no topo do
// /vendas/novo pra ganhar altura vertical na tela de venda.
export function PdvHeaderInfo() {
  const { member } = useCurrentMember();
  const { session } = useCaixaCurrent();
  const roleLabel = member ? (ROLE_LABEL[member.role] ?? member.role) : "";

  return (
    <div className="hidden items-center gap-x-4 gap-y-1 text-sm md:flex md:flex-wrap">
      <div className="flex items-center gap-1.5">
        <UserRound className="size-4 text-muted-foreground" />
        <span className="font-medium">{member?.name ?? "—"}</span>
        {roleLabel && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
            {roleLabel}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <CreditCard className="size-4 text-muted-foreground" />
        {session ? (
          <>
            <span className="font-medium">{session.registerName}</span>
            <Badge className="h-5 border-transparent bg-emerald-600 px-1.5 text-[11px] text-white hover:bg-emerald-600">
              Aberto
            </Badge>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Nenhum caixa aberto</span>
            <Button asChild size="sm" variant="outline" className="h-7 px-2">
              <Link href="/vendas/caixa">Abrir caixa</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
