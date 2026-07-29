import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { oracleQueryConfigSchema } from "@/features/dashboard-widgets/lib/oracle-query-config";
import type { OracleDisplayType } from "@/features/erp-sync/server/oracle-explorer/run-query";
import { queryFingerprint } from "@/features/erp-sync/server/oracle-explorer/run-query";
import prisma from "@/lib/db";
import { refreshOracleSnapshot } from "./_oracle-custom";
import { isOracleWidget } from "./_oracle-widget";

// Intervalo mínimo entre atualizações forçadas da MESMA consulta. Sem isso o
// botão vira martelo no ERP de produção com alguns cliques. Mesmo idioma de
// estado em memória do rate limiter de tradegram-public/identify-product.ts —
// com a mesma limitação de valer por instância do processo.
const MIN_INTERVAL_MS = 30_000;
const lastRefreshAt = new Map<string, number>();

export const refreshOracleWidget = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Forçar atualização de um widget de consulta do Oracle",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({ widgetId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    // Só o dono do widget atualiza — não precisa ser admin: quem já vê o dado
    // pode pedir que ele seja recalculado.
    const widget = await prisma.dashboardWidget.findFirst({
      where: { id: input.widgetId, memberId: member.id },
      select: { dataSourceKey: true, displayType: true, options: true },
    });
    if (!widget || !isOracleWidget(widget.dataSourceKey)) {
      throw errors.NOT_FOUND({ message: "Widget não encontrado." });
    }

    const parsed = oracleQueryConfigSchema.safeParse(
      (widget.options as { oracle?: unknown } | null)?.oracle,
    );
    if (!parsed.success) {
      throw errors.BAD_REQUEST({ message: "Consulta não configurada." });
    }

    const displayType = widget.displayType as OracleDisplayType;
    const fingerprint = queryFingerprint(
      context.org.id,
      parsed.data,
      displayType,
    );

    const last = lastRefreshAt.get(fingerprint) ?? 0;
    const waitMs = MIN_INTERVAL_MS - (Date.now() - last);
    if (waitMs > 0) {
      throw errors.BAD_REQUEST({
        message: `Aguarde ${Math.ceil(waitMs / 1000)}s para atualizar de novo.`,
      });
    }
    lastRefreshAt.set(fingerprint, Date.now());

    // Aqui SIM espera: é ação explícita do usuário, que quer ver o número novo.
    await refreshOracleSnapshot(context.org.id, parsed.data, displayType);
    return { refreshed: true };
  });
