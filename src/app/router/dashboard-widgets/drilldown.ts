import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { oracleQueryConfigSchema } from "@/features/dashboard-widgets/lib/oracle-query-config";
import { runOracleDrilldown } from "@/features/erp-sync/server/oracle-explorer/drilldown-query";
import prisma from "@/lib/db";
import { isOracleWidget } from "./_oracle-widget";

// Registros por trás do número do widget.
//
// Sem gate de admin: quem já tem o widget no próprio dashboard já vê o
// agregado, então ver os registros que o compõem é o mesmo dado com outro
// recorte. O que protege é o widget ser do próprio member (`memberId`).
//
// Falha esperada volta como resultado, não exceção — mesma escolha de
// erp-sync/test-connection.ts, para um ORA-xxxxx não virar 500 no popup.
export const drilldownOracleWidget = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Listar os registros por trás de um widget de consulta",
    tags: ["dashboard-widgets"],
  })
  .input(
    z.object({
      widgetId: z.string(),
      page: z.number().int().min(0).default(0),
      pageSize: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    const widget = await prisma.dashboardWidget.findFirst({
      where: { id: input.widgetId, memberId: member.id },
      select: { dataSourceKey: true, options: true },
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

    try {
      const result = await runOracleDrilldown(
        context.org.id,
        parsed.data,
        input.page,
        input.pageSize,
      );
      return { ok: true as const, message: null, ...result };
    } catch (error) {
      return {
        ok: false as const,
        message: (error as Error).message.slice(0, 300),
        columns: [],
        rows: [],
        total: 0,
      };
    }
  });
