"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Menu superior da seção. Cada aba é uma URL própria (compartilhável, com
// back/forward e prefetch) e — o que mais importa — vive no layout de rota, então
// trocar de aba NÃO remonta o editor. Com Tabs do shadcn dentro do componente,
// o Stage do Konva desmontaria e remontaria a cada clique.
// Só abas que existem: link que devolve 404 é pior que aba ausente.
// "Validar", "Lojas" e "Execução" entram nas fases seguintes.
const TABS = [
  { href: "editar", label: "Editar" },
  { href: "visao-geral", label: "Visão geral" },
  { href: "revisoes", label: "Histórico de revisões" },
];

export function PlanogramNav({ planogramId }: { planogramId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const href = `/trade/planograma/${planogramId}/${tab.href}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-primary font-medium text-foreground"
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
