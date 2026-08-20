"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Rotas de tela cheia (PDV) onde o breadcrumb só polui.
const HIDE_BREADCRUMB_ON = ["/vendas/novo"];
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
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <div
              key={breadcrumb.href + "-" + index}
              className="flex items-center gap-2"
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
