"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Rotas de tela cheia (PDV, chat) onde o breadcrumb só polui.
//
// `/whatsapp` entra na lista EXATA, não na de prefixos: a caixa de entrada
// ocupa a altura toda e a linha do breadcrumb empurra a conversa para fora da
// dobra, mas `/whatsapp/agenda` e `/whatsapp/automacoes` são páginas comuns e
// se beneficiam dela.
const HIDE_BREADCRUMB_ON = ["/vendas/novo", "/whatsapp"];
// Editores em tela cheia (têm cabeçalho próprio): esconde o breadcrumb.
const HIDE_BREADCRUMB_PREFIXES = ["/catalogo-promocional/"];

export function BreadcrumbNav() {
  const pathname = usePathname();
  if (
    HIDE_BREADCRUMB_ON.includes(pathname) ||
    HIDE_BREADCRUMB_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
    return null;
  const segments = pathname.split("/").filter(Boolean);

  const breadcrumbs = [
    { name: "Home", href: "/dashboard" },
    ...segments.map((segment, index) => ({
      name: segment.charAt(0).toUpperCase() + segment.slice(1),
      href: `/${segments.slice(0, index + 1).join("/")}`,
    })),
  ];

  return (
    // A trilha FICA no celular: sem ela, e com o título em `sr-only`, a tela
    // não teria nenhuma identificação — quem chega por link não saberia onde
    // está. O "Home" é que sai (ver abaixo), porque o botão de menu já cobre.
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <div
              key={breadcrumb.href + "-" + index}
              // O item "Home" some no celular: o ícone de menu no topo já leva
              // à navegação, e um alvo de toque a mais no caminho só atrapalha.
              // O RESTO da trilha fica — com o título agora em `sr-only`, é ela
              // que diz em que página se está.
              className={cn(
                "flex items-center gap-2",
                index === 0 && "max-sm:hidden",
              )}
            >
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{breadcrumb.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={breadcrumb.href}>
                      {index === 0 ? (
                        <Home className="h-4 w-4" />
                      ) : (
                        breadcrumb.name
                      )}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              )}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
