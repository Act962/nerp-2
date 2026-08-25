import "server-only";

import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";

// Resolução do dashboard da organização e do que o member pode ver dele.
//
// Regras:
//  - Owner/admin ignora `OrgDashboardMemberPermission` — veem todos os
//    widgets (mesma semântica de `hasFullAccess` no resto do sistema).
//  - Outros roles: precisam de linha explícita em `OrgDashboardMemberPermission`
//    para cada widget. Sem linha = deny.
//  - Widgets aninhados: se o pai não é visível, o filho também não é,
//    independente da permissão dele.

export interface MemberContext {
  memberId: string;
  role: string;
}

/**
 * Devolve o Set de IDs de widgets do OrgDashboard que este member pode ver.
 * `null` quando o dashboard não existe. `Set` vazio quando existe mas o
 * member não vê nada — a UI deve esconder a aba nesse caso.
 */
export async function visibleOrgWidgetIds(
  organizationId: string,
  member: MemberContext,
): Promise<Set<string> | null> {
  const dashboard = await prisma.orgDashboard.findUnique({
    where: { organizationId },
    select: {
      widgets: {
        select: { id: true, parentId: true },
      },
    },
  });
  if (!dashboard) return null;

  const allIds = new Set(dashboard.widgets.map((widget) => widget.id));
  if (allIds.size === 0) return new Set();

  // Owner/admin: vê tudo, sem consultar a tabela de permissões.
  if (hasFullAccess(member.role)) {
    return applyParentGate(dashboard.widgets, allIds);
  }

  // Filtra por widgets ESTE dashboard: `orgDashboardMemberPermission` também
  // pode ter linhas de dashboards antigos (raro, mas ficaria com id "orfão"
  // se um widget for apagado e recriado). Restringir ao Set de ids atuais
  // fecha essa porta.
  const rows = await prisma.orgDashboardMemberPermission.findMany({
    where: {
      memberId: member.memberId,
      orgDashboardWidgetId: { in: [...allIds] },
    },
    select: { orgDashboardWidgetId: true },
  });
  const permitted = new Set(rows.map((row) => row.orgDashboardWidgetId));
  return applyParentGate(dashboard.widgets, permitted);
}

/**
 * Aplica a regra "pai fechado = filho fechado": se um widget pai não está
 * permitido, remove os filhos do conjunto visível — mesmo que o filho tenha
 * permissão explícita (não faz sentido ver o desdobramento sem o card
 * principal).
 */
function applyParentGate(
  widgets: Array<{ id: string; parentId: string | null }>,
  permitted: Set<string>,
): Set<string> {
  const parentById = new Map(
    widgets.map((widget) => [widget.id, widget.parentId] as const),
  );
  const visible = new Set<string>();
  for (const id of permitted) {
    const parentId = parentById.get(id);
    // Widget de topo: entra direto.
    if (!parentId) {
      visible.add(id);
      continue;
    }
    // Widget aninhado: só entra se o pai estiver permitido também.
    if (permitted.has(parentId)) visible.add(id);
  }
  return visible;
}

/** Achata `visibleOrgWidgetIds` para "tem QUALQUER coisa visível?" */
export async function hasAnyOrgWidgetVisible(
  organizationId: string,
  member: MemberContext,
): Promise<boolean> {
  const set = await visibleOrgWidgetIds(organizationId, member);
  return !!set && set.size > 0;
}
