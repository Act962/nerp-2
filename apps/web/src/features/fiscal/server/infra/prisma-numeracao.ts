import "server-only";

import { randomUUID } from "node:crypto";
import type { ModeloDocumento, NumeracaoFiscal } from "@nerp/fiscal";
import prisma from "@/lib/db";

/**
 * Reserva o próximo número da série num único comando: `INSERT ... ON
 * CONFLICT DO UPDATE ... RETURNING`. Dois caixas fechando venda no mesmo
 * instante recebem números diferentes sem lock na aplicação — ler o contador
 * e depois somar abriria exatamente a corrida que gera nota com número repetido.
 *
 * A primeira reserva da série parte de `FiscalConfig.nfceNextNumber`: quem já
 * emitia NFC-e nesta série por outro sistema não pode recomeçar do 1.
 */
export class NumeracaoFiscalPrisma implements NumeracaoFiscal {
  async reservar(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }): Promise<number> {
    const tipo = input.modelo === 65 ? "NFCE" : "NFE";
    const config =
      tipo === "NFCE"
        ? await prisma.fiscalConfig.findUnique({
            where: { organizationId: input.organizationId },
            select: { nfceNextNumber: true, nfceSerie: true },
          })
        : null;
    const inicio =
      config && (config.nfceSerie ?? 1) === input.serie
        ? (config.nfceNextNumber ?? 1)
        : 1;

    const [linha] = await prisma.$queryRaw<{ numero: number }[]>`
      INSERT INTO "fiscal_series" ("id", "organizationId", "type", "serie", "nextNumber", "updatedAt")
      VALUES (${randomUUID()}, ${input.organizationId}, ${tipo}::"FiscalDocumentType", ${input.serie}, ${inicio + 1}, now())
      ON CONFLICT ("organizationId", "type", "serie")
      DO UPDATE SET "nextNumber" = "fiscal_series"."nextNumber" + 1, "updatedAt" = now()
      RETURNING "nextNumber" - 1 AS numero
    `;
    return Number(linha.numero);
  }

  async proximo(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }): Promise<number | null> {
    const serie = await prisma.fiscalSeries.findUnique({
      where: {
        organizationId_type_serie: {
          organizationId: input.organizationId,
          type: input.modelo === 65 ? "NFCE" : "NFE",
          serie: input.serie,
        },
      },
      select: { nextNumber: true },
    });
    return serie?.nextNumber ?? null;
  }
}
