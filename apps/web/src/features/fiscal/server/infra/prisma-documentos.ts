import "server-only";

import {
  DocumentoFiscal,
  type ModeloDocumento,
  type NotaFiscal,
  type RepositorioDocumentoFiscal,
  STATUS_FORA_DE_VIGOR,
  TP_EMIS,
  type TpEmis,
} from "@nerp/fiscal";
import type { FiscalDocument, Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";

const TIPO_DO_MODELO = { 65: "NFCE", 55: "NFE" } as const;
const MODELO_DO_TIPO = { NFCE: 65, NFE: 55 } as const;

const TP_EMIS_VALIDOS: readonly number[] = Object.values(TP_EMIS);
function paraTpEmis(valor: number): TpEmis {
  return (TP_EMIS_VALIDOS.includes(valor) ? valor : TP_EMIS.NORMAL) as TpEmis;
}

/** Linha de `fiscal_documents` → entidade. As telas de leitura também usam. */
export function documentoDaLinha(row: FiscalDocument): DocumentoFiscal {
  return DocumentoFiscal.restaurar({
    id: row.id,
    organizationId: row.organizationId,
    saleId: row.saleId,
    modelo: MODELO_DO_TIPO[row.type],
    ambiente: row.environment === "PRODUCAO" ? "PRODUCAO" : "HOMOLOGACAO",
    serie: row.serie ?? 0,
    numero: row.numero ?? 0,
    tpEmis: paraTpEmis(row.tpEmis),
    status: row.status,
    // Gravado por este mesmo repositório a partir de uma `NotaFiscal`.
    nota: row.nota as unknown as NotaFiscal,
    chave: row.chave,
    protocolo: row.protocolo,
    autorizadoEm: row.authorizedAt,
    rejeicao: row.rejectionCode
      ? { codigo: row.rejectionCode, motivo: row.rejectionReason ?? "" }
      : null,
    cancelamento: row.cancelledAt
      ? {
          protocolo: row.cancelProtocol ?? "",
          justificativa: row.cancelReason ?? "",
          canceladoEm: row.cancelledAt,
        }
      : null,
    inutilizacaoId: row.inutilizacaoId,
    qrCodeUrl: row.qrCodeUrl,
    consultaUrl: row.consultaUrl,
    xmlKey: row.xmlKey,
    danfeKey: row.pdfKey,
    xmlCancelamentoKey: row.cancelXmlKey,
    tentativas: row.attemptCount,
    ultimaTentativaEm: row.lastAttemptAt,
    criadoEm: row.createdAt,
  });
}

/**
 * `RepositorioDocumentoFiscal` sobre a tabela `fiscal_documents`. Toda leitura
 * filtra por `organizationId` — o id do documento chega de fora (job, tela) e
 * não pode abrir a nota de outra empresa.
 */
export class RepositorioDocumentoFiscalPrisma
  implements RepositorioDocumentoFiscal
{
  async buscarPorId(organizationId: string, id: string) {
    const row = await prisma.fiscalDocument.findFirst({
      where: { id, organizationId },
    });
    return row ? documentoDaLinha(row) : null;
  }

  async buscarVigenteDaVenda(
    organizationId: string,
    saleId: string,
    modelo: ModeloDocumento,
  ) {
    const row = await prisma.fiscalDocument.findFirst({
      where: {
        organizationId,
        saleId,
        type: TIPO_DO_MODELO[modelo],
        status: { notIn: [...STATUS_FORA_DE_VIGOR] },
      },
    });
    return row ? documentoDaLinha(row) : null;
  }

  async listarDaFaixa(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
    numeroInicial: number;
    numeroFinal: number;
  }) {
    const rows = await prisma.fiscalDocument.findMany({
      where: {
        organizationId: input.organizationId,
        type: TIPO_DO_MODELO[input.modelo],
        serie: input.serie,
        numero: { gte: input.numeroInicial, lte: input.numeroFinal },
      },
    });
    return rows.map(documentoDaLinha);
  }

  async salvar(documento: DocumentoFiscal) {
    const d = documento.paraDados();
    const dados = {
      type: TIPO_DO_MODELO[d.modelo],
      status: d.status,
      environment: d.ambiente,
      serie: d.serie,
      numero: d.numero,
      tpEmis: d.tpEmis,
      emitterCnpj: d.nota.emitente.cnpj,
      nota: d.nota as unknown as Prisma.InputJsonValue,
      chave: d.chave,
      protocolo: d.protocolo,
      authorizedAt: d.autorizadoEm,
      rejectionCode: d.rejeicao?.codigo ?? null,
      rejectionReason: d.rejeicao?.motivo ?? null,
      cancelledAt: d.cancelamento?.canceladoEm ?? null,
      cancelReason: d.cancelamento?.justificativa ?? null,
      cancelProtocol: d.cancelamento?.protocolo ?? null,
      cancelXmlKey: d.xmlCancelamentoKey,
      inutilizacaoId: d.inutilizacaoId,
      qrCodeUrl: d.qrCodeUrl,
      consultaUrl: d.consultaUrl,
      providerRef: d.id,
      xmlKey: d.xmlKey,
      pdfKey: d.danfeKey,
      attemptCount: d.tentativas,
      lastAttemptAt: d.ultimaTentativaEm,
    };
    await prisma.fiscalDocument.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        organizationId: d.organizationId,
        saleId: d.saleId,
        createdAt: d.criadoEm,
        ...dados,
      },
      update: dados,
    });
  }
}
