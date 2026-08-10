"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PdvHeaderActions } from "@/features/sales/components/novo/pdv-header-actions";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { ModeToggle } from "./mode-toggle";
import { FullscreenToggle } from "./fullscreen-toggle";

// No PDV (tela cheia) a busca global do topo só distrai — a busca de produto
// fica dentro da própria tela de venda; e os botões Balança/Atalhos vêm pra cá.
const PDV_ROUTE = "/vendas/novo";

export function AppHeader() {
  const pathname = usePathname();
  const isPdv = pathname === PDV_ROUTE;
  const showSearch = !isPdv;
  const { setOpen } = useSidebar();

  // No PDV a sidebar recolhe pra dar espaço à venda — mas só uma vez ao entrar.
  // Sem o guard, o effect re-rodaria e forçaria `false` logo após o usuário
  // reabrir pelo ícone, impedindo que a sidebar volte a aparecer.
  const collapsedForPdv = useRef(false);
  useEffect(() => {
    if (isPdv) {
      if (!collapsedForPdv.current) {
        collapsedForPdv.current = true;
        setOpen(false);
      }
    } else {
      collapsedForPdv.current = false;
    }
  }, [isPdv, setOpen]);

  // No PDV entra em tela cheia. O navegador exige gesto do usuário, então além
  // da tentativa direta, disparamos no primeiro toque/tecla da página.
  useEffect(() => {
    if (!isPdv || document.fullscreenElement) return;
    const enter = () =>
      document.documentElement.requestFullscreen?.().catch(() => {});
    enter();
    const onFirst = () => enter();
    window.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, [isPdv]);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger />
        {showSearch && (
          // No celular o campo espremia o trigger da sidebar sem entregar valor.
          <div className="relative hidden w-full max-w-md md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos, vendas, clientes..."
              className="pl-9"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {isPdv && <PdvHeaderActions />}
        <FullscreenToggle />
        <ModeToggle />
      </div>
    </header>
  );
}
