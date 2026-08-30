import "server-only";

import { sanitizarErro } from "@/features/integracoes/server/credentials";
import {
  ACOES,
  cobrarAcao,
  SaldoInsuficienteError,
} from "@/features/stars/server/debitar";
import { resolveOutboundProvider } from "@/features/whatsapp-chat/lib/providers";
import prisma from "@/lib/db";
import { recalcularContadores } from "./contadores";

/** Quantos destinatários por rodada. */
export const TAMANHO_DO_LOTE = 50;

/**
 * Dispara um lote de destinatários pendentes.
 *
 * O lote é pequeno de propósito: cada rodada é um passo durável do job, então
 * uma falha no meio refaz **um lote**, não a campanha inteira. E como a
 * consulta só pega quem está `PENDING`, quem já saiu não sai de novo — a
 * repetição é inofensiva.
 *
 * O provedor é resolvido **uma vez por lote**, não por destinatário: são
 * cinquenta envios com a mesma credencial, e resolver a cada um seria
 * cinquenta decifragens à toa.
 */
export async function enviarLote(input: {
  broadcastId: string;
  organizationId: string;
  funnelId: string;
}): Promise<{
  enviados: number;
  falharam: number;
  restam: number;
  semSaldo?: boolean;
}> {
  const campanha = await prisma.broadcast.findFirst({
    where: { id: input.broadcastId, organizationId: input.organizationId },
    select: {
      id: true,
      status: true,
      templateName: true,
      templateLanguage: true,
      templateVariables: true,
    },
  });

  // Campanha pausada ou cancelada no meio do disparo: para aqui.
  if (!campanha || campanha.status !== "SENDING") {
    return { enviados: 0, falharam: 0, restam: 0 };
  }
  if (!campanha.templateName || !campanha.templateLanguage) {
    return { enviados: 0, falharam: 0, restam: 0 };
  }

  const pendentes = await prisma.broadcastRecipient.findMany({
    where: { broadcastId: campanha.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: TAMANHO_DO_LOTE,
    select: { id: true, phone: true, name: true, variables: true },
  });

  if (pendentes.length === 0) {
    return { enviados: 0, falharam: 0, restam: 0 };
  }

  const { provider } = await resolveOutboundProvider({
    organizationId: input.organizationId,
    funnelId: input.funnelId,
  });

  const variaveisFixas = Array.isArray(campanha.templateVariables)
    ? (campanha.templateVariables as unknown[]).map(String)
    : [];

  let enviados = 0;
  let falharam = 0;

  for (const destinatario of pendentes) {
    // Marca se o envio deu certo. A cobrança acontece FORA do `try` do envio:
    // dentro dele, um erro ao cobrar cairia no `catch` que marca o
    // destinatário como falho — e marcaria como falha alguém que já recebeu.
    let enviouAgora = false;

    try {
      // Variável por destinatário vence a fixa da campanha — é como o nome de
      // cada pessoa entra no lugar de `{{1}}`.
      const proprias = Array.isArray(destinatario.variables)
        ? (destinatario.variables as unknown[]).map(String)
        : [];
      const parametros = proprias.length > 0 ? proprias : variaveisFixas;

      const resultado = await provider.sendTemplate({
        kind: "template",
        to: destinatario.phone,
        templateName: campanha.templateName,
        languageCode: campanha.templateLanguage,
        bodyParameters: parametros,
      });

      await prisma.broadcastRecipient.update({
        where: { id: destinatario.id },
        data: {
          status: "SENT",
          externalMessageId: resultado.externalMessageId,
          sentAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      enviados += 1;
      enviouAgora = true;
    } catch (error) {
      // Falha de um destinatário não derruba o lote: número inválido é comum
      // numa lista grande, e abortar deixaria os seguintes sem chance.
      await prisma.broadcastRecipient.update({
        where: { id: destinatario.id },
        data: {
          status: "FAILED",
          errorCode: "SEND_FAILED",
          errorMessage: sanitizarErro(
            error instanceof Error ? error.message : "Falha no envio",
            [],
          ),
        },
      });
      falharam += 1;
    }

    if (!enviouAgora) continue;

    // Cobra **depois** de o envio dar certo e de o destinatário sair de
    // `PENDING`. Cobrar antes faria a repetição de um lote cobrar duas vezes
    // pela mesma mensagem; nesta ordem, a repetição nem chega aqui, porque a
    // consulta só pega quem ainda está pendente.
    //
    // Se o saldo acabar no meio do lote, para por aqui: o que já saiu está
    // pago, e o restante continua pendente para quando houver crédito.
    try {
      await cobrarAcao({
        organizationId: input.organizationId,
        actionKey: ACOES.destinatarioDeCampanha,
        descricao: `Campanha: mensagem para ${destinatario.phone}`,
      });
    } catch (erroDeSaldo) {
      if (!(erroDeSaldo instanceof SaldoInsuficienteError)) throw erroDeSaldo;

      console.warn("[campanha] saldo de ★ acabou no meio do lote", {
        broadcastId: campanha.id,
      });
      await recalcularContadores(campanha.id);
      const aindaPendentes = await prisma.broadcastRecipient.count({
        where: { broadcastId: campanha.id, status: "PENDING" },
      });
      return { enviados, falharam, restam: aindaPendentes, semSaldo: true };
    }
  }

  await recalcularContadores(campanha.id);

  const restam = await prisma.broadcastRecipient.count({
    where: { broadcastId: campanha.id, status: "PENDING" },
  });

  return { enviados, falharam, restam };
}
