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
  BookImage,
  Box,
  Building,
  Building2,
  Camera,
  ChefHat,
  ChevronDown,
  ChevronsUpDown,
  GalleryVerticalEnd,
  LayoutDashboard,
  Library,
  LogOut,
  MapPinned,
  Megaphone,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  TrendingUp,
  Trophy,
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
import { useQuery } from "@tanstack/react-query";
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

const navigation: Array<{
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  children?: Array<{
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    permission?: string;
  }>;
}> = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard",
  },
  {
    name: "Produtos",
    href: "/produtos",
    icon: Package,
    permission: "produtos",
    children: [
      { name: "Produtos", href: "/produtos", icon: Package },
      { name: "Categorias", href: "/produtos/categorias", icon: Tag },
    ],
  },
  {
    name: "Frente de caixa",
    href: "/vendas",
    icon: ShoppingCart,
    permission: "vendas",
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
  // {
  //   name: "Financeiro",
  //   href: "/financeiro",
  //   icon: DollarSign,
  //   children: [
  //     { name: "Contas a Receber", href: "/financeiro/receber", icon: Inbox },
  //     { name: "Contas a Pagar", href: "/financeiro/pagar", icon: Receipt },
  //     { name: "Fluxo de Caixa", href: "/financeiro/fluxo", icon: CreditCard },
  //   ],
  // },
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
        name: "Promotor",
        href: "/promotor",
        icon: Camera,
        permission: "promotor",
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

  type NavItem = (typeof navigation)[number];

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

  const visibleNavigation = navigation
    .map((item): NavItem | null => {
      // Esconder o pai esconde a subárvore inteira. Precisa vir antes do filtro
      // dos filhos: o `fullAccess` lá embaixo aprova o filho sozinho, então sem
      // este corte desligar "Produtos"/"Estoque" não teria efeito nenhum para
      // owner/admin — justamente quem configura os módulos.
      if (!isVisible(item.permission)) return null;

      const parentPermitted =
        fullAccess ||
        !item.permission ||
        allowedPermissions.has(item.permission);

      if (!item.children) {
        return parentPermitted ? item : null;
      }

      // Filtra os filhos: filhos com permissão própria são checados
      // individualmente; filhos sem permissão herdam a visibilidade do pai.
      const children = item.children.filter((child) => {
        if (!isVisible(child.permission)) return false;
        if (fullAccess) return true;
        if (child.permission) return allowedPermissions.has(child.permission);
        return parentPermitted;
      });

      if (children.length === 0) return null;
      return { ...item, children };
    })
    .filter((item): item is NavItem => item !== null);

  // Menu vazio por falha de carregamento é diferente de menu vazio por falta
  // de permissão: no primeiro caso o usuário perderia até o acesso a
  // Configurações, sem nenhuma pista do que aconteceu.
  const navigationToRender =
    isMemberError || (!currentMember && !isMemberPending)
      ? fallbackNavigation
      : visibleNavigation;

  return (
    <Sidebar collapsible="icon">
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
                        defaultOpen={
                          pathname === item.href ||
                          pathname.startsWith(item.href + "/") ||
                          item.children?.some(
                            (child) =>
                              pathname === child.href ||
                              pathname.startsWith(child.href + "/"),
                          )
                        }
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
                                <SidebarMenuSubItem key={child.name}>
                                  <SidebarMenuSubButton
                                    asChild
                                    className={cn(
                                      pathname === child.href &&
                                        "bg-sidebar-accent text-sidebar-accent-foreground",
                                    )}
                                  >
                                    <Link
                                      href={child.href}
                                      onClick={handleNavClick}
                                    >
                                      <child.icon />
                                      <span>{child.name}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
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
                          pathname.startsWith(item.href + "/")) &&
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

function OrgMenu() {
  const { isMobile } = useSidebar();
  const [organizationActive, setOrganizationActive] =
    useState<ActiveOrganization | null>();
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const { data: organizations } = authClient.useListOrganizations();
  const router = useRouter();

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
    }

    setOrganizationActive(organization);
    toast.success("Sucesso!");

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
                <Image
                  src={constructUrl(organizationActive.logo)}
                  width={32}
                  height={32}
                  alt="Logo"
                  className="size-8 aspect-square rounded-lg"
                />
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
                  {org.logo ? (
                    <Image
                      src={constructUrl(org.logo)}
                      alt={org.name}
                      width={16}
                      height={16}
                      className="size-6"
                    />
                  ) : (
                    <Building className="size-4" />
                  )}
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
