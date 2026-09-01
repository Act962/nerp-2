"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Navegação da seção de Estoque. Links de verdade, não Tabs do shadcn: cada
// aba é uma ROTA própria, então o coletor abre direto no celular do operador
// sem passar pela lista de movimentações.
const TABS = [
  { href: "/estoque/movimentacoes", label: "Movimentações" },
  { href: "/estoque/entradas", label: "Entradas" },
  { href: "/estoque/coletor", label: "Coletor" },
  { href: "/estoque/inventarios", label: "Inventários" },
];

export function EstoqueTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
