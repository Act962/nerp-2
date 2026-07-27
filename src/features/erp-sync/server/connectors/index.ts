import "server-only";
import z from "zod";
import prisma from "@/lib/db";
import { decryptSecret } from "@/lib/nasa-s2s-crypto";
import type { OracleConfig } from "../oracle-client";
import type { SalesConnector } from "./types";
import { createWinthorConnector } from "./winthor";

// Config de conexão guardada cifrada em `ErpConnection.configCiphertext`.
// Validada na leitura para falhar alto em vez de montar uma conexão pela metade.
const oracleConfigSchema = z.object({
  user: z.string().min(1),
  password: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive().default(1521),
  serviceName: z.string().min(1),
  schema: z.string().min(1),
});

export function parseOracleConfig(ciphertext: string): OracleConfig {
  return oracleConfigSchema.parse(JSON.parse(decryptSecret(ciphertext)));
}

/**
 * Devolve o conector de vendas da organização — só para ERP externo.
 *
 * Organização NATIVE (sem ERP) não sincroniza: o vendido dela vem direto de
 * `Sale` na agregação do ranking (`_sales-aggregation`), não do espelho. O cron
 * já filtra NATIVE e a procedure `erpSync.run` a bloqueia, então chegar aqui com
 * NATIVE é erro de programação — falha alto em vez de devolver um conector que
 * ninguém usa.
 */
export async function resolveSalesConnector(
  organizationId: string,
): Promise<SalesConnector> {
  const connection = await prisma.erpConnection.findUnique({
    where: { organizationId },
    select: { kind: true, configCiphertext: true },
  });

  if (!connection || connection.kind === "NATIVE") {
    throw new Error(
      `Organização ${organizationId} não tem ERP externo para sincronizar.`,
    );
  }

  if (connection.kind === "WINTHOR_ORACLE") {
    if (!connection.configCiphertext) {
      throw new Error(
        `Conexão Winthor da organização ${organizationId} está sem credenciais configuradas.`,
      );
    }
    return createWinthorConnector(
      parseOracleConfig(connection.configCiphertext),
    );
  }

  throw new Error(`Tipo de conexão de ERP não suportado: ${connection.kind}`);
}

export type { SalesConnector } from "./types";
export type {
  DateRange,
  ExternalSellerDTO,
  SalesFactDTO,
} from "./types";
