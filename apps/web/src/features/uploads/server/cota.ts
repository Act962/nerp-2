import "server-only";

import prisma from "@/lib/db";

/**
 * Cota diária de upload por organização.
 *
 * O bucket é um só e o presign era liberado a qualquer sessão, sem conta
 * de quanto já subiu: uma conta gratuita podia encher o R2 num laço. A cota
 * é por dia e por organização, e é reservada ANTES de assinar a URL — quem
 * pede a assinatura já gastou a cota, mesmo que nunca faça o PUT. É o mesmo
 * raciocínio de contar a mensagem do Astro antes de abrir o stream.
 */

export const COTA_UPLOAD_DIA_BYTES = 200 * 1024 * 1024;

export class CotaDeUploadExcedidaError extends Error {
  constructor(
    readonly usadoBytes: number,
    readonly limiteBytes: number,
  ) {
    super("Limite diário de upload da organização atingido.");
  }
}

/** Dia no fuso da loja, como chave da linha. */
export function diaDeHoje(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/**
 * Reserva `bytes` na cota do dia. Atômico: o `updateMany` só acerta a linha
 * enquanto o total continua abaixo do limite, então dois presigns simultâneos
 * no fim da cota não passam os dois.
 */
export async function reservarCotaDeUpload(input: {
  organizationId: string;
  bytes: number;
  limiteBytes?: number;
  agora?: Date;
}): Promise<{ usadoBytes: number }> {
  const limite = input.limiteBytes ?? COTA_UPLOAD_DIA_BYTES;
  const day = diaDeHoje(input.agora);

  await prisma.uploadQuotaDaily.upsert({
    where: {
      organizationId_day: { organizationId: input.organizationId, day },
    },
    create: { organizationId: input.organizationId, day, bytes: 0 },
    update: {},
  });

  const { count } = await prisma.uploadQuotaDaily.updateMany({
    where: {
      organizationId: input.organizationId,
      day,
      bytes: { lte: limite - input.bytes },
    },
    data: { bytes: { increment: input.bytes } },
  });

  const linha = await prisma.uploadQuotaDaily.findUniqueOrThrow({
    where: {
      organizationId_day: { organizationId: input.organizationId, day },
    },
    select: { bytes: true },
  });

  if (count === 0) {
    throw new CotaDeUploadExcedidaError(linha.bytes, limite);
  }
  return { usadoBytes: linha.bytes };
}
