// Registro central das páginas que exigem permissão. Toda nova página admin
// deve declarar sua chave aqui para entrar no painel de "Permissões".
export const PAGE_PERMISSIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    key: "pedidos",
    label: "Pedidos (cozinha)",
    href: "/pedidos",
  },
  {
    key: "vendas",
    label: "Frente de caixa",
    href: "/vendas",
  },
  {
    key: "produtos",
    label: "Produtos",
    href: "/produtos",
  },
  {
    key: "estoque",
    label: "Estoque",
    href: "/estoque",
  },
  {
    key: "clientes",
    label: "Clientes",
    href: "/clientes",
  },
  {
    key: "catalogo",
    label: "Catálogo Online",
    href: "/catalogo",
  },
  {
    key: "catalogo-promocional",
    label: "Catálogo Promocional",
    href: "/catalogo-promocional",
  },
  {
    key: "fornecedores",
    label: "Fornecedores",
    href: "/fornecedores",
  },
  {
    key: "lojas",
    label: "Lojas e Mapas",
    href: "/lojas",
  },
  {
    key: "books",
    label: "Books de PDV",
    href: "/books",
  },
  {
    key: "trade-cadastros",
    label: "Cadastros de Trade",
    href: "/trade/cadastros",
  },
  {
    key: "catalogo-pdv",
    label: "Catálogo PDV",
    href: "/trade/catalogo-pdv",
  },
  {
    key: "promotor",
    label: "Promotor (captura)",
    href: "/promotor",
  },
  {
    key: "planograma",
    label: "Planograma",
    href: "/trade/planograma",
  },
  {
    key: "colaboradores",
    label: "Colaboradores",
    href: "/colaboradores",
  },
  {
    key: "ranking",
    label: "Ranking de Equipes",
    href: "/ranking",
  },
  {
    key: "configuracoes",
    label: "Configurações",
    href: "/configuracoes",
  },
] as const;

export type PagePermissionKey = (typeof PAGE_PERMISSIONS)[number]["key"];

export const PAGE_PERMISSION_KEYS = PAGE_PERMISSIONS.map((p) => p.key);

// Permissões de AÇÃO (não abrem página, não entram no menu): liberam um botão
// específico. Aparecem no painel de Permissões junto com as de página.
export const ACTION_PERMISSIONS = [
  {
    key: "books-aprovar",
    label: "Aprovar fotos de Books",
  },
] as const;

export type ActionPermissionKey = (typeof ACTION_PERMISSIONS)[number]["key"];

// Tudo que um admin pode atribuir a um membro no painel de Permissões.
export const ASSIGNABLE_PERMISSIONS: { key: string; label: string }[] = [
  ...PAGE_PERMISSIONS.map((page) => ({ key: page.key, label: page.label })),
  ...ACTION_PERMISSIONS.map((action) => ({
    key: action.key,
    label: action.label,
  })),
];

// Cargos oferecidos ao convidar/alterar um membro. "owner" existe no plugin
// organization mas fica de fora: virar dono é transferência, não convite.
export const INVITABLE_ROLE_VALUES = ["admin", "member"] as const;

export type InvitableRole = (typeof INVITABLE_ROLE_VALUES)[number];

export const INVITABLE_ROLES: {
  value: InvitableRole;
  label: string;
  description: string;
}[] = [
  {
    value: "admin",
    label: "Administrador",
    description: "Vê todas as páginas e gerencia membros e convites.",
  },
  {
    value: "member",
    label: "Membro",
    description: "Vê apenas as páginas liberadas nas permissões.",
  },
];

// `role` chega do banco como string livre; estreita para um cargo convidável.
export function toInvitableRole(
  role: string | null | undefined,
): InvitableRole {
  return INVITABLE_ROLE_VALUES.find((value) => value === role) ?? "member";
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  member: "Membro",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return ROLE_LABELS.member;
  return ROLE_LABELS[role] ?? role;
}

// Roles do plugin organization do Better Auth que sempre veem tudo.
const ROLES_WITH_FULL_ACCESS = new Set(["owner", "admin"]);

export function hasFullAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  return ROLES_WITH_FULL_ACCESS.has(role);
}

interface MemberLike {
  role: string;
  permissions: string[] | null | undefined;
}

export function memberHasPermission(
  member: MemberLike | null | undefined,
  key: PagePermissionKey,
): boolean {
  if (!member) return false;
  if (hasFullAccess(member.role)) return true;
  return (member.permissions ?? []).includes(key);
}

// Versão genérica pra permissões de ação (chave livre, ex.: "books-aprovar").
export function memberCan(
  member: MemberLike | null | undefined,
  key: string,
): boolean {
  if (!member) return false;
  if (hasFullAccess(member.role)) return true;
  return (member.permissions ?? []).includes(key);
}

// ── Visibilidade de módulos ─────────────────────────────────────────────────
// Camada SEPARADA das permissões: permissão é segurança ("pode acessar"),
// visibilidade é organização da tela ("quero ver"). Esconder um módulo nunca
// bloqueia a rota — quem tiver permissão e a URL continua entrando.

// Dashboard e Configurações não são ocultáveis: sem elas o usuário perderia o
// caminho de volta pra própria tela que religa os módulos.
export const ALWAYS_VISIBLE_MODULE_KEYS = [
  "dashboard",
  "configuracoes",
] as const;

const ALWAYS_VISIBLE_KEYS = new Set<string>(ALWAYS_VISIBLE_MODULE_KEYS);

export const HIDEABLE_MODULES = PAGE_PERMISSIONS.filter(
  (page) => !ALWAYS_VISIBLE_KEYS.has(page.key),
);

export function isModuleHideable(key: string): boolean {
  return !ALWAYS_VISIBLE_KEYS.has(key);
}

interface ModuleVisibilityInput {
  orgDisabledModules?: string[] | null;
  userHiddenModules?: string[] | null;
}

// Um módulo aparece no menu quando as três camadas concordam: tem permissão,
// a empresa usa o módulo, e o usuário não escondeu.
export function isModuleVisible(
  key: string,
  { orgDisabledModules, userHiddenModules }: ModuleVisibilityInput,
): boolean {
  if (!isModuleHideable(key)) return true;
  if ((orgDisabledModules ?? []).includes(key)) return false;
  return !(userHiddenModules ?? []).includes(key);
}

// Resolve a primeira página acessível por uma lista de permissões (para usar
// como fallback de redirect quando o usuário cai numa rota proibida).
export function firstAllowedHref(
  member: MemberLike | null | undefined,
): string | null {
  if (!member) return null;
  if (hasFullAccess(member.role)) return "/dashboard";
  for (const page of PAGE_PERMISSIONS) {
    if ((member.permissions ?? []).includes(page.key)) return page.href;
  }
  return null;
}
