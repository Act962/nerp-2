// Registro central das páginas que exigem permissão. Toda nova página admin
// deve declarar sua chave aqui para entrar no painel de "Permissões".
export const PAGE_PERMISSIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    key: "dashboard-org",
    label: "Dashboard da organização (editor)",
    href: "/dashboard-organizacao",
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
    key: "trade-painel",
    label: "Painel do Trade",
    href: "/trade/painel",
  },
  {
    key: "trade-calendario",
    label: "Calendário de Ações",
    href: "/trade/calendario",
  },
  {
    key: "mapa-de-campo",
    label: "Mapa de Campo",
    href: "/trade/mapa-de-campo",
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
    key: "vendedor",
    label: "Vendedor (campo)",
    href: "/vendedor",
  },
  {
    key: "planograma",
    label: "Planograma",
    href: "/trade/planograma",
  },
  {
    key: "qr-preco",
    label: "App QR Preço",
    href: "/trade/qr-preco",
  },
  {
    key: "tradegram",
    label: "TradeGram",
    href: "/trade/tradegram",
  },
  {
    key: "distribuidores",
    label: "Distribuidores",
    href: "/trade/distribuidores",
  },
  {
    key: "diretorio",
    label: "Diretório de Empresas",
    href: "/trade/diretorio",
  },
  {
    key: "cupons",
    label: "Cupons",
    href: "/trade/cupons",
  },
  {
    key: "insights",
    label: "Insights do Cliente",
    href: "/trade/insights",
  },
  {
    key: "plano",
    label: "Plano & Assinatura",
    href: "/trade/plano",
  },
  {
    key: "promotor-vinculos",
    label: "Vínculos de Promotores",
    href: "/trade/promotor-vinculos",
  },
  {
    key: "trade-interesses",
    label: "Interesses (TradeGram)",
    href: "/trade/interesses",
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
    key: "integracoes",
    label: "Integrações",
    href: "/integracoes",
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
  {
    key: "mapa-ver-todos",
    label: "Ver o trajeto de todos os promotores",
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

// ── Cargo no Trade ──────────────────────────────────────────────────────────
// Papel de campo, NÃO permissão. Fica fora do `role` porque o Better Auth
// valida `role` contra os cargos do plugin organization (owner/admin/member) e
// recusaria valores próprios; e porque coordenar o trade não implica ver mais
// páginas — quem decide acesso continua sendo `role` + `permissions`.
export const TRADE_ROLE_VALUES = [
  "COORDENADOR_TRADE",
  "SUPERVISOR",
  "VENDEDOR",
] as const;

export type TradeRoleValue = (typeof TRADE_ROLE_VALUES)[number];

export const TRADE_ROLES: {
  value: TradeRoleValue;
  label: string;
  description: string;
}[] = [
  {
    value: "COORDENADOR_TRADE",
    label: "Coordenador(a) de Trade",
    description: "Aprova as fotos dos promotores e responde pelas indústrias.",
  },
  {
    value: "SUPERVISOR",
    label: "Supervisor",
    description: "Acompanha os promotores em campo.",
  },
  {
    value: "VENDEDOR",
    label: "Vendedor(a)",
    description:
      "Vende em campo. Abre o App Vendedor com a aba 'Estou aqui' pra registrar presença ao vivo.",
  },
];

export function tradeRoleLabel(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return TRADE_ROLES.find((role) => role.value === value)?.label ?? value;
}

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

interface CalendarManagerLike extends MemberLike {
  tradeRole?: string | null;
}

/**
 * Pode criar/editar eventos do calendário.
 *
 * Três portas: owner/admin, quem tem cargo no Trade (coordenação/supervisão) e
 * quem recebeu a permissão da página. Promotor sem nenhuma delas só lê e cria
 * as próprias anotações.
 *
 * Vive aqui, e não no `org-access.ts`, porque componentes "use client"
 * precisam da mesma resposta para mostrar ou não o botão "Novo evento" — e
 * aquele arquivo é `server-only`.
 */
function isFieldLeadership(
  member: CalendarManagerLike | null | undefined,
): boolean {
  if (!member) return false;
  if (hasFullAccess(member.role)) return true;
  return Boolean(member.tradeRole);
}

export function canManageCalendar(
  member: CalendarManagerLike | null | undefined,
): boolean {
  return isFieldLeadership(member) || memberCan(member, "trade-calendario");
}

/**
 * Vê o trajeto dos OUTROS no Mapa de Campo. Quem não passa aqui abre a página
 * normalmente, mas enxerga só o próprio dia.
 *
 * Separado da chave da página de propósito: juntar as duas entregaria a um
 * promotor o histórico de localização da equipe inteira só por ele ter o item
 * no menu.
 */
export function canSeeAllTrails(
  member: CalendarManagerLike | null | undefined,
): boolean {
  return isFieldLeadership(member) || memberCan(member, "mapa-ver-todos");
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
