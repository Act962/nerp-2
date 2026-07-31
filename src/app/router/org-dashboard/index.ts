import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import { resolveOracleWidgets } from "@/app/router/dashboard-widgets/_oracle-custom";
import { isOracleWidget } from "@/app/router/dashboard-widgets/_oracle-widget";
import {
  isContentWidget,
  resolveContentWidget,
} from "@/app/router/dashboard-widgets/_content-widget";
import {
  parseManualMetricId,
  resolveManualMetricValue,
  WIDGET_REGISTRY,
} from "@/app/router/dashboard-widgets/_registry";
import type { WidgetValue } from "@/app/router/dashboard-widgets/_types";
import { visibleOrgWidgetIds } from "@/features/dashboard-widgets/server/org-dashboard-access";
import { HEX_COLOR_RE } from "@/features/dashboard-widgets/lib/pastel-colors";
import {
  findTemplate,
  PANEL_CATEGORIES,
  PANEL_TEMPLATES,
} from "@/features/org-dashboard/lib/panel-templates";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "@/lib/org-access";
import { randomBytes } from "node:crypto";
import {
  BREAKPOINTS_WITH_LAYOUT,
  chartKindSchema,
  displayTypeSchema,
  gridItemSchema,
  iconSchema,
  layoutSchema,
  PASTEL_KEYS,
  widgetColorSchema,
} from "./_shared";

// Dashboard COMPARTILHADO da organização. O modelo aqui é diferente do
// dashboard pessoal:
//  - Um por org (`@unique organizationId`) — não é lista.
//  - Owner/admin edita; qualquer member consulta o subconjunto de widgets
//    que tem permissão (por `OrgDashboardMemberPermission`).
//  - Compartilhamento público via `shareToken` (leitura, sem login).
//
// Todos os endpoints admin recusam quem não é owner/admin via
// `requireOrgAdmin`. Endpoints de leitura são liberados a qualquer membro,
// mas o retorno já vem filtrado por `visibleOrgWidgetIds`.

const memberProcedure = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware);

/** Garante que existe um OrgDashboard para a org (cria vazio se não existir). */
async function ensureOrgDashboard(
  organizationId: string,
  createdById: string | null,
): Promise<string> {
  const existing = await prisma.orgDashboard.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.orgDashboard.create({
    data: { organizationId, createdById },
    select: { id: true },
  });
  return created.id;
}

// -------- GET (membro): meu subconjunto visível --------
export const getOrgDashboard = memberProcedure
  .input(z.object({}))
  .handler(async ({ context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true, role: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado." });

    const dashboard = await prisma.orgDashboard.findUnique({
      where: { organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        shareToken: true,
        publicName: true,
        publicVisibleWidgetIds: true,
        widgets: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            dataSourceKey: true,
            title: true,
            displayType: true,
            chartKind: true,
            color: true,
            icon: true,
            options: true,
            layout: true,
            sortOrder: true,
            parentId: true,
            panelId: true,
          },
        },
        panels: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            category: true,
            title: true,
            color: true,
            sortOrder: true,
            templateKey: true,
            appearance: true,
          },
        },
      },
    });
    if (!dashboard) {
      return { dashboard: null, widgets: [], panels: [], canEdit: false };
    }

    const visible = await visibleOrgWidgetIds(context.org.id, {
      memberId: member.id,
      role: member.role,
    });
    const filtered = dashboard.widgets.filter((widget) =>
      visible?.has(widget.id),
    );
    // Painel sem NENHUM widget visível para este membro some — evita
    // cabeçalho fantasma com corpo vazio.
    const visiblePanelIds = new Set(
      filtered
        .map((widget) => widget.panelId)
        .filter((id): id is string => !!id),
    );
    const filteredPanels = dashboard.panels.filter((panel) =>
      visiblePanelIds.has(panel.id),
    );

    const canEdit = await isAdmin(member.role);
    return {
      dashboard: {
        id: dashboard.id,
        name: dashboard.name,
        shareToken: canEdit ? dashboard.shareToken : null,
        publicName: canEdit ? dashboard.publicName : null,
        publicVisibleWidgetIds: canEdit ? dashboard.publicVisibleWidgetIds : [],
      },
      widgets: filtered,
      panels: filteredPanels,
      canEdit,
    };
  });

async function isAdmin(role: string): Promise<boolean> {
  return role === "owner" || role === "admin";
}

// -------- GET (admin): dashboard cheio para edição --------
export const getOrgDashboardForAdmin = memberProcedure
  .input(z.object({}))
  .handler(async ({ context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const dashboardId = await ensureOrgDashboard(context.org.id, null);
    const dashboard = await prisma.orgDashboard.findUnique({
      where: { id: dashboardId },
      include: {
        widgets: { orderBy: { sortOrder: "asc" } },
        panels: { orderBy: { sortOrder: "asc" } },
      },
    });
    const permissions = await prisma.orgDashboardMemberPermission.findMany({
      where: {
        orgDashboardWidget: { orgDashboardId: dashboardId },
      },
      select: { memberId: true, orgDashboardWidgetId: true },
    });
    return { dashboard, permissions };
  });

// -------- Widgets: add / update / remove / reorder --------
const addWidgetInput = z.object({
  dataSourceKey: z.string().min(1),
  title: z.string().max(60).nullable().optional(),
  displayType: displayTypeSchema,
  chartKind: chartKindSchema.nullable().optional(),
  color: widgetColorSchema,
  icon: iconSchema,
  parentId: z.string().nullable().optional(),
  // Painel destino. null/ausente = widget "solto" na raiz. Um widget dentro de
  // painel vive na grade daquele painel e some junto quando o painel é apagado.
  panelId: z.string().nullable().optional(),
  options: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const addOrgWidget = memberProcedure
  .input(addWidgetInput)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado." });

    const dashboardId = await ensureOrgDashboard(context.org.id, member.id);

    // Sanity de parent: precisa pertencer ao MESMO dashboard e ser topo.
    if (input.parentId) {
      const parent = await prisma.orgDashboardWidget.findFirst({
        where: { id: input.parentId, orgDashboardId: dashboardId },
        select: { parentId: true },
      });
      if (!parent) {
        throw errors.NOT_FOUND({ message: "Widget pai não encontrado." });
      }
      if (parent.parentId) {
        throw errors.BAD_REQUEST({
          message:
            "Só é possível aninhar um nível: o widget pai já está dentro de outro.",
        });
      }
    }

    // Painel destino precisa pertencer ao MESMO dashboard. null = solto.
    if (input.panelId) {
      const panel = await prisma.orgDashboardPanel.findFirst({
        where: { id: input.panelId, orgDashboardId: dashboardId },
        select: { id: true },
      });
      if (!panel) {
        throw errors.NOT_FOUND({ message: "Painel não encontrado." });
      }
    }

    // Layout/ordem inicial: canto inferior esquerdo, ESCOPADO ao destino
    // (painel específico ou raiz solta). Só widgets de TOPO — filhos moram no
    // card do pai.
    const topWidgets = await prisma.orgDashboardWidget.findMany({
      where: {
        orgDashboardId: dashboardId,
        parentId: null,
        panelId: input.panelId ?? null,
      },
      select: { layout: true, sortOrder: true },
    });
    const layout: Record<
      string,
      { x: number; y: number; w: number; h: number }
    > = {};
    for (const breakpoint of BREAKPOINTS_WITH_LAYOUT) {
      let maxBottom = 0;
      for (const widget of topWidgets) {
        const raw = widget.layout as Record<string, unknown> | null;
        const parsed = gridItemSchema.safeParse(raw?.[breakpoint]);
        if (parsed.success) {
          maxBottom = Math.max(maxBottom, parsed.data.y + parsed.data.h);
        }
      }
      layout[breakpoint] = { x: 0, y: maxBottom, w: 3, h: 2 };
    }
    const maxSortOrder = topWidgets.reduce(
      (max, widget) => Math.max(max, widget.sortOrder),
      -1,
    );

    const widget = await prisma.orgDashboardWidget.create({
      data: {
        orgDashboardId: dashboardId,
        dataSourceKey: input.dataSourceKey,
        title: input.title?.trim() || null,
        parentId: input.parentId ?? null,
        panelId: input.panelId ?? null,
        displayType: input.displayType,
        chartKind:
          input.displayType === "CHART" ? (input.chartKind ?? null) : null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        options: input.options
          ? (input.options as Prisma.InputJsonValue)
          : undefined,
        layout,
        sortOrder: maxSortOrder + 1,
      },
      select: { id: true },
    });
    return { id: widget.id };
  });

const updateWidgetInput = z.object({
  widgetId: z.string(),
  title: z.string().max(60).nullable().optional(),
  displayType: displayTypeSchema.optional(),
  chartKind: chartKindSchema.nullable().optional(),
  color: widgetColorSchema,
  icon: iconSchema,
  // Mover entre painéis (ou para a raiz solta, com null). Ausente = não mexe.
  panelId: z.string().nullable().optional(),
  options: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updateOrgWidget = memberProcedure
  .input(updateWidgetInput)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const widget = await prisma.orgDashboardWidget.findFirst({
      where: {
        id: input.widgetId,
        orgDashboard: { organizationId: context.org.id },
      },
      select: { id: true },
    });
    if (!widget) throw errors.NOT_FOUND({ message: "Widget não encontrado." });

    // Painel destino (quando movendo): precisa ser do mesmo dashboard.
    if (input.panelId) {
      const panel = await prisma.orgDashboardPanel.findFirst({
        where: {
          id: input.panelId,
          orgDashboard: { organizationId: context.org.id },
        },
        select: { id: true },
      });
      if (!panel) throw errors.NOT_FOUND({ message: "Painel não encontrado." });
    }

    await prisma.orgDashboardWidget.update({
      where: { id: input.widgetId },
      data: {
        ...(input.title !== undefined && {
          title: input.title?.trim() || null,
        }),
        ...(input.displayType && { displayType: input.displayType }),
        ...(input.chartKind !== undefined && { chartKind: input.chartKind }),
        ...(input.color !== undefined && { color: input.color ?? null }),
        ...(input.icon !== undefined && { icon: input.icon ?? null }),
        ...(input.panelId !== undefined && { panelId: input.panelId ?? null }),
        ...(input.options !== undefined && {
          options: input.options
            ? (input.options as Prisma.InputJsonValue)
            : (null as unknown as Prisma.InputJsonValue),
        }),
      },
    });
    return { ok: true };
  });

export const removeOrgWidget = memberProcedure
  .input(z.object({ widgetId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const widget = await prisma.orgDashboardWidget.findFirst({
      where: {
        id: input.widgetId,
        orgDashboard: { organizationId: context.org.id },
      },
      select: { id: true },
    });
    if (!widget) throw errors.NOT_FOUND({ message: "Widget não encontrado." });
    await prisma.orgDashboardWidget.delete({ where: { id: input.widgetId } });
    return { ok: true };
  });

// -------- Salvar layout (bulk) --------
export const saveOrgLayout = memberProcedure
  .input(
    z.object({
      widgets: z.array(
        z.object({
          widgetId: z.string(),
          layout: layoutSchema,
          sortOrder: z.number().int().min(0),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const dashboard = await prisma.orgDashboard.findUnique({
      where: { organizationId: context.org.id },
      select: { id: true },
    });
    if (!dashboard) return { ok: true };

    await prisma.$transaction(
      input.widgets.map((entry) =>
        prisma.orgDashboardWidget.updateMany({
          where: { id: entry.widgetId, orgDashboardId: dashboard.id },
          data: {
            layout: entry.layout as Prisma.InputJsonValue,
            sortOrder: entry.sortOrder,
          },
        }),
      ),
    );
    return { ok: true };
  });

// -------- Salvar layout DOS PAINÉIS (bulk) --------
// Painéis viraram itens de um grid externo (redimensionáveis), então guardam
// posição/tamanho por breakpoint em `layout`, igual aos widgets.
export const saveOrgPanelLayout = memberProcedure
  .input(
    z.object({
      panels: z.array(
        z.object({
          panelId: z.string(),
          layout: layoutSchema,
          sortOrder: z.number().int().min(0),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const dashboard = await prisma.orgDashboard.findUnique({
      where: { organizationId: context.org.id },
      select: { id: true },
    });
    if (!dashboard) return { ok: true };

    await prisma.$transaction(
      input.panels.map((entry) =>
        prisma.orgDashboardPanel.updateMany({
          where: { id: entry.panelId, orgDashboardId: dashboard.id },
          data: {
            layout: entry.layout as Prisma.InputJsonValue,
            sortOrder: entry.sortOrder,
          },
        }),
      ),
    );
    return { ok: true };
  });

// -------- Permissões (matriz membro × widget) --------
const permissionInput = z.object({
  memberId: z.string(),
  widgetIds: z.array(z.string()),
});

export const setMemberPermissions = memberProcedure
  .input(permissionInput)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    // Sanity: o member alvo tem que ser DA MESMA org.
    const targetMember = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!targetMember) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }
    // E os widgets também.
    const dashboard = await prisma.orgDashboard.findUnique({
      where: { organizationId: context.org.id },
      select: { widgets: { select: { id: true } } },
    });
    const allowedIds = new Set(
      (dashboard?.widgets ?? []).map((widget) => widget.id),
    );
    const clean = input.widgetIds.filter((id) => allowedIds.has(id));

    // "Set semantic": remove tudo do member, insere o novo conjunto.
    // Em transação para não vazar estado parcial.
    await prisma.$transaction([
      prisma.orgDashboardMemberPermission.deleteMany({
        where: { memberId: input.memberId },
      }),
      ...(clean.length > 0
        ? [
            prisma.orgDashboardMemberPermission.createMany({
              data: clean.map((widgetId) => ({
                memberId: input.memberId,
                orgDashboardWidgetId: widgetId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    return { ok: true };
  });

// -------- Compartilhamento público --------
export const rotateShareToken = memberProcedure
  .input(z.object({ enable: z.boolean() }))
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const dashboardId = await ensureOrgDashboard(context.org.id, null);
    // 24 chars aleatórios em base32 (url-safe, sem `=`) — mesma ordem de
    // grandeza dos shares do TradeGram.
    const token = input.enable
      ? randomBytes(15).toString("base64url").slice(0, 24)
      : null;
    await prisma.orgDashboard.update({
      where: { id: dashboardId },
      data: { shareToken: token },
      select: { id: true },
    });
    return { shareToken: token };
  });

export const updatePublicSettings = memberProcedure
  .input(
    z.object({
      publicName: z.string().max(80).nullable(),
      publicVisibleWidgetIds: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const dashboardId = await ensureOrgDashboard(context.org.id, null);
    // Restringe ao subconjunto de widgets que REALMENTE existem no
    // dashboard — se o admin remove um widget e esquece de ajustar o
    // publicVisibleWidgetIds, o array fica com id órfão. Limpo aqui.
    const dashboard = await prisma.orgDashboard.findUnique({
      where: { id: dashboardId },
      select: { widgets: { select: { id: true } } },
    });
    const valid = new Set((dashboard?.widgets ?? []).map((w) => w.id));
    const clean = input.publicVisibleWidgetIds.filter((id) => valid.has(id));

    await prisma.orgDashboard.update({
      where: { id: dashboardId },
      data: {
        publicName: input.publicName?.trim() || null,
        publicVisibleWidgetIds: clean,
      },
    });
    return { ok: true };
  });

// -------- Rota pública (sem auth) --------
// Vive no roteador `orgDashboard.public` para ficar isolada — a montagem em
// `router/index.ts` NÃO pode adicionar middleware de auth aqui, senão o
// `/publico/dashboard/[shareToken]` deixa de funcionar.
export const getPublicOrgDashboard = base
  .input(z.object({ shareToken: z.string().min(8) }))
  .handler(async ({ input, errors }) => {
    const dashboard = await prisma.orgDashboard.findUnique({
      where: { shareToken: input.shareToken },
      select: {
        id: true,
        publicName: true,
        publicVisibleWidgetIds: true,
        organization: { select: { name: true } },
        widgets: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            dataSourceKey: true,
            title: true,
            displayType: true,
            chartKind: true,
            color: true,
            icon: true,
            options: true,
            layout: true,
            sortOrder: true,
            parentId: true,
          },
        },
      },
    });
    if (!dashboard) {
      throw errors.NOT_FOUND({ message: "Link inválido ou revogado." });
    }
    const visible = new Set(dashboard.publicVisibleWidgetIds);
    // Aplica a mesma regra "pai fechado = filho fechado" da versão logada.
    const widgets = dashboard.widgets.filter((widget) => {
      if (!visible.has(widget.id)) return false;
      if (widget.parentId && !visible.has(widget.parentId)) return false;
      return true;
    });
    return {
      title:
        dashboard.publicName ?? `Dashboard — ${dashboard.organization.name}`,
      widgets,
    };
  });

// -------- Resolução de valores dos widgets --------
//
// Mesma semântica de `dashboardWidgets.resolveValues`, mas lê de
// `OrgDashboardWidget` em vez do dashboard pessoal. Compartilha os
// resolvers (`WIDGET_REGISTRY`, Oracle snapshot, métricas manuais) — o que
// muda é a origem dos widgets. Nunca abre conexão com o Oracle: consultas
// custom leem o snapshot igual ao caminho antigo.

interface OrgWidgetRow {
  id: string;
  dataSourceKey: string;
  displayType: string;
  options: unknown;
}

async function resolveOrgWidgetValues(
  organizationId: string,
  widgets: OrgWidgetRow[],
) {
  const oracleWidgets = widgets.filter((widget) =>
    isOracleWidget(widget.dataSourceKey),
  );
  const oracleByWidgetId = await resolveOracleWidgets(
    organizationId,
    oracleWidgets,
  );

  const uniqueKeys = [
    ...new Set(
      widgets
        .filter(
          (widget) =>
            !isOracleWidget(widget.dataSourceKey) &&
            !isContentWidget(widget.dataSourceKey),
        )
        .map((widget) => widget.dataSourceKey),
    ),
  ];
  const ctx = { organizationId };

  const resolvedByKey = new Map<string, WidgetValue | null>(
    await Promise.all(
      uniqueKeys.map(async (key): Promise<[string, WidgetValue | null]> => {
        const manualId = parseManualMetricId(key);
        if (manualId) {
          return [
            key,
            await resolveManualMetricValue(organizationId, manualId),
          ];
        }
        const definition = WIDGET_REGISTRY[key];
        if (!definition) return [key, null];
        try {
          return [key, await definition.resolve(ctx)];
        } catch {
          return [key, null];
        }
      }),
    ),
  );

  return widgets.map((widget) => {
    const oracle = oracleByWidgetId.get(widget.id);
    if (oracle) {
      return {
        widgetId: widget.id,
        value: oracle.value,
        progressPercent: undefined as number | undefined,
        error: oracle.error,
        computedAt: oracle.computedAt?.toISOString() ?? null,
      };
    }
    // Widget de conteúdo (frota/feed): dado vem de `options.content`, por
    // instância — nunca deduplicado por key.
    const value = isContentWidget(widget.dataSourceKey)
      ? resolveContentWidget(widget.dataSourceKey, widget.options)
      : (resolvedByKey.get(widget.dataSourceKey) ?? null);
    // Meta (progressPercent) por instância — mesma regra do dashboard pessoal.
    const options = widget.options as { targetValue?: unknown } | null;
    const target =
      typeof options?.targetValue === "number" && options.targetValue > 0
        ? options.targetValue
        : null;
    const progressPercent =
      value?.kind === "STAT" && target !== null
        ? Math.min(100, (value.value / target) * 100)
        : undefined;
    return {
      widgetId: widget.id,
      value,
      progressPercent,
      error: null as string | null,
      computedAt: null as string | null,
    };
  });
}

export const resolveOrgValues = memberProcedure
  .input(z.object({ widgetIds: z.array(z.string()).optional() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true, role: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado." });

    // O gate de visibilidade é aplicado ANTES de resolver — não faz sentido
    // gastar CPU calculando algo que o membro nem vê.
    const visible = await visibleOrgWidgetIds(context.org.id, {
      memberId: member.id,
      role: member.role,
    });
    if (!visible) return { values: [] };

    const widgets = await prisma.orgDashboardWidget.findMany({
      where: {
        id: {
          in: input.widgetIds
            ? input.widgetIds.filter((id) => visible.has(id))
            : [...visible],
        },
      },
      select: {
        id: true,
        dataSourceKey: true,
        displayType: true,
        options: true,
      },
    });
    return { values: await resolveOrgWidgetValues(context.org.id, widgets) };
  });

// Rota pública de resolução — só valida contra `publicVisibleWidgetIds`.
export const resolvePublicOrgValues = base
  .input(z.object({ shareToken: z.string().min(8) }))
  .handler(async ({ input, errors }) => {
    const dashboard = await prisma.orgDashboard.findUnique({
      where: { shareToken: input.shareToken },
      select: {
        organizationId: true,
        publicVisibleWidgetIds: true,
        widgets: {
          select: {
            id: true,
            dataSourceKey: true,
            displayType: true,
            options: true,
            parentId: true,
          },
        },
      },
    });
    if (!dashboard) {
      throw errors.NOT_FOUND({ message: "Link inválido ou revogado." });
    }
    const publicSet = new Set(dashboard.publicVisibleWidgetIds);
    const visible = dashboard.widgets.filter((widget) => {
      if (!publicSet.has(widget.id)) return false;
      if (widget.parentId && !publicSet.has(widget.parentId)) return false;
      return true;
    });
    return {
      values: await resolveOrgWidgetValues(dashboard.organizationId, visible),
    };
  });

// -------- Painéis (grupos visuais) --------
//
// Um painel é um agrupamento de widgets por categoria (Comercial, Estoque,
// Frota, Logística, ...). `addPanel` cria o painel + widgets do template
// numa única transação para não deixar painel vazio em caso de falha.
//
// O admin pode: mudar título/cor, remover o painel inteiro (cascade nos
// widgets dele) — CRUD mínimo por enquanto. Drag/drop entre painéis e
// polimento visual são fases 3.4 e 3.5.

export const addOrgPanel = memberProcedure
  .input(z.object({ templateKey: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const template = findTemplate(input.templateKey);
    if (!template) {
      throw errors.NOT_FOUND({ message: "Template desconhecido." });
    }
    const category = PANEL_CATEGORIES.find(
      (item) => item.key === template.category,
    );
    if (!category) {
      throw errors.BAD_REQUEST({ message: "Categoria inválida no template." });
    }
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado." });

    const dashboardId = await ensureOrgDashboard(context.org.id, member.id);

    // sortOrder do painel novo: fim da lista de painéis existentes.
    const maxSortOrder = await prisma.orgDashboardPanel.aggregate({
      where: { orgDashboardId: dashboardId },
      _max: { sortOrder: true },
    });
    const nextSort = (maxSortOrder._max.sortOrder ?? -1) + 1;

    // Transação: cria o painel + todos os widgets do template. Se qualquer
    // um falhar (ex.: fonte de dado inválida no template — raro mas
    // possível), NADA é persistido.
    const panel = await prisma.$transaction(async (tx) => {
      const created = await tx.orgDashboardPanel.create({
        data: {
          orgDashboardId: dashboardId,
          category: template.category,
          title: template.label,
          color: category.defaultColor,
          sortOrder: nextSort,
          templateKey: template.key,
        },
        select: { id: true },
      });

      // Widgets: cada um com layout mínimo (canto superior esquerdo, 3×2).
      // O layout interno de cada painel será refinado pelo drag/drop na
      // fase 3.4; por ora o `sortOrder` é o suficiente para renderizar em
      // ordem de leitura (esquerda→direita, cima→baixo).
      const defaultLayout: Record<
        string,
        { x: number; y: number; w: number; h: number }
      > = {
        lg: { x: 0, y: 0, w: 3, h: 2 },
        md: { x: 0, y: 0, w: 3, h: 2 },
        sm: { x: 0, y: 0, w: 4, h: 2 },
      };

      for (const [index, widgetTemplate] of template.widgets.entries()) {
        await tx.orgDashboardWidget.create({
          data: {
            orgDashboardId: dashboardId,
            panelId: created.id,
            dataSourceKey: widgetTemplate.dataSourceKey,
            title: widgetTemplate.title ?? null,
            displayType: widgetTemplate.displayType,
            chartKind: widgetTemplate.chartKind ?? null,
            color: null,
            icon: null,
            options: widgetTemplate.options
              ? (widgetTemplate.options as Prisma.InputJsonValue)
              : undefined,
            layout: defaultLayout,
            sortOrder: index,
          },
        });
      }
      return created;
    });

    return { id: panel.id };
  });

export const updateOrgPanel = memberProcedure
  .input(
    z.object({
      panelId: z.string(),
      title: z.string().max(60).optional(),
      color: z
        .union([
          z.enum(PASTEL_KEYS as [string, ...string[]]),
          z.string().regex(HEX_COLOR_RE),
        ])
        .nullable()
        .optional(),
      // Aparência do painel (fundo/contorno/cor/fonte do título). Objeto livre
      // aqui; o cliente valida com `panelAppearanceSchema` e a leitura no
      // render também revalida — null limpa e volta ao padrão.
      appearance: z.record(z.string(), z.unknown()).nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const panel = await prisma.orgDashboardPanel.findFirst({
      where: {
        id: input.panelId,
        orgDashboard: { organizationId: context.org.id },
      },
      select: { id: true },
    });
    if (!panel) throw errors.NOT_FOUND({ message: "Painel não encontrado." });

    await prisma.orgDashboardPanel.update({
      where: { id: input.panelId },
      data: {
        ...(input.title !== undefined && {
          title: input.title.trim() || "Painel",
        }),
        ...(input.color !== undefined && { color: input.color ?? null }),
        ...(input.appearance !== undefined && {
          appearance: input.appearance
            ? (input.appearance as Prisma.InputJsonValue)
            : Prisma.DbNull,
        }),
      },
    });
    return { ok: true };
  });

export const removeOrgPanel = memberProcedure
  .input(z.object({ panelId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const panel = await prisma.orgDashboardPanel.findFirst({
      where: {
        id: input.panelId,
        orgDashboard: { organizationId: context.org.id },
      },
      select: { id: true },
    });
    if (!panel) throw errors.NOT_FOUND({ message: "Painel não encontrado." });
    // Cascade: widgets dentro do painel também vão embora (FK ON DELETE CASCADE).
    await prisma.orgDashboardPanel.delete({ where: { id: input.panelId } });
    return { ok: true };
  });

// Reordena os painéis: recebe os ids na ordem desejada e grava sortOrder =
// índice, numa transação. Só ids que pertencem ao dashboard entram (defende
// contra id de outra org no payload).
export const reorderOrgPanels = memberProcedure
  .input(z.object({ panelIds: z.array(z.string()).max(64) }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const dashboard = await prisma.orgDashboard.findUnique({
      where: { organizationId: context.org.id },
      select: { id: true },
    });
    if (!dashboard)
      throw errors.NOT_FOUND({ message: "Dashboard não encontrado." });

    const owned = await prisma.orgDashboardPanel.findMany({
      where: { orgDashboardId: dashboard.id, id: { in: input.panelIds } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((panel) => panel.id));
    const ordered = input.panelIds.filter((id) => ownedIds.has(id));

    await prisma.$transaction(
      ordered.map((id, index) =>
        prisma.orgDashboardPanel.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { ok: true };
  });

// Reordena widgets de TOPO dentro de um mesmo escopo (um painel, ou a raiz
// solta). Mesmo contrato do reorder de painéis: ids na ordem final.
export const reorderOrgWidgets = memberProcedure
  .input(z.object({ widgetIds: z.array(z.string()).max(128) }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const owned = await prisma.orgDashboardWidget.findMany({
      where: {
        id: { in: input.widgetIds },
        orgDashboard: { organizationId: context.org.id },
      },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((widget) => widget.id));
    const ordered = input.widgetIds.filter((id) => ownedIds.has(id));

    await prisma.$transaction(
      ordered.map((id, index) =>
        prisma.orgDashboardWidget.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { ok: true };
  });

export const listPanelTemplates = memberProcedure
  .input(z.object({}))
  .handler(async ({ context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    return {
      categories: PANEL_CATEGORIES,
      templates: PANEL_TEMPLATES,
    };
  });

export const orgDashboardRoutes = {
  get: getOrgDashboard,
  getForAdmin: getOrgDashboardForAdmin,
  addWidget: addOrgWidget,
  updateWidget: updateOrgWidget,
  removeWidget: removeOrgWidget,
  saveLayout: saveOrgLayout,
  setMemberPermissions: setMemberPermissions,
  rotateShareToken: rotateShareToken,
  updatePublicSettings: updatePublicSettings,
  resolveValues: resolveOrgValues,
  publicGet: getPublicOrgDashboard,
  publicResolveValues: resolvePublicOrgValues,
  addPanel: addOrgPanel,
  updatePanel: updateOrgPanel,
  removePanel: removeOrgPanel,
  savePanelLayout: saveOrgPanelLayout,
  reorderPanels: reorderOrgPanels,
  reorderWidgets: reorderOrgWidgets,
  listPanelTemplates: listPanelTemplates,
};
