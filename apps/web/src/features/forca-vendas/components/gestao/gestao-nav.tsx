"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/vendas/forca-de-vendas/pedidos", rotulo: "Pedidos" },
  { href: "/vendas/forca-de-vendas/carteiras", rotulo: "Carteiras" },
  { href: "/vendas/forca-de-vendas/vendedores", rotulo: "Vendedores" },
  { href: "/vendas/forca-de-vendas/mapa", rotulo: "Mapa e visitas" },
  { href: "/vendas/forca-de-vendas/avisos", rotulo: "Avisos" },
  {
    href: "/vendas/forca-de-vendas/configuracoes",
    rotulo: "Política comercial",
  },
];

export function GestaoNav() {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
      aria-label="Força de Vendas"
    >
      {ABAS.map((aba) => {
        const ativa = pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
              ativa
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
