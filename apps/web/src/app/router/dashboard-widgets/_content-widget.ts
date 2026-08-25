import { z } from "zod";
import type { WidgetValue } from "./_types";

// Widgets de CONTEÚDO ESTÁTICO: frota e feed de IA. Diferente dos nativos
// (que consultam o banco) e do Oracle (que consulta o ERP), estes carregam o
// dado dentro do próprio `options.content`. É o caminho para painéis "control
// center" cujo dado ainda não tem fonte automatizada — o admin (ou um seed)
// preenche o conteúdo, e ele renderiza rico (barra de carga, badge, feed).
//
// Resolvidos FORA do WIDGET_REGISTRY (que só recebe organizationId, não as
// options do widget), no mesmo ponto onde o Oracle é tratado.

export const CONTENT_FLEET_KEY = "content.fleet";
export const CONTENT_FEED_KEY = "content.feed";

const toneSchema = z
  .enum(["info", "success", "warning", "danger", "neutral"])
  .optional();

const fleetContentSchema = z.object({
  kind: z.literal("fleet"),
  trucks: z
    .array(
      z.object({
        id: z.string(),
        plate: z.string(),
        driver: z.string(),
        route: z.string(),
        loadPercent: z.number(),
        eta: z.string().optional(),
        status: z.string().optional(),
        statusTone: toneSchema,
      }),
    )
    .max(50),
});

const feedContentSchema = z.object({
  kind: z.literal("feed"),
  items: z
    .array(
      z.object({
        id: z.string(),
        tone: z.enum(["info", "success", "warning", "danger", "neutral"]),
        title: z.string(),
        subtitle: z.string().optional(),
        time: z.string().optional(),
      }),
    )
    .max(50),
});

export function isContentWidget(dataSourceKey: string): boolean {
  return (
    dataSourceKey === CONTENT_FLEET_KEY || dataSourceKey === CONTENT_FEED_KEY
  );
}

/**
 * Resolve um widget de conteúdo a partir de `options.content`. Devolve null
 * (→ placeholder "Sem dado" na UI) quando não configurado ou inválido, em vez
 * de quebrar — mesmo contrato dos outros resolvers.
 */
export function resolveContentWidget(
  dataSourceKey: string,
  options: unknown,
): WidgetValue | null {
  const content = (options as { content?: unknown } | null)?.content;
  if (!content) return null;

  if (dataSourceKey === CONTENT_FLEET_KEY) {
    const parsed = fleetContentSchema.safeParse(content);
    if (!parsed.success) return null;
    return { kind: "FLEET", trucks: parsed.data.trucks };
  }
  if (dataSourceKey === CONTENT_FEED_KEY) {
    const parsed = feedContentSchema.safeParse(content);
    if (!parsed.success) return null;
    return { kind: "FEED", items: parsed.data.items };
  }
  return null;
}
