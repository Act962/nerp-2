import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { aplicarStatusDeCampanha } from "@/features/campanhas/server/aplicar-status";
import { getConnectionByMetaPhoneNumberId } from "@/features/whatsapp-chat/lib/get-connection-by-phone-number-id";
import { applyStatusUpdates } from "@/features/whatsapp-chat/lib/inbound/apply-status-updates";
import { criarEstrategiaDeMidiaMeta } from "@/features/whatsapp-chat/lib/inbound/meta-media-strategy";
import { persistInboundMessage } from "@/features/whatsapp-chat/lib/inbound/persist-inbound-message";
import { createProvider } from "@/features/whatsapp-chat/lib/providers";
import prisma from "@/lib/db";
import {
  isMetaSignatureValid,
  parseWhatsAppOfficialWebhook,
  verifyWebhookChallenge,
} from "@/lib/whatsapp-cloud";
import { decryptAppSecret } from "@/lib/crypto/app-secret";

/**
 * Webhook da WhatsApp Cloud API.
 *
 * Endpoint **único** para toda a plataforma: a Meta não aceita querystring na
 * URL do webhook, então não dá para ter um por organização. Quem decide de
 * quem é a mensagem é o `metadata.phone_number_id` do próprio payload, casado
 * com `WhatsAppConnection.metaPhoneNumberId`.
 *
 * ## A ordem das etapas do POST é a segurança
 *
 * 1. ler o corpo **cru** — o HMAC é sobre os bytes exatos; `JSON.parse`
 *    seguido de `stringify` muda espaços e a assinatura deixa de bater;
 * 2. espiar o JSON só para extrair os `phone_number_id`;
 * 3. resolver as conexões (é delas que vêm o App Secret e a organização);
 * 4. **só então** validar o HMAC, uma vez por conexão, com falha fechada;
 * 5. validar o formato com Zod;
 * 6. recortar o envelope por número e entregar cada pedaço à pipeline da sua
 *    organização.
 *
 * Inverter 3 e 4 é impossível — sem saber de quem é a mensagem não se sabe
 * com qual segredo verificar. Por isso o passo 3 não pode ter efeito nenhum
 * além da leitura.
 *
 * O passo 4 é **por conexão**, não uma vez só: um POST pode trazer números de
 * organizações diferentes, e aprovar o lote inteiro porque o segredo de uma
 * delas confere deixaria quem conhece esse segredo escrever na conversa da
 * vizinha. Só entra na pipeline o número cujo próprio segredo valida o corpo.
 *
 * ## Código de resposta e a retentativa da Meta
 *
 * A Meta retenta com agressividade em qualquer resposta fora de 2xx, por
 * horas. Então:
 *
 *  - erro que **retentar não conserta** (formato inesperado, evento que não
 *    é mensagem, número desconhecido para nós) → `200`, com log;
 *  - **assinatura inválida** → `401`: é configuração errada de quem enviou, e
 *    queremos que a Meta pare;
 *  - falha transitória nossa (banco fora do ar) → `500`, para ela retentar.
 */

/** Comparação sem vazar por tempo — `===` termina no primeiro caractere diferente. */
function comparaEmTempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ── GET: o aperto de mão de verificação ───────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!verifyToken) return new NextResponse("Forbidden", { status: 403 });

  // Primeiro o token global — é o que as conexões feitas pelo onboarding da
  // Meta usam, já que elas não recebem token próprio.
  const tokenGlobal = process.env.META_VERIFY_TOKEN_GLOBAL;
  let tokenQueBateu: string | null =
    tokenGlobal && comparaEmTempoConstante(tokenGlobal, verifyToken)
      ? tokenGlobal
      : null;

  // Depois as conexões com token próprio. A Meta manda só o token, sem dizer
  // de quem é, então é varredura mesmo — mas o handshake acontece uma vez por
  // configuração, não a cada mensagem.
  //
  // A varredura é de **trabalho constante**: não interrompe ao encontrar. Sair
  // no primeiro acerto revelaria, pelo tempo de resposta, tanto o tamanho do
  // parque quanto — comparando caractere a caractere — o próprio token.
  const candidatas = await prisma.whatsAppConnection.findMany({
    where: { metaVerifyToken: { not: null } },
    select: { id: true, metaVerifyToken: true },
  });

  for (const candidata of candidatas) {
    if (!candidata.metaVerifyToken) continue;
    try {
      const emClaro = decryptAppSecret(candidata.metaVerifyToken);
      if (
        tokenQueBateu === null &&
        comparaEmTempoConstante(emClaro, verifyToken)
      ) {
        tokenQueBateu = emClaro;
      }
    } catch (error) {
      console.error("[whatsapp:webhook:GET] decifra_falhou", {
        connectionId: candidata.id,
        error,
      });
    }
  }

  if (!tokenQueBateu) return new NextResponse("Forbidden", { status: 403 });

  const desafio = verifyWebhookChallenge(
    { mode, verifyToken, challenge },
    tokenQueBateu,
  );
  if (!desafio) return new NextResponse("Forbidden", { status: 403 });

  return new NextResponse(desafio, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

/**
 * Extrai os `phone_number_id` distintos do envelope sem confiar no formato:
 * o payload ainda não passou pelo Zod nesta altura.
 */
function extrairPhoneNumberIds(payload: unknown): string[] {
  const ids = new Set<string>();
  const entradas = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entradas)) return [];

  for (const entrada of entradas) {
    const mudancas = (entrada as { changes?: unknown })?.changes;
    if (!Array.isArray(mudancas)) continue;
    for (const mudanca of mudancas) {
      const id = (
        mudanca as { value?: { metadata?: { phone_number_id?: unknown } } }
      )?.value?.metadata?.phone_number_id;
      if (typeof id === "string" && id.length > 0) ids.add(id);
    }
  }
  return Array.from(ids);
}

/**
 * Devolve um envelope com **só** as mudanças de um `phone_number_id`.
 *
 * A Meta pode agrupar num POST só os eventos de vários números da mesma conta,
 * e cada número pertence a uma organização. Sem recortar, o lote inteiro seria
 * normalizado como se fosse de um único dono — ou, como era antes, descartado.
 *
 * Trabalha sobre o JSON cru: nesta altura o Zod ainda não passou.
 */
function recortarPorPhoneNumberId(payload: unknown, alvo: string): unknown {
  const entradas = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entradas)) return payload;

  const recortadas = entradas
    .map((entrada) => {
      const mudancas = (entrada as { changes?: unknown })?.changes;
      if (!Array.isArray(mudancas)) return null;
      const minhas = mudancas.filter(
        (mudanca) =>
          (mudanca as { value?: { metadata?: { phone_number_id?: unknown } } })
            ?.value?.metadata?.phone_number_id === alvo,
      );
      return minhas.length > 0
        ? { ...(entrada as object), changes: minhas }
        : null;
    })
    .filter((entrada) => entrada !== null);

  return { ...(payload as object), entry: recortadas };
}

// ── POST: os eventos ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let corpoCru: string;
  try {
    corpoCru = await request.text();
  } catch (error) {
    console.error("[whatsapp:webhook] leitura_do_corpo_falhou", error);
    return NextResponse.json(
      { ok: false, motivo: "leitura_do_corpo_falhou" },
      { status: 400 },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(corpoCru);
  } catch {
    return NextResponse.json(
      { ok: false, motivo: "json_invalido" },
      { status: 400 },
    );
  }

  const phoneNumberIds = extrairPhoneNumberIds(json);

  if (phoneNumberIds.length === 0) {
    // Evento que não é mensagem (atualização de conta, status de template).
    // Reconhece com 200 para a Meta não ficar retentando.
    return NextResponse.json(
      { ok: true, ignorado: "sem_phone_number_id" },
      { status: 200 },
    );
  }

  const assinatura = request.headers.get("x-hub-signature-256");

  // O envelope permite vários números num POST só, e é o que a Meta faz quando
  // os números estão sob o mesmo App. Antes o lote inteiro era descartado com
  // 200 — e 2xx faz a Meta considerar entregue, então a mensagem do cliente
  // sumia sem retentativa. Agora cada número é resolvido e conferido com **o
  // App Secret da sua própria conexão**: valida contra o segredo de um e
  // processar o do outro seria deixar quem conhece um segredo forjar mensagem
  // para a organização vizinha.
  let conexoes: NonNullable<
    Awaited<ReturnType<typeof getConnectionByMetaPhoneNumberId>>
  >[];
  try {
    const resolvidas = await Promise.all(
      phoneNumberIds.map((id) => getConnectionByMetaPhoneNumberId(id)),
    );
    conexoes = resolvidas.filter((c) => c !== null);
  } catch (error) {
    // Banco fora do ar é transitório: 500 para a Meta reentregar.
    console.error("[whatsapp:webhook] busca_da_conexao_falhou", error);
    return NextResponse.json(
      { ok: false, motivo: "indisponivel" },
      { status: 500 },
    );
  }

  if (conexoes.length === 0) {
    // Nenhum número conhecido: sem App Secret não há como validar nada.
    // 401 para a Meta parar — é webhook apontado para o ambiente errado.
    console.warn("[whatsapp:webhook] phone_number_id_desconhecido", {
      phoneNumberIds,
    });
    return new NextResponse("Unknown phone_number_id", { status: 401 });
  }

  const autenticadas = conexoes.filter((conexao) => {
    const appSecret = conexao.appSecret ?? process.env.META_APP_SECRET ?? null;
    if (!appSecret) {
      console.warn("[whatsapp:webhook] sem_app_secret", {
        connectionId: conexao.connectionId,
      });
      return false;
    }
    if (!isMetaSignatureValid(corpoCru, assinatura, appSecret)) {
      console.warn("[whatsapp:webhook] assinatura_invalida", {
        connectionId: conexao.connectionId,
        temHeader: Boolean(assinatura),
        origemDoSegredo: conexao.appSecret ? "conexao" : "env_global",
      });
      return false;
    }
    return true;
  });

  if (autenticadas.length === 0) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  if (!parseWhatsAppOfficialWebhook(json)) {
    // Assinado corretamente, mas com formato que não conhecemos — tipo novo
    // da Meta. 200 com log: retentar não muda nada.
    console.warn("[whatsapp:webhook] formato_inesperado", { phoneNumberIds });
    return NextResponse.json(
      { ok: true, ignorado: "formato_inesperado" },
      { status: 200 },
    );
  }

  let gravadas = 0;
  let ignoradas = 0;
  let statusAplicados = 0;
  let statusDeCampanha = 0;

  for (const conexao of autenticadas) {
    const appSecret = conexao.appSecret ?? process.env.META_APP_SECRET ?? "";
    const provider = createProvider("meta-cloud", {
      accessToken: conexao.accessToken,
      phoneNumberId: conexao.phoneNumberId,
      appSecret,
    });

    // Cada organização enxerga só o que é dela. Normalizar o envelope inteiro
    // gravaria a mensagem da vizinha no funil errado.
    //
    // O atalho olha quantos números o ENVELOPE traz, não quantas conexões
    // passaram na assinatura: com dois números e só um autenticado, pular o
    // recorte entregaria as duas mensagens à organização que autenticou.
    const meuPedaco =
      phoneNumberIds.length === 1
        ? json
        : recortarPorPhoneNumberId(json, conexao.phoneNumberId);

    const normalizado = provider.normalizeInbound(meuPedaco);
    if (!normalizado) continue;

    const baixarMidia = criarEstrategiaDeMidiaMeta({
      accessToken: conexao.accessToken,
      organizationId: conexao.organizationId,
    });

    // Uma mensagem que falha não pode impedir as outras do mesmo lote: a Meta
    // reentregaria o lote inteiro, e as que já entraram seriam reprocessadas.
    // O `upsert` torna isso inofensivo, mas ainda assim tratamos uma a uma.
    for (const mensagem of normalizado.messages) {
      try {
        const resultado = await persistInboundMessage(mensagem, {
          organizationId: conexao.organizationId,
          funnelId: conexao.funnelId,
          baixarMidia,
        });
        if ("messageId" in resultado) gravadas += 1;
        else ignoradas += 1;
      } catch (error) {
        console.error("[whatsapp:webhook] falha_ao_gravar_mensagem", {
          externalMessageId: mensagem.externalMessageId,
          error,
        });
        // 500 para a Meta reentregar: é falha nossa, e reprocessar é seguro
        // porque a gravação é idempotente pelo id da mensagem.
        return NextResponse.json(
          { ok: false, motivo: "falha_ao_gravar" },
          { status: 500 },
        );
      }
    }

    // O mesmo aviso serve para dois destinos: o tique da mensagem no chat e o
    // status do destinatário da campanha. Qual dos dois responde depende de
    // onde o `wamid` foi gravado — por isso os dois são consultados.
    const atualizacoes = normalizado.statusUpdates ?? [];
    statusAplicados += (
      await applyStatusUpdates(atualizacoes, conexao.organizationId)
    ).aplicadas;
    statusDeCampanha += (
      await aplicarStatusDeCampanha(atualizacoes, conexao.organizationId)
    ).aplicadas;
  }

  return NextResponse.json(
    { ok: true, gravadas, ignoradas, statusAplicados, statusDeCampanha },
    { status: 200 },
  );
}
