import "server-only";

import { sanitizarErro } from "@/features/integracoes/server/credentials";
import {
  ACOES,
  cobrarAcao,
  custoDaAcao,
  podePagar,
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

  // Uma leitura por lote: o preço não muda no meio de cinquenta envios. Zero
  // é o padrão de quem não ligou a cobrança, e aí toda a conferência de saldo
  // abaixo sai do caminho sem custar consulta nenhuma.
  const custo = await custoDaAcao(
    input.organizationId,
    ACOES.destinatarioDeCampanha,
  );

  let enviados = 0;
  let falharam = 0;

  /** Fecha a rodada informando quanto sobrou para a próxima. */
  const encerrar = async (semSaldo: boolean) => {
    await recalcularContadores(campanha.id);
    const restam = await prisma.broadcastRecipient.count({
      where: { broadcastId: campanha.id, status: "PENDING" },
    });
    return { enviados, falharam, restam, semSaldo };
  };

  for (const destinatario of pendentes) {
    // Confere o saldo ANTES de enviar, porque a cobrança vem depois do envio
    // (o motivo está logo abaixo). Sem esta parada, a mensagem que esgota o
    // saldo sai, é marcada `SENT` e nunca é cobrada: ela deixou de estar
    // `PENDING`, então a consulta da próxima rodada não a alcança. Era uma
    // mensagem grátis por esgotamento, visível só cruzando o extrato de ★ com
    // o relatório da campanha.
    if (custo > 0 && !(await podePagar(input.organizationId, custo))) {
      console.warn("[campanha] saldo de ★ acabou; lote interrompido", {
        broadcastId: campanha.id,
      });
      return encerrar(true);
    }

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
    // consulta só pega quem ainda está pendente. É o `podePagar` no topo do
    // laço que garante que a esta altura há saldo.
    try {
      await cobrarAcao({
        organizationId: input.organizationId,
        actionKey: ACOES.destinatarioDeCampanha,
        descricao: `Campanha: mensagem para ${destinatario.phone}`,
      });
    } catch (erroDeSaldo) {
      if (!(erroDeSaldo instanceof SaldoInsuficienteError)) throw erroDeSaldo;

      // Corrida: a conferência aprovou e outro envio da mesma organização
      // consumiu o saldo antes deste débito. `podePagar` não reserva, então
      // sobra esta janela. A mensagem JÁ SAIU e não será cobrada — registra
      // como erro, porque é dinheiro e não pode passar como aviso de rotina.
      console.error(
        "[campanha] mensagem enviada sem cobrança: saldo consumido entre a conferência e o débito",
        {
          broadcastId: campanha.id,
          organizationId: input.organizationId,
          recipientId: destinatario.id,
          custo,
        },
      );
      return encerrar(true);
    }
  }

  return encerrar(false);
}
