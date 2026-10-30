import "server-only";

import {
  alertasFiscais,
  calcularTotais,
  type NotaFiscal,
  numeroOcupado,
  numerosPulados,
  type StatusDocumentoFiscal,
  tamanhoDaFaixa,
} from "@nerp/fiscal";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { fiscal } from "./container";
import { documentoDaLinha } from "./infra/prisma-documentos";

/**
 * Leituras das telas fiscais. Não passam pelos casos de uso de propósito:
 * listar e somar não mudam estado, e o caso de uso existe para proteger a
 * mudança de estado.
 */

/** Teresina não tem horário de verão: o dia fiscal começa às 00:00 -03:00. */
export function inicioDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00-03:00`);
}

/** `2026-10` → [01/10 00:00, 01/11 00:00) no fuso do Piauí. */
export function faixaDoMes(mes: string): { de: Date; ate: Date } {
  const [ano, m] = mes.split("-").map(Number);
  const proximo =
    m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
  return { de: inicioDoDia(`${mes}-01`), ate: inicioDoDia(`${proximo}-01`) };
}

const PAGINA = 30;

export async function listarNotas(input: {
  organizationId: string;
  status?: StatusDocumentoFiscal;
  de?: string;
  ate?: string;
  numero?: number;
  cursor?: string;
}) {
  const where: Prisma.FiscalDocumentWhereInput = {
    organizationId: input.organizationId,
    ...(input.status && { status: input.status }),
    ...(input.numero && { numero: input.numero }),
    ...((input.de || input.ate) && {
      createdAt: {
        ...(input.de && { gte: inicioDoDia(input.de) }),
        ...(input.ate && {
          lt: new Date(inicioDoDia(input.ate).getTime() + 86_400_000),
        }),
      },
    }),
  };
  const rows = await prisma.fiscalDocument.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGINA + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
    include: { sale: { select: { saleNumber: true } } },
  });
  const pagina = rows.slice(0, PAGINA);

  return {
    itens: pagina.map((row) => {
      const documento = documentoDaLinha(row);
      // Documento da Fase 1 pode não ter o conteúdo enviado guardado.
      const nota = row.nota as unknown as NotaFiscal | null;
      return {
        ...documento.paraDados(),
        saleNumber: row.sale.saleNumber,
        totalCentavos: nota?.itens ? calcularTotais(nota).total : 0,
        cancelavelAte: documento.cancelavelAte,
      };
    }),
    nextCursor: rows.length > PAGINA ? (pagina.at(-1)?.id ?? null) : null,
  };
}

/**
 * A série atual da NFC-e: o próximo número, os buracos para inutilizar e o
 * histórico de inutilizações.
 */
export async function situacaoDaNumeracao(organizationId: string) {
  const config = await prisma.fiscalConfig.findUnique({
    where: { organizationId },
    select: { nfceSerie: true },
  });
  const serie = config?.nfceSerie ?? 1;
  const [proximo, documentos, inutilizacoes] = await Promise.all([
    fiscal.numeracao.proximo({ organizationId, modelo: 65, serie }),
    prisma.fiscalDocument.findMany({
      where: { organizationId, type: "NFCE", serie, numero: { not: null } },
      select: { numero: true, status: true, lastAttemptAt: true },
    }),
    fiscal.inutilizacoes.listarDaSerie({ organizationId, modelo: 65, serie }),
  ]);

  const agora = new Date();
  const numeros = documentos.map((d) => d.numero ?? 0);
  const primeiro = Math.min(
    ...numeros,
    ...inutilizacoes.map((i) => i.numeroInicial),
    proximo ?? 1,
  );
  const pulados =
    proximo === null
      ? []
      : numerosPulados({
          primeiro,
          proximo,
          ocupados: documentos
            .filter((d) =>
              numeroOcupado(
                { status: d.status, ultimaTentativaEm: d.lastAttemptAt },
                agora,
              ),
            )
            .map((d) => d.numero ?? 0),
          inutilizadas: inutilizacoes.map((i) => ({
            inicio: i.numeroInicial,
            fim: i.numeroFinal,
          })),
        });

  return {
    serie,
    proximo,
    pulados,
    totalPulados: pulados.reduce((s, f) => s + tamanhoDaFaixa(f), 0),
    inutilizacoes: [...inutilizacoes].reverse(),
  };
}

const PARADA_MS = 15 * 60 * 1000;

export async function alertasDaOrganizacao(organizationId: string) {
  const agora = new Date();
  const [config, rejeicoes, paradas, numeracao] = await Promise.all([
    prisma.fiscalConfig.findUnique({
      where: { organizationId },
      select: { certificateExpiresAt: true },
    }),
    prisma.fiscalDocument.findMany({
      where: {
        organizationId,
        rejectionCode: { not: null },
        lastAttemptAt: { gte: new Date(agora.getTime() - 86_400_000) },
      },
      select: { rejectionCode: true, rejectionReason: true },
    }),
    prisma.fiscalDocument.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "PROCESSING"] },
        createdAt: { lt: new Date(agora.getTime() - PARADA_MS) },
      },
    }),
    situacaoDaNumeracao(organizationId),
  ]);

  return alertasFiscais({
    agora,
    certificadoVenceEm: config?.certificateExpiresAt ?? null,
    rejeicoesRecentes: rejeicoes.map((r) => ({
      codigo: r.rejectionCode ?? "",
      motivo: r.rejectionReason ?? "",
    })),
    paradas,
    pulados: numeracao.totalPulados,
  });
}
