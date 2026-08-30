import "server-only";

import { sanitizarErro } from "@/features/integracoes/server/credentials";
import { ACOES, cobrarAcao, estornar } from "@/features/stars/server/debitar";
import prisma from "@/lib/db";
import {
  janelaDeAtendimentoAberta,
  registrarSaida,
} from "../lib/outbound/registrar-saida";
import {
  OutboundProviderError,
  resolveOutboundProvider,
} from "../lib/providers";

export type FalhaDeEnvio =
  | "SEM_TELEFONE"
  | "JANELA_FECHADA"
  | "PROVEDOR"
  | "FALHA_NO_ENVIO";

export type ResultadoDeEnvio =
  | {
      ok: true;
      messageId: string;
      externalMessageId: string;
      createdAt: Date;
    }
  | { ok: false; codigo: FalhaDeEnvio; mensagem: string };

/**
 * Envia uma mensagem de texto por uma conversa e grava o resultado.
 *
 * A ordem é o valor deste arquivo, e é a mesma do projeto de origem por um
 * motivo caro:
 *
 *  1. **Resolve o provedor antes de tudo.** Resolver falha quando a credencial
 *     mudou ou o número caiu; cobrar antes disso é o cliente pagar por
 *     mensagem que não teve como sair.
 *  2. **Cobra.** Sem regra de custo cadastrada, `cobrarAcao` não faz nada.
 *  3. **Envia.** Falhou, estorna — lançamento novo no extrato, nunca remoção
 *     do débito.
 *  4. **Só então grava.** Uma bolha no banco que o cliente nunca recebeu é
 *     pior que um erro na tela.
 *
 * Mora aqui, e não dentro da procedure, porque a automação manda mensagem pelo
 * mesmo caminho. No Órbita cada remetente reimplementou a sequência, e dois
 * deles esqueceram de cobrar — divergência que só aparece na fatura.
 *
 * Devolve resultado tipado em vez de lançar: quem chama de dentro de uma
 * automação precisa **registrar** a falha no nó e seguir, não abortar a
 * execução inteira.
 */
export async function enviarTexto(input: {
  organizationId: string;
  conversationId: string;
  corpo: string;
  /** Quem assina a mensagem. A automação passa o dono do workflow. */
  autorId: string;
  respondeA?: string;
  /** De onde veio, para o extrato de ★ distinguir chat de automação. */
  descricaoDaCobranca?: string;
}): Promise<ResultadoDeEnvio> {
  const conversa = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    select: {
      id: true,
      funnelId: true,
      lead: {
        select: {
          id: true,
          phone: true,
          lastInboundAt: true,
          firstResponseAt: true,
          statusFlow: true,
        },
      },
    },
  });

  const lead = conversa?.lead;
  const telefone = lead?.phone;
  if (!conversa || !lead || !telefone) {
    return {
      ok: false,
      codigo: "SEM_TELEFONE",
      mensagem: "Este contato não tem telefone — não há para onde enviar.",
    };
  }

  // Checada aqui para dar mensagem clara sem gastar uma ida à Meta; o adapter
  // checa de novo, porque a janela pode fechar entre a leitura e o envio.
  if (!janelaDeAtendimentoAberta(lead.lastInboundAt)) {
    return {
      ok: false,
      codigo: "JANELA_FECHADA",
      mensagem:
        "A janela de 24 horas fechou. Para reabrir a conversa é preciso enviar um template aprovado.",
    };
  }

  let provider: Awaited<ReturnType<typeof resolveOutboundProvider>>["provider"];
  try {
    provider = (
      await resolveOutboundProvider({
        organizationId: input.organizationId,
        funnelId: conversa.funnelId,
      })
    ).provider;
  } catch (erro) {
    if (erro instanceof OutboundProviderError) {
      return { ok: false, codigo: "PROVEDOR", mensagem: erro.message };
    }
    throw erro;
  }

  const cobranca = await cobrarAcao({
    organizationId: input.organizationId,
    actionKey: ACOES.mensagemEnviada,
    descricao: input.descricaoDaCobranca ?? "Mensagem enviada no WhatsApp",
    userId: input.autorId,
  });

  let externalMessageId: string;
  try {
    const resultado = await provider.sendText({
      kind: "text",
      to: telefone,
      body: input.corpo,
      replyToExternalMessageId: input.respondeA,
    });
    externalMessageId = resultado.externalMessageId;
  } catch (erro) {
    if (cobranca.cobrado) {
      await estornar({
        organizationId: input.organizationId,
        valor: cobranca.valor,
        descricao: "Estorno: a mensagem não chegou a ser enviada",
        actionKey: ACOES.mensagemEnviada,
        userId: input.autorId,
      }).catch((falha) =>
        console.error("[stars] estorno falhou", {
          organizationId: input.organizationId,
          falha,
        }),
      );
    }

    if (erro instanceof OutboundProviderError) {
      return { ok: false, codigo: "PROVEDOR", mensagem: erro.message };
    }
    return {
      ok: false,
      codigo: "FALHA_NO_ENVIO",
      // Erro cru do provedor pode ecoar parte do token na descrição.
      mensagem: sanitizarErro(
        erro instanceof Error ? erro.message : "Falha ao enviar",
        [],
      ),
    };
  }

  const mensagem = await registrarSaida({
    organizationId: input.organizationId,
    funnelId: conversa.funnelId,
    conversationId: conversa.id,
    leadId: lead.id,
    externalMessageId,
    corpo: input.corpo,
    respondeA: input.respondeA,
    autorId: input.autorId,
    primeiraResposta: lead.firstResponseAt === null,
    estavaEsperando: lead.statusFlow === "WAITING",
  });

  return {
    ok: true,
    messageId: mensagem.id,
    externalMessageId,
    createdAt: mensagem.createdAt,
  };
}
