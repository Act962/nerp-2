import "server-only";

import { sanitizarErro } from "@/features/integracoes/server/credentials";
import { ACOES, cobrarAcao, estornar } from "@/features/stars/server/debitar";
import prisma from "@/lib/db";
import {
  extensaoDoMime,
  guardarMidia,
  midiaObjectKey,
} from "../lib/media-storage";
import {
  janelaDeAtendimentoAberta,
  registrarSaida,
} from "../lib/outbound/registrar-saida";
import type { CanonicalMediaKind } from "../lib/providers";
import {
  OutboundProviderError,
  resolveOutboundProvider,
} from "../lib/providers";
import type { FalhaDeEnvio } from "./enviar-texto";

/**
 * O que a Meta aceita, por tipo, e até que tamanho.
 *
 * Recusar aqui é mais barato e mais claro que descobrir pelo erro do Graph: o
 * atendente vê "esse formato não vai" antes de esperar o upload de 20 MB
 * terminar para levar um erro em inglês.
 *
 * Os tetos são os da Cloud API. Documento pode ir a 100 MB do lado da Meta,
 * mas aqui fica em 25: o arquivo passa pela memória do servidor duas vezes
 * (upload para a Meta e gravação no bucket), e um worker segurando 100 MB por
 * envio derruba a caixa de entrada de todo mundo.
 */
const ACEITOS: Record<
  CanonicalMediaKind,
  { mimes: string[]; limiteMb: number }
> = {
  image: { mimes: ["image/jpeg", "image/png"], limiteMb: 5 },
  video: { mimes: ["video/mp4", "video/3gpp"], limiteMb: 16 },
  audio: {
    mimes: [
      "audio/aac",
      "audio/mp4",
      "audio/mpeg",
      "audio/amr",
      "audio/ogg",
      "audio/opus",
    ],
    limiteMb: 16,
  },
  sticker: { mimes: ["image/webp"], limiteMb: 1 },
  document: { mimes: [], limiteMb: 25 },
};

export type ResultadoDeEnvioDeMidia =
  | { ok: true; messageId: string; externalMessageId: string; createdAt: Date }
  | {
      ok: false;
      codigo: FalhaDeEnvio | "ARQUIVO_RECUSADO";
      mensagem: string;
    };

/** Deduz o tipo pela família do mimetype; o resto é documento. */
export function tipoDaMidia(mimetype: string): CanonicalMediaKind {
  if (mimetype === "image/webp") return "sticker";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
}

export function conferirArquivo(input: {
  mimetype: string;
  tamanho: number;
}): { ok: true; tipo: CanonicalMediaKind } | { ok: false; mensagem: string } {
  const tipo = tipoDaMidia(input.mimetype);
  const regra = ACEITOS[tipo];

  if (regra.mimes.length > 0 && !regra.mimes.includes(input.mimetype)) {
    return {
      ok: false,
      mensagem: `O WhatsApp não aceita ${input.mimetype} — para ${tipo === "image" ? "imagem use JPG ou PNG" : "esse tipo, converta o arquivo"}.`,
    };
  }

  if (input.tamanho > regra.limiteMb * 1024 * 1024) {
    return {
      ok: false,
      mensagem: `Arquivo grande demais: o limite para ${rotulo(tipo)} é ${regra.limiteMb} MB.`,
    };
  }

  if (input.tamanho === 0) {
    return { ok: false, mensagem: "O arquivo está vazio." };
  }

  return { ok: true, tipo };
}

function rotulo(tipo: CanonicalMediaKind): string {
  const nomes: Record<CanonicalMediaKind, string> = {
    image: "imagem",
    video: "vídeo",
    audio: "áudio",
    document: "documento",
    sticker: "figurinha",
  };
  return nomes[tipo];
}

/**
 * Envia um arquivo por uma conversa.
 *
 * Mesma ordem de `enviarTexto`, com o upload no meio:
 *
 *  1. Confere o arquivo — antes de gastar rede com o que a Meta recusaria.
 *  2. Resolve o provedor.
 *  3. **Sobe o arquivo** e pega o id. Subir não envia nada nem cobra nada, e
 *     precisa acontecer antes do envio porque o bucket é privado: mandar
 *     `mediaUrl` exigiria expor o arquivo na internet.
 *  4. Cobra.
 *  5. Envia; falhou, estorna.
 *  6. **Só então** guarda no bucket e grava a mensagem. Guardar antes deixaria
 *     lixo no bucket para todo envio que não deu certo.
 */
export async function enviarMidia(input: {
  organizationId: string;
  conversationId: string;
  arquivo: Buffer;
  mimetype: string;
  fileName?: string;
  legenda?: string;
  autorId: string;
}): Promise<ResultadoDeEnvioDeMidia> {
  const conferencia = conferirArquivo({
    mimetype: input.mimetype,
    tamanho: input.arquivo.byteLength,
  });
  if (!conferencia.ok) {
    return {
      ok: false,
      codigo: "ARQUIVO_RECUSADO",
      mensagem: conferencia.mensagem,
    };
  }

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

  let mediaId: string;
  try {
    const enviado = await provider.uploadMedia({
      file: input.arquivo,
      mimetype: input.mimetype,
      fileName: input.fileName,
    });
    mediaId = enviado.mediaId;
  } catch (erro) {
    return {
      ok: false,
      codigo: "FALHA_NO_ENVIO",
      mensagem: sanitizarErro(
        erro instanceof Error ? erro.message : "Falha ao enviar o arquivo",
        [],
      ),
    };
  }

  const cobranca = await cobrarAcao({
    organizationId: input.organizationId,
    actionKey: ACOES.mensagemEnviada,
    descricao: "Arquivo enviado no WhatsApp",
    userId: input.autorId,
  });

  let externalMessageId: string;
  try {
    const resultado = await provider.sendMedia({
      kind: "media",
      to: telefone,
      mediaKind: conferencia.tipo,
      mediaId,
      mimetype: input.mimetype,
      fileName: input.fileName,
      caption: input.legenda,
    });
    externalMessageId = resultado.externalMessageId;
  } catch (erro) {
    if (cobranca.cobrado) {
      await estornar({
        organizationId: input.organizationId,
        valor: cobranca.valor,
        descricao: "Estorno: o arquivo não chegou a ser enviado",
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
      mensagem: sanitizarErro(
        erro instanceof Error ? erro.message : "Falha ao enviar",
        [],
      ),
    };
  }

  // Guardado depois do envio confirmado, e sem poder derrubá-lo: a mensagem
  // saiu, e uma falha de bucket não pode fazer a tela dizer que não saiu. Sem
  // a chave, a bolha mostra a legenda sem a prévia do arquivo — o cliente já
  // recebeu, só nós é que perdemos a cópia.
  let mediaKey: string | null = null;
  try {
    const chave = midiaObjectKey(
      input.organizationId,
      conversa.id,
      `${externalMessageId}.${extensaoDoMime(input.mimetype)}`,
    );
    await guardarMidia(chave, input.arquivo, input.mimetype);
    mediaKey = chave;
  } catch (erro) {
    console.error("[whatsapp:outbound] guardar_midia_falhou", erro);
  }

  const mensagem = await registrarSaida({
    organizationId: input.organizationId,
    funnelId: conversa.funnelId,
    conversationId: conversa.id,
    leadId: lead.id,
    externalMessageId,
    corpo: input.legenda ?? "",
    autorId: input.autorId,
    primeiraResposta: lead.firstResponseAt === null,
    estavaEsperando: lead.statusFlow === "WAITING",
    midia: {
      mediaKey,
      mediaType: conferencia.tipo,
      mimetype: input.mimetype,
      fileName: input.fileName ?? null,
      caption: input.legenda ?? null,
    },
  });

  return {
    ok: true,
    messageId: mensagem.id,
    externalMessageId,
    createdAt: mensagem.createdAt,
  };
}
