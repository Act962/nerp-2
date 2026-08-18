"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Aperture,
  BookImage,
  Box,
  DollarSign,
  Building,
  Building2,
  CalendarDays,
  Camera,
  ChefHat,
  ChevronDown,
  ChevronsUpDown,
  CreditCard,
  GalleryVerticalEnd,
  Inbox,
  LayoutDashboard,
  Library,
  LayoutGrid,
  LogOut,
  Map as MapIcon,
  MapPinned,
  Megaphone,
  MonitorPlay,
  Package,
  Plug,
  Plus,
  Receipt,
  ScanBarcode,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  Tags,
  Ticket,
  TrendingUp,
  Trophy,
  Truck,
  UserCircle2,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import {
  ALWAYS_VISIBLE_MODULE_KEYS,
  hasFullAccess,
  isModuleVisible,
} from "@/lib/permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "./ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useEffect, useState } from "react";
import type { ActiveOrganization } from "@/lib/auth-types";
import { constructUrl } from "@/hooks/use-construct-url";
import Image from "next/image";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  children?: NavItem[];
};

// Casa a rota atual com o item ou qualquer descendente — usado pra abrir os
// grupos certos quando a página está num sub/sub-item.
function navMatchesPath(item: NavItem, pathname: string): boolean {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }
  return (item.children ?? []).some((child) => navMatchesPath(child, pathname));
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard",
    children: [
      { name: "Meu dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        name: "Dashboard da organização",
        href: "/dashboard-organizacao",
        icon: LayoutDashboard,
        permission: "dashboard-org",
      },
    ],
  },
  {
    name: "Produtos",
    href: "/produtos",
    icon: Package,
    permission: "produtos",
    children: [
      { name: "Produtos", href: "/produtos", icon: Package },
      { name: "Categorias", href: "/produtos/categorias", icon: Tag },
      { name: "Tabelas de preço", href: "/precos", icon: Tags, permission: "precos" },
    ],
  },
  {
    name: "Frente de caixa",
    href: "/vendas/novo",
    icon: ShoppingCart,
    permission: "vendas",
    children: [
      { name: "PDV", href: "/vendas/novo", icon: ScanBarcode },
      { name: "Vendas", href: "/vendas", icon: ShoppingCart },
      {
        name: "Caixa",
        href: "/vendas/caixa",
        icon: CreditCard,
        permission: "caixa",
      },
      {
        name: "Mídia",
        href: "/vendas/midia",
        icon: MonitorPlay,
        permission: "midia-pdv",
      },
      {
        name: "Cupons",
        href: "/vendas/cupons",
        icon: Receipt,
        permission: "cupom-designer",
      },
    ],
  },
  {
    name: "Pedidos",
    href: "/pedidos",
    icon: ChefHat,
    permission: "pedidos",
  },
  {
    name: "Estoque",
    href: "/estoque",
    icon: Box,
    permission: "estoque",
    children: [
      {
        name: "Movimentações",
        href: "/estoque/movimentacoes",
        icon: TrendingUp,
      },
    ],
  },
  {
    name: "Financeiro",
    href: "/financeiro",
    icon: DollarSign,
    permission: "financeiro",
  },
  {
    name: "Clientes",
    href: "/clientes",
    icon: UsersIcon,
    permission: "clientes",
  },
  {
    name: "Fornecedores",
    href: "/fornecedores",
    icon: Building2,
    permission: "fornecedores",
  },
  {
    name: "Trade Marketing",
    href: "/lojas",
    icon: Megaphone,
    children: [
      {
        name: "Painel do Trade",
        href: "/trade/painel",
        icon: LayoutDashboard,
        permission: "trade-painel",
      },
      {
        name: "Calendário de Ações",
        href: "/trade/calendario",
        icon: CalendarDays,
        permission: "trade-calendario",
      },
      {
        name: "Mapa de Campo",
        href: "/trade/mapa-de-campo",
        icon: MapIcon,
        permission: "mapa-de-campo",
      },
      {
        name: "Lojas e Mapas",
        href: "/lojas",
        icon: MapPinned,
        permission: "lojas",
      },
      {
        name: "Books de PDV",
        href: "/books",
        icon: BookImage,
        permission: "books",
        children: [
          { name: "Books", href: "/books", icon: BookImage },
          {
            name: "Padrões de página",
            href: "/padroes",
            icon: BookImage,
          },
        ],
      },
      {
        name: "Cadastros de Trade",
        href: "/trade/cadastros",
        icon: Library,
        permission: "trade-cadastros",
      },
      {
        name: "Catálogo PDV",
        href: "/trade/catalogo-pdv",
        icon: Tag,
        permission: "catalogo-pdv",
      },
      {
        name: "Planograma",
        href: "/trade/planograma",
        icon: LayoutGrid,
        permission: "planograma",
      },
      {
        name: "TradeGram",
        href: "/trade/tradegram",
        icon: Aperture,
        permission: "tradegram",
      },
      {
        name: "Interesses (TradeGram)",
        href: "/trade/interesses",
        icon: Inbox,
        permission: "trade-interesses",
      },
      // Os dois apps de campo ficam juntos no fim da lista: é o par que o
      // gestor abre no celular, não algo que ele configura.
      {
        name: "App Promotor",
        href: "/promotor",
        icon: Camera,
        permission: "promotor",
      },
      {
        // Mesmo motor do App Promotor + aba "Estou aqui" para registrar
        // presença ao vivo — reusa `/vendedor` com `mode='vendedor'`.
        name: "App Vendedor",
        href: "/vendedor",
        icon: MapPinned,
        permission: "vendedor",
      },
      {
        name: "App QR Preço",
        href: "/trade/qr-preco",
        icon: ScanBarcode,
        permission: "qr-preco",
      },
      {
        name: "Configurações",
        href: "/trade/configuracoes",
        icon: Settings,
        children: [
          {
            name: "Distribuidores",
            href: "/trade/distribuidores",
            icon: Truck,
            permission: "distribuidores",
          },
          {
            name: "Diretório de Empresas",
            href: "/trade/diretorio",
            icon: Building2,
            permission: "diretorio",
          },
          {
            name: "Cupons",
            href: "/trade/cupons",
            icon: Ticket,
            permission: "cupons",
          },
          {
            name: "Insights do Cliente",
            href: "/trade/insights",
            icon: TrendingUp,
            permission: "insights",
          },
          {
            name: "Plano & Assinatura",
            href: "/trade/plano",
            icon: CreditCard,
            permission: "plano",
          },
          {
            name: "Vínculos de Promotores",
            href: "/trade/promotor-vinculos",
            icon: UsersIcon,
            permission: "promotor-vinculos",
          },
        ],
      },
    ],
  },
  {
    name: "Colaborador",
    href: "/colaboradores",
    icon: UserCircle2,
    permission: "colaboradores",
  },
  {
    name: "Ranking de Equipes",
    href: "/ranking",
    icon: Trophy,
    permission: "ranking",
  },
  {
    name: "Integrações",
    href: "/integracoes",
    icon: Plug,
    permission: "integracoes",
  },
  {
    name: "Catálogo Online",
    href: "/catalogo",
    icon: Store,
    permission: "catalogo",
  },
  {
    name: "Catálogo Promocional",
    href: "/catalogo-promocional",
    icon: Tag,
    permission: "catalogo-promocional",
  },
  {
    name: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    permission: "configuracoes",
  },
  // {
  //   name: "Relatórios",
  //   href: "/relatorios",
  //   icon: BarChart3,
  // },
  // {
  //   name: "Configurações",
  //   href: "/configuracoes",
  //   icon: Settings,
  // },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  // Em telas mobile, fecha a sidebar ao clicar em uma opção do menu.
  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  // Permissões do member ativo: filtra os itens do menu para que cada usuário
  // veja apenas o que tem acesso. Owner/Admin sempre veem tudo.
  const {
    data: currentMember,
    isPending: isMemberPending,
    isError: isMemberError,
  } = useQuery(orpc.members.getCurrent.queryOptions({ input: {} }));
  const fullAccess = hasFullAccess(currentMember?.role);
  const allowedPermissions = new Set(currentMember?.permissions ?? []);

  // Duas camadas independentes da permissão: a empresa desliga módulos que não
  // usa e o usuário esconde o que não quer ver. Nenhuma das duas bloqueia a
  // rota — só tira do menu.
  const moduleVisibility = {
    orgDisabledModules: currentMember?.orgDisabledModules ?? [],
    userHiddenModules: currentMember?.hiddenModules ?? [],
  };
  const isVisible = (permission?: string) =>
    !permission || isModuleVisible(permission, moduleVisibility);

  // Rede de segurança: se a consulta do member falhar, o filtro esconderia
  // TODOS os itens (nenhuma permissão conhecida) e o usuário ficaria preso
  // numa tela sem navegação. Nesse caso mostra o mínimo pra ele conseguir
  // chegar em Configurações e se recuperar.
  const fallbackNavigation = navigation.filter(
    (item) =>
      item.permission &&
      (ALWAYS_VISIBLE_MODULE_KEYS as readonly string[]).includes(
        item.permission,
      ),
  );

  // Filtra a árvore recursivamente (suporta grupos aninhados, ex.: "Configurações
  // de Trade"). Item com permissão própria é checado individualmente; sem
  // permissão, herda a visibilidade do ancestral. Grupo sem filho visível some.
  const filterNav = (
    item: NavItem,
    ancestorPermitted: boolean,
  ): NavItem | null => {
    if (!isVisible(item.permission)) return null;

    const selfPermitted = item.permission
      ? fullAccess || allowedPermissions.has(item.permission)
      : ancestorPermitted;

    if (!item.children || item.children.length === 0) {
      return selfPermitted ? item : null;
    }

    const children = item.children
      .map((child) => filterNav(child, fullAccess || selfPermitted))
      .filter((child): child is NavItem => child !== null);

    if (children.length === 0) return null;
    return { ...item, children };
  };

  const visibleNavigation = navigation
    .map((item) => filterNav(item, true))
    .filter((item): item is NavItem => item !== null);

  // Menu vazio por falha de carregamento é diferente de menu vazio por falta
  // de permissão: no primeiro caso o usuário perderia até o acesso a
  // Configurações, sem nenhuma pista do que aconteceu.
  const navigationToRender =
    isMemberError || (!currentMember && !isMemberPending)
      ? fallbackNavigation
      : visibleNavigation;

  return (
    <Sidebar collapsible={pathname === "/vendas/novo" ? "offcanvas" : "icon"}>
      <SidebarHeader>
        <OrgMenu />
      </SidebarHeader>
      <SidebarContent className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            {isMemberPending ? (
              <SidebarMenu>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <SidebarMenu>
                {navigationToRender.map((item) => {
                  // const isActive = pathname === item.href;
                  const hasChildren = item.children && item.children.length > 0;

                  if (hasChildren) {
                    return (
                      <Collapsible
                        key={item.name}
                        asChild
                        defaultOpen={navMatchesPath(item, pathname)}
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.name}>
                              {item.icon && (
                                <item.icon
                                  onClick={() => {
                                    router.push(item.href);
                                    handleNavClick();
                                  }}
                                />
                              )}
                              <span>{item.name}</span>
                              <ChevronDown className="ml-auto transition-transform duration-200 data-[state=open]:rotate-180" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children?.map((child) => (
                                <SubItem
                                  key={child.name}
                                  item={child}
                                  pathname={pathname}
                                  onNav={handleNavClick}
                                />
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuButton
                      key={item.name}
                      tooltip={item.name}
                      className={cn(
                        (pathname === item.href ||
                          pathname.startsWith(`${item.href}/`)) &&
                          "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                      asChild
                    >
                      <Link href={item.href} onClick={handleNavClick}>
                        {item.icon && <item.icon />}
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

// Renderiza um filho do menu: link simples (folha) ou um sub-grupo colapsável
// aninhado (ex.: "Configurações de Trade" dentro de Trade Marketing).
function SubItem({
  item,
  pathname,
  onNav,
}: {
  item: NavItem;
  pathname: string;
  onNav: () => void;
}) {
  const hasChildren = !!item.children?.length;

  if (!hasChildren) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          asChild
          className={cn(
            pathname === item.href &&
              "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
        >
          <Link href={item.href} onClick={onNav}>
            <item.icon />
            <span>{item.name}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={navMatchesPath(item, pathname)}>
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton asChild className="cursor-pointer">
            <button type="button">
              <item.icon />
              <span>{item.name}</span>
              <ChevronDown className="ml-auto transition-transform duration-200 data-[state=open]:rotate-180" />
            </button>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children?.map((child) => (
              <SubItem
                key={child.name}
                item={child}
                pathname={pathname}
                onNav={onNav}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function NavUser() {
  const router = useRouter();

  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-10 w-full" />;
  }

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onRequest: () => {
          router.push("/login");
        },
      },
    });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size={"lg"}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border"
            >
              <Avatar>
                {session?.user?.image && (
                  <AvatarImage
                    src={session.user.image}
                    alt={session.user.name}
                  />
                )}
                <AvatarFallback className="rounded-lg">
                  {session?.user?.name?.split(" ")[0][0]}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                {session?.user.name && (
                  <span className="truncate font-medium">
                    {session?.user.name}
                  </span>
                )}
                {session?.user.email && (
                  <span className="truncate text-xs">{session.user.email}</span>
                )}
              </div>
              <ChevronsUpDown className="size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={"right"}
            align="end"
            sideOffset={12}
          >
            <DropdownMenuLabel className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Avatar>
                  {session?.user?.image && (
                    <AvatarImage
                      src={session.user.image}
                      alt={session.user.name}
                    />
                  )}
                  <AvatarFallback className="rounded-lg">
                    {session?.user?.name?.split(" ")[0][0]}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  {session?.user.name && (
                    <span className="truncate font-medium">
                      {session?.user.name}
                    </span>
                  )}
                  {session?.user.email && (
                    <span className="truncate text-xs text-muted-foreground">
                      {session.user.email}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => handleLogout()}
                className="cursor-pointer"
                variant="destructive"
              >
                <LogOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Logo com fallback: quando `constructUrl` devolve "" (env do bucket público
// ausente) ou quando a chave aponta pro bucket errado (típico ao rodar local
// contra dados de produção), o Next segura o carregamento e o cabeçalho fica
// com um retângulo vazio piscando. Aqui, cair no ícone `Building` no `onError`
// mantém o menu legível mesmo com a imagem quebrada.
function OrgLogo({
  logo,
  name,
  size,
}: {
  logo: string | null | undefined;
  name: string;
  size: number;
}) {
  const url = logo ? constructUrl(logo) : "";
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return <Building className="size-4" />;
  }
  return (
    <Image
      src={url}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-lg"
      onError={() => setBroken(true)}
    />
  );
}

function OrgMenu() {
  const { isMobile } = useSidebar();
  const [organizationActive, setOrganizationActive] =
    useState<ActiveOrganization | null>();
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const { data: organizations } = authClient.useListOrganizations();
  const router = useRouter();
  const queryClient = useQueryClient();

  const selectedOrganization = async (data: {
    orgId: string;
    orgSlug: string;
  }) => {
    const { data: organization, error } =
      await authClient.organization.setActive({
        organizationId: data.orgId,
        organizationSlug: data.orgSlug,
      });

    if (error) {
      toast.error("Erro ao tentar trocar de empresa!");
      return;
    }

    setOrganizationActive(organization);
    toast.success("Sucesso!");

    // As chaves do TanStack Query não carregam o id da org — sem isto, telas
    // client-side continuariam mostrando dados da org anterior até o
    // `staleTime` vencer (ou pior, um refetch em background trocando os dados
    // na tela sem o usuário perceber a origem da mudança).
    queryClient.clear();
    router.refresh();
  };

  useEffect(() => {
    const getCurrentOrg = async () => {
      try {
        const { data, error } =
          await authClient.organization.getFullOrganization();
        if (!error && data) {
          setOrganizationActive(data);
        }
      } finally {
        setIsLoadingOrg(false);
      }
    };
    getCurrentOrg();
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
            >
              {isLoadingOrg ? (
                <Skeleton className="size-8 aspect-square rounded-lg" />
              ) : organizationActive?.logo ? (
                <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg border">
                  <OrgLogo
                    logo={organizationActive.logo}
                    name={organizationActive.name ?? "Logo"}
                    size={32}
                  />
                </div>
              ) : (
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <GalleryVerticalEnd className="size-4" />
                </div>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                {isLoadingOrg ? (
                  <Skeleton className="h-4 w-24" />
                ) : organizationActive?.name ? (
                  <span className="truncate font-medium">
                    {organizationActive.name}
                  </span>
                ) : (
                  <span className="truncate font-medium">Nenhuma empresa</span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Empresas
            </DropdownMenuLabel>
            {organizations?.map((org) => (
              <DropdownMenuItem
                key={org.name}
                className="gap-2 p-2 cursor-pointer"
                onClick={() =>
                  selectedOrganization({ orgId: org.id, orgSlug: org.slug })
                }
              >
                <div className="flex size-6 items-center justify-center rounded-md border overflow-hidden">
                  <OrgLogo logo={org.logo} name={org.name} size={24} />
                </div>
                {org.name}
                {/* <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut> */}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2 cursor-pointer" asChild>
              <Link href="/create-organization">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  Criar nova empresa
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
