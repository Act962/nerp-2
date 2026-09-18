"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Building2,
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  ListTree,
  Handshake,
  Lightbulb,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  Route,
  Shield,
  Sparkles,
  Star,
  UserRoundSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Entry = { href: string; label: string; icon: typeof LayoutDashboard };

/**
 * A escolha de recolher a barra fica no navegador de quem usa, e não no banco:
 * é preferência de tela, não dado da conta. Quem administra o site de dois
 * lugares diferentes quer a barra do jeito que combina com CADA tela.
 */
const CHAVE = "site-admin-barra-retraida";

const SITE_ENTRIES: Entry[] = [
  { href: "/site", label: "Painel", icon: LayoutDashboard },
  { href: "/site/menu", label: "Menu", icon: MenuIcon },
  { href: "/site/areas", label: "Áreas", icon: LayoutGrid },
  { href: "/site/paginas", label: "Páginas", icon: ListTree },
  { href: "/site/midia", label: "Mídia", icon: ImageIcon },
  { href: "/site/parceiros", label: "Parceiros", icon: Handshake },
  { href: "/site/leads", label: "Leads", icon: UserRoundSearch },
  { href: "/site/precos", label: "Faixas do Astro", icon: Sparkles },
  { href: "/site/animacoes", label: "Animações", icon: PlayCircle },
];

/**
 * O painel do dono da plataforma, separado do painel do SITE de propósito:
 * acima se edita o que o visitante vê, aqui se olha o que os clientes fazem e
 * quanto custam. Mesmo login, assuntos diferentes.
 */
const PLATAFORMA_ENTRIES: Entry[] = [
  { href: "/site/empresas", label: "Empresas", icon: Building2 },
  { href: "/site/stars", label: "Stars", icon: Star },
  { href: "/site/jornadas", label: "Jornadas", icon: Route },
  { href: "/site/melhorias", label: "Melhorias", icon: Lightbulb },
];

/**
 * Todo endereço que a barra desenha — inclusive "Acessos", que só aparece para
 * quem administra. Centralizar uma aba que não está na tela é inofensivo: o
 * `querySelector` não a encontra e a conta não acontece.
 */
const TODAS_AS_ABAS = [
  ...SITE_ENTRIES.map((e) => e.href),
  ...PLATAFORMA_ENTRIES.map((e) => e.href),
  "/site/acessos",
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

  /*
    Começa aberta e só recolhe depois de ler o navegador, num efeito: ler o
    `localStorage` durante a renderização faria o servidor desenhar uma barra e
    o cliente outra, que é erro de hidratação.
  */
  const [retraida, setRetraida] = useState(false);
  useEffect(() => {
    try {
      setRetraida(localStorage.getItem(CHAVE) === "1");
    } catch {
      // Navegador com armazenamento bloqueado: a barra fica aberta, e só.
    }
  }, []);

  const alternar = () => {
    setRetraida((v) => {
      try {
        localStorage.setItem(CHAVE, v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  /**
   * No retrato a barra vira uma tira que rola de lado, e as abas da Plataforma
   * ficam depois do fim da tela: quem abria /site/stars no celular via a tira
   * começando em "Painel", sem nenhum sinal de onde estava. Trazer a aba ativa
   * para o centro resolve isso sem custar altura, que é o que falta num
   * telefone.
   */
  const tira = useRef<HTMLElement>(null);
  useEffect(() => {
    const barra = tira.current;
    if (!barra) return;

    // A aba ativa é a de href mais LONGO que casa com o endereço: "/site"
    // casaria com tudo, e a barra centralizaria sempre o "Painel".
    const alvo = TODAS_AS_ABAS.filter((href) =>
      href === "/site" ? pathname === "/site" : pathname.startsWith(href),
    ).sort((a, b) => b.length - a.length)[0];
    if (!alvo) return;

    // Num quadro depois: no primeiro a barra ainda não tem a largura final
    // (fonte e ícones acabando de entrar), e a conta saía por poucos pixels —
    // era o que deixava a aba "quase" visível.
    const quadro = requestAnimationFrame(() => {
      const link = barra.querySelector<HTMLAnchorElement>(
        `a[href="${CSS.escape(alvo)}"]`,
      );
      if (!link) return;
      const dele = link.getBoundingClientRect();
      const dela = barra.getBoundingClientRect();
      // Centraliza. Em telas largas a barra não rola e `scrollLeft` ignora.
      barra.scrollLeft += dele.left - dela.left - (dela.width - dele.width) / 2;
    });
    return () => cancelAnimationFrame(quadro);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/site" ? pathname === "/site" : pathname.startsWith(href);

  return (
    <div className="flex min-h-svh flex-col bg-muted/40 md:flex-row">
      <aside
        ref={tira}
        className={cn(
          "flex shrink-0 gap-1 overflow-x-auto bg-[#30aafd] p-3 text-white/85 md:flex-col md:overflow-visible md:p-4 md:transition-[width]",
          // Só no desktop: no retrato a barra já é uma tira que rola de lado,
          // e recolher uma tira horizontal não devolve espaço nenhum.
          retraida ? "md:w-[4.5rem] md:items-center" : "md:w-60",
        )}
      >
        <div className="flex items-center gap-2 px-2 md:pb-4">
          {!retraida && (
            <>
              {/*
                Logotipo oficial da ÓRBITA, transformado em preto pelo filtro:
                o arquivo original é branco (é o único que existe) e
                `brightness(0)` zera todos os canais. Sem arquivo novo, e no dia
                que existir uma versão preta oficial é só trocar o `src`.
              */}
              {/* biome-ignore lint/performance/noImgElement: asset fixo do admin, sem otimização a fazer */}
              <img
                src="/orbita-hub.svg"
                alt="ÓRBITA HUB"
                className="h-6 w-auto md:h-7"
                style={{ filter: "brightness(0)" }}
              />
            </>
          )}
          <button
            type="button"
            onClick={alternar}
            title={retraida ? "Expandir o menu" : "Recolher o menu"}
            aria-label={retraida ? "Expandir o menu" : "Recolher o menu"}
            aria-expanded={!retraida}
            className="hidden shrink-0 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white md:ml-auto md:block"
          >
            {retraida ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        <Secao retraida={retraida}>Site</Secao>

        {SITE_ENTRIES.map((entry) => (
          <NavLink
            key={entry.href}
            entry={entry}
            active={isActive(entry.href)}
            retraida={retraida}
          />
        ))}

        <Secao retraida={retraida}>Plataforma</Secao>

        {PLATAFORMA_ENTRIES.map((entry) => (
          <NavLink
            key={entry.href}
            entry={entry}
            active={isActive(entry.href)}
            retraida={retraida}
          />
        ))}

        {canManageAccess && (
          <>
            <Secao retraida={retraida}>Conta</Secao>
            <NavLink
              entry={{ href: "/site/acessos", label: "Acessos", icon: Shield }}
              active={isActive("/site/acessos")}
              retraida={retraida}
            />
          </>
        )}

        <div className="hidden w-full md:mt-auto md:block md:border-t md:border-white/25 md:pt-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            title="Ver o site"
            className={cn(
              "flex items-center gap-2 rounded-lg py-2 text-xs text-white/80 hover:text-white",
              retraida ? "justify-center px-0" : "px-2",
            )}
          >
            <ExternalLink className="size-3.5 shrink-0" />
            {!retraida && "Ver o site"}
          </a>
          {!retraida && (
            <div className="px-2 pt-2 text-xs">
              <p className="truncate text-white">{name}</p>
              <p className="text-[11px] text-white/70">{role}</p>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}

/**
 * O título de grupo some com a barra recolhida — sem os rótulos ao lado ele
 * viraria uma palavra solta sobre ícones, rotulando o que não se lê.
 */
function Secao({
  retraida,
  children,
}: {
  retraida: boolean;
  children: ReactNode;
}) {
  if (retraida) return null;
  return (
    <p className="hidden px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 md:block">
      {children}
    </p>
  );
}

function NavLink({
  entry,
  active,
  retraida,
}: {
  entry: Entry;
  active: boolean;
  retraida: boolean;
}) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      // Recolhida, o rótulo vira `title`: o ícone sozinho não diz "Parceiros",
      // e passar o mouse é o único jeito que sobra de descobrir.
      title={retraida ? entry.label : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg py-2 text-sm whitespace-nowrap transition-colors",
        retraida ? "md:justify-center md:px-2 px-3" : "px-3",
        active
          ? "bg-white/25 text-white"
          : "text-white/85 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {/* No retrato a tira é horizontal e o rótulo cabe: só o desktop recolhe. */}
      <span className={cn(retraida && "md:hidden")}>{entry.label}</span>
    </Link>
  );
}
