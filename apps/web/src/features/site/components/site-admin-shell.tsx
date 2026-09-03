"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  ListTree,
  Menu as MenuIcon,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Entry = { href: string; label: string; icon: typeof LayoutDashboard };

const SITE_ENTRIES: Entry[] = [
  { href: "/site", label: "Painel", icon: LayoutDashboard },
  { href: "/site/menu", label: "Menu", icon: MenuIcon },
  { href: "/site/paginas", label: "Páginas", icon: ListTree },
  { href: "/site/midia", label: "Mídia", icon: ImageIcon },
];

export function SiteAdminShell({
  children,
  name,
  role,
  canManageAccess,
}: {
  children: ReactNode;
  name: string;
  role: string;
  canManageAccess: boolean;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/site" ? pathname === "/site" : pathname.startsWith(href);

  return (
    <div className="flex min-h-svh flex-col bg-muted/40 md:flex-row">
      <aside className="flex shrink-0 gap-1 overflow-x-auto bg-[#30aafd] p-3 text-white/85 md:w-60 md:flex-col md:overflow-visible md:p-4">
        <div className="flex items-center px-2 md:pb-4">
          {/*
            Logotipo oficial da ÓRBITA, transformado em preto pelo filtro:
            o arquivo original é branco (é o único que existe) e `brightness(0)`
            zera todos os canais. Sem arquivo novo, e no dia que existir uma
            versão preta oficial é só trocar o `src`.
          */}
          {/* biome-ignore lint/performance/noImgElement: asset fixo do admin, sem otimização a fazer */}
          <img
            src="/orbita-hub.svg"
            alt="ÓRBITA HUB"
            className="h-6 w-auto md:h-7"
            style={{ filter: "brightness(0)" }}
          />
        </div>

        <p className="hidden px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 md:block">
          Site
        </p>

        {SITE_ENTRIES.map((entry) => (
          <NavLink
            key={entry.href}
            entry={entry}
            active={isActive(entry.href)}
          />
        ))}

        {canManageAccess && (
          <>
            <p className="hidden px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 md:block">
              Conta
            </p>
            <NavLink
              entry={{ href: "/site/acessos", label: "Acessos", icon: Shield }}
              active={isActive("/site/acessos")}
            />
          </>
        )}

        <div className="hidden md:mt-auto md:block md:border-t md:border-white/25 md:pt-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-white/80 hover:text-white"
          >
            <ExternalLink className="size-3.5" />
            Ver o site
          </a>
          <div className="px-2 pt-2 text-xs">
            <p className="truncate text-white">{name}</p>
            <p className="text-[11px] text-white/70">{role}</p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}

function NavLink({ entry, active }: { entry: Entry; active: boolean }) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
        active
          ? "bg-white/25 text-white"
          : "text-white/85 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="size-4" />
      {entry.label}
    </Link>
  );
}
