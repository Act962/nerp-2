import "server-only";

import { enviarTexto } from "@/features/whatsapp-chat/server/enviar-texto";
import type { CrmTemperature } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { avaliar, type Condicao } from "../lib/condicao";
import type { No } from "../lib/grafo";

export type ContextoDaExecucao = {
  organizationId: string;
  funnelId: string;
  workflowId: string;
  leadId: string;
  /** Quem "assina" o que a automação fizer. É o dono do workflow. */
  autorId: string;
  /** Texto que disparou, quando o gatilho foi de mensagem recebida. */
  textoDaMensagem: string | null;
};

export type ResultadoDoNo =
  | { tipo: "seguiu"; saida: string; output: Record<string, unknown> }
  | { tipo: "esperar"; minutos: number }
  | { tipo: "parou"; motivo: string; output: Record<string, unknown> }
  | { tipo: "falhou"; erro: string };

/**
 * Executa um nó e diz por onde continuar.
 *
 * Cada nó é uma função pequena e o efeito é dele: nenhum nó sabe do resto do
 * grafo. Quem anda é o executor no Inngest, e é ele que trata `esperar` com
 * `step.sleep` — colocar o sono aqui dentro tornaria a espera não durável, e
 * uma automação de "responda em 1 hora" morreria a cada deploy.
 */
export async function executarNo(
  no: No,
  contexto: ContextoDaExecucao,
): Promise<ResultadoDoNo> {
  try {
    switch (no.type) {
      case "SEND_MESSAGE":
        return await enviarMensagem(no, contexto);
      case "WAIT":
        return esperar(no);
      case "MOVE_STAGE":
        return await moverEtapa(no, contexto);
      case "SET_TEMPERATURE":
        return await definirTemperatura(no, contexto);
      case "SET_RESPONSIBLE":
        return await definirResponsavel(no, contexto);
      case "SET_WIN_LOSS":
        return await marcarGanhoOuPerda(no, contexto);
      case "HTTP_REQUEST":
        return await chamarUrl(no, contexto);
      case "FILTER":
        return await filtrar(no, contexto);
      default:
        return {
          tipo: "falhou",
          erro: `Passo "${no.type}" não sabe se executar.`,
        };
    }
  } catch (erro) {
    return {
      tipo: "falhou",
      erro: erro instanceof Error ? erro.message : "Falha no passo",
    };
  }
}

const seguiu = (output: Record<string, unknown> = {}): ResultadoDoNo => ({
  tipo: "seguiu",
  saida: "main",
  output,
});

async function enviarMensagem(
  no: No,
  contexto: ContextoDaExecucao,
): Promise<ResultadoDoNo> {
  const texto = String(no.data.texto ?? "").trim();
  if (!texto) return { tipo: "falhou", erro: "O passo não tem texto." };

  const conversa = await prisma.conversation.findFirst({
    where: { leadId: contexto.leadId, organizationId: contexto.organizationId },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true, lead: { select: { name: true } } },
  });

  if (!conversa) {
    return {
      tipo: "parou",
      motivo: "Este contato ainda não tem conversa aberta no WhatsApp.",
      output: {},
    };
  }

  const resultado = await enviarTexto({
    organizationId: contexto.organizationId,
    conversationId: conversa.id,
    corpo: preencher(texto, conversa.lead?.name ?? ""),
    autorId: contexto.autorId,
    descricaoDaCobranca: "Mensagem enviada por automação",
  });

  if (!resultado.ok) {
    // Janela de 24h fechada não é defeito da automação: é o cliente que não
    // fala há um dia. Para a execução com motivo em vez de marcar erro, senão
    // o histórico fica cheio de "falha" que ninguém tem como consertar.
    if (resultado.codigo === "JANELA_FECHADA") {
      return { tipo: "parou", motivo: resultado.mensagem, output: {} };
    }
    return { tipo: "falhou", erro: resultado.mensagem };
  }

  return seguiu({ messageId: resultado.messageId });
}

/**
 * Troca `{{nome}}` e `{{primeiro_nome}}` pelo nome do contato.
 *
 * O conjunto é fechado, como o dos filtros. Interpolação livre convida a
 * `{{lead.email}}` — que não existe, não avisa, e sai literal na mensagem que
 * o cliente recebe.
 */
function preencher(texto: string, nome: string): string {
  const primeiro = nome.split(" ")[0] ?? "";
  return texto
    .replaceAll("{{nome}}", nome)
    .replaceAll("{{primeiro_nome}}", primeiro);
}

function esperar(no: No): ResultadoDoNo {
  const minutos = Number(no.data.minutos ?? 0);
  if (!Number.isFinite(minutos) || minutos <= 0) {
    return { tipo: "falhou", erro: "A espera precisa de minutos." };
  }
  // Teto de sete dias: acima disso a espera vira um agendamento, e a promessa
  // de durabilidade do passo deixa de ser honesta.
  return { tipo: "esperar", minutos: Math.min(minutos, 7 * 24 * 60) };
}

async function moverEtapa(
  no: No,
  contexto: ContextoDaExecucao,
): Promise<ResultadoDoNo> {
  const stageId = String(no.data.stageId ?? "");

  // A etapa vem da configuração do nó, que é dado do cliente: confere contra a
  // organização E contra o funil antes de gravar.
  const etapa = await prisma.crmStage.findFirst({
    where: {
      id: stageId,
      organizationId: contexto.organizationId,
      funnelId: contexto.funnelId,
    },
    select: { id: true, name: true },
  });
  if (!etapa) {
    return { tipo: "falhou", erro: "A etapa configurada não existe mais." };
  }

  await prisma.crmLead.updateMany({
    where: { id: contexto.leadId, organizationId: contexto.organizationId },
    data: {
      stageId: etapa.id,
      stageEnteredAt: new Date(),
      lastStatusChangeAt: new Date(),
    },
  });

  return seguiu({ etapa: etapa.name });
}

const TEMPERATURAS: CrmTemperature[] = ["COLD", "WARM", "HOT", "VERY_HOT"];

async function definirTemperatura(
  no: No,
  contexto: ContextoDaExecucao,
): Promise<ResultadoDoNo> {
  const valor = String(no.data.temperatura ?? "") as CrmTemperature;
  if (!TEMPERATURAS.includes(valor)) {
    return { tipo: "falhou", erro: "Temperatura inválida." };
  }

  await prisma.crmLead.updateMany({
    where: { id: contexto.leadId, organizationId: contexto.organizationId },
    data: { temperature: valor },
  });

  return seguiu({ temperatura: valor });
}

async function definirResponsavel(
  no: No,
  contexto: ContextoDaExecucao,
): Promise<ResultadoDoNo> {
  const userId = String(no.data.userId ?? "");

  // Só quem é da organização pode virar responsável — sem isso o nó atribuiria
  // lead a um usuário de outro tenant.
  const membro = await prisma.member.findFirst({
    where: { organizationId: contexto.organizationId, userId },
    select: { userId: true },
  });
  if (!membro) {
    return {
      tipo: "falhou",
      erro: "O responsável configurado não é da equipe.",
    };
  }

  await prisma.crmLead.updateMany({
    where: { id: contexto.leadId, organizationId: contexto.organizationId },
    data: { responsibleId: membro.userId, assignedAt: new Date() },
  });

  return seguiu({ responsavel: membro.userId });
}

async function marcarGanhoOuPerda(
  no: No,
  contexto: ContextoDaExecucao,
): Promise<ResultadoDoNo> {
  const resultado = String(no.data.resultado ?? "");
  if (resultado !== "WON" && resultado !== "LOST") {
    return { tipo: "falhou", erro: "Escolha ganho ou perda." };
  }

  await prisma.crmLead.updateMany({
    where: { id: contexto.leadId, organizationId: contexto.organizationId },
    data: {
      currentAction: resultado,
      statusFlow: "FINISHED",
      lastStatusChangeAt: new Date(),
    },
  });

  return seguiu({ resultado });
}

async function chamarUrl(
  no: No,
  contexto: ContextoDaExecucao,
): Promise<ResultadoDoNo> {
  const { chamarWebhook } = await import("./http-seguro");

  const url = String(no.data.url ?? "");
  const metodo = no.data.metodo === "GET" ? "GET" : "POST";

  const lead = await prisma.crmLead.findFirst({
    where: { id: contexto.leadId, organizationId: contexto.organizationId },
    select: { id: true, name: true, phone: true, email: true },
  });

  const resposta = await chamarWebhook({
    url,
    metodo,
    corpo: {
      workflowId: contexto.workflowId,
      lead,
      mensagem: contexto.textoDaMensagem,
    },
  });

  // Status de erro do outro lado é informação, não exceção: registra e segue,
  // que é o que se espera de um webhook de aviso.
  return seguiu({
    status: resposta.status,
    resposta: resposta.corpo.slice(0, 500),
  });
}

async function filtrar(
  no: No,
  contexto: ContextoDaExecucao,
): Promise<ResultadoDoNo> {
  const condicao = no.data.condicao as Condicao | undefined;
  if (!condicao?.campo || !condicao?.operador) {
    return { tipo: "falhou", erro: "O filtro não tem condição." };
  }

  const lead = await prisma.crmLead.findFirst({
    where: { id: contexto.leadId, organizationId: contexto.organizationId },
    select: {
      temperature: true,
      stageId: true,
      responsibleId: true,
      customerId: true,
      amount: true,
    },
  });
  if (!lead) return { tipo: "falhou", erro: "Contato não encontrado." };

  const passou = avaliar(condicao, {
    temperatura: lead.temperature,
    stageId: lead.stageId,
    responsibleId: lead.responsibleId,
    customerId: lead.customerId,
    textoDaMensagem: contexto.textoDaMensagem,
    valor: Number(lead.amount),
  });

  return { tipo: "seguiu", saida: passou ? "sim" : "nao", output: { passou } };
}
