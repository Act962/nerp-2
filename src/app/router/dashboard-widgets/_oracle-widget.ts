import { ORPCError } from "@orpc/server";
import {
  allowedDisplayTypes,
  ORACLE_CUSTOM_KEY,
  type OracleQueryConfig,
  oracleQueryConfigSchema,
} from "@/features/dashboard-widgets/lib/oracle-query-config";
import { loadSchemaDictionary } from "@/features/erp-sync/server/oracle-explorer/dictionary";
import { preflightOracleQuery } from "@/features/erp-sync/server/oracle-explorer/preflight";
import { requireOrgAdmin } from "../erp-sync/_access";

export { ORACLE_CUSTOM_KEY };

export function isOracleWidget(dataSourceKey: string): boolean {
  return dataSourceKey === ORACLE_CUSTOM_KEY;
}

/**
 * Valida a config de um widget Oracle antes de gravar.
 *
 * Roda o MESMO pré-voo do preview: a config chega do client e o client pode
 * mentir. Também é aqui que fica o gate de admin — quem não pode configurar a
 * integração não pode criar consulta contra o ERP do cliente.
 */
export async function validateOracleWidget(params: {
  organizationId: string;
  userId: string;
  options: Record<string, unknown> | null | undefined;
  displayType: string;
}): Promise<OracleQueryConfig> {
  await requireOrgAdmin(params.organizationId, params.userId);

  const raw = params.options?.oracle;
  if (!raw) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Configure a consulta do Oracle antes de salvar o widget.",
    });
  }

  const parsed = oracleQueryConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Consulta inválida: ${parsed.error.issues[0]?.message ?? "verifique os campos."}`,
    });
  }
  const config = parsed.data;

  const allowed = allowedDisplayTypes(config);
  if (!allowed.includes(params.displayType as (typeof allowed)[number])) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Esta consulta não pode ser exibida assim. Opções: ${allowed.join(", ")}.`,
    });
  }

  const dictionary = await loadSchemaDictionary(params.organizationId);
  const preflight = preflightOracleQuery(dictionary, config);
  if (!preflight.ok) {
    throw new ORPCError("BAD_REQUEST", { message: preflight.errors.join(" ") });
  }

  return config;
}
