import "server-only";

import type {
  Inutilizacao,
  ModeloDocumento,
  RepositorioInutilizacao,
} from "@nerp/fiscal";
import type { FiscalInutilizacao } from "@/generated/prisma/client";
import prisma from "@/lib/db";

function paraDominio(row: FiscalInutilizacao): Inutilizacao {
  return {
    id: row.id,
    organizationId: row.organizationId,
    modelo: row.type === "NFCE" ? 65 : 55,
    ambiente: row.environment === "PRODUCAO" ? "PRODUCAO" : "HOMOLOGACAO",
    serie: row.serie,
    numeroInicial: row.numeroInicial,
    numeroFinal: row.numeroFinal,
    justificativa: row.justificativa,
    protocolo: row.protocolo,
    inutilizadaEm: row.inutilizadaEm,
    xmlKey: row.xmlKey,
  };
}

export class RepositorioInutilizacaoPrisma implements RepositorioInutilizacao {
  async salvar(i: Inutilizacao) {
    await prisma.fiscalInutilizacao.create({
      data: {
        id: i.id,
        organizationId: i.organizationId,
        type: i.modelo === 65 ? "NFCE" : "NFE",
        environment: i.ambiente,
        serie: i.serie,
        numeroInicial: i.numeroInicial,
        numeroFinal: i.numeroFinal,
        justificativa: i.justificativa,
        protocolo: i.protocolo,
        inutilizadaEm: i.inutilizadaEm,
        xmlKey: i.xmlKey,
      },
    });
  }

  async listarDaSerie(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }) {
    const rows = await prisma.fiscalInutilizacao.findMany({
      where: {
        organizationId: input.organizationId,
        type: input.modelo === 65 ? "NFCE" : "NFE",
        serie: input.serie,
      },
      orderBy: { numeroInicial: "asc" },
    });
    return rows.map(paraDominio);
  }
}
