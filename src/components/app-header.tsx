"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PdvHeaderActions } from "@/features/sales/components/novo/pdv-header-actions";
import { SidebarTrigger } from "./ui/sidebar";
import { ModeToggle } from "./mode-toggle";

// No PDV (tela cheia) a busca global do topo só distrai — a busca de produto
// fica dentro da própria tela de venda; e os botões Balança/Atalhos vêm pra cá.
const PDV_ROUTE = "/vendas/novo";

export function AppHeader() {
  const pathname = usePathname();
  const isPdv = pathname === PDV_ROUTE;
  const showSearch = !isPdv;

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
        <ModeToggle />
      </div>
    </header>
  );
}
