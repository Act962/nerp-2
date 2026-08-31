import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { call } from "@orpc/server";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/whatsapp/webhook/route";
import { createFunnel } from "@/app/router/crm/create-funnel";
import { encryptMetaCredentialsInput } from "@/features/whatsapp-chat/lib/providers/meta-credentials";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { unwrapCapturedFixture } from "@/lib/whatsapp-cloud";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * O webhook de ponta a ponta: requisição HTTP assinada → banco.
 *
 * Sobe a rota de verdade (o `POST` exportado pelo route handler) com o corpo
 * de uma captura real e a assinatura calculada como a Meta calcula. É o teste
 * que cobre a parte que nenhum teste de unidade alcança: a **ordem** entre ler
 * o corpo cru, achar a conexão e validar o HMAC.
 */

const APP_SECRET = "app-secret-desta-organizacao";
const PHONE_NUMBER_ID = "1098624330008863";

function corpoDaCaptura(nome: string): string {
  const arquivo = path.resolve(
    __dirname,
    "../../src/lib/whatsapp-cloud/__fixtures__",
    nome,
  );
  const payload = unwrapCapturedFixture(
    JSON.parse(readFileSync(arquivo, "utf8")),
  );
  return JSON.stringify(payload);
}

function requisicao(corpo: string, assinatura?: string): NextRequest {
  return new NextRequest("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    body: corpo,
    headers: {
      "content-type": "application/json",
      ...(assinatura ? { "x-hub-signature-256": assinatura } : {}),
    },
  });
}

function assinar(corpo: string, segredo = APP_SECRET): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;
}

let org: Organization;
let admin: User;
let funnelId: string;

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Rede do webhook");
  admin = await createUser();
  await createMember(admin, org);

  const funil = await call(
    createFunnel,
    { name: "Atendimento" },
    { context: s2sContext(admin, org) },
  );
  funnelId = funil.id;

  await prisma.whatsAppConnection.create({
    data: {
      organizationId: org.id,
      funnelId,
      name: "Número de teste",
      ...encryptMetaCredentialsInput({
        accessToken: "token-de-teste",
        phoneNumberId: PHONE_NUMBER_ID,
        appSecret: APP_SECRET,
      }),
    },
  });
});

afterAll(resetDb);

describe("POST /api/whatsapp/webhook", () => {
  it("recusa corpo sem assinatura", async () => {
    const corpo = corpoDaCaptura("message.json");
    const resposta = await POST(requisicao(corpo));
    expect(resposta.status).toBe(401);

    expect(
      await prisma.message.count({ where: { organizationId: org.id } }),
    ).toBe(0);
  });

  it("recusa assinatura calculada com outro segredo", async () => {
    const corpo = corpoDaCaptura("message.json");
    const resposta = await POST(
      requisicao(corpo, assinar(corpo, "segredo-errado")),
    );
    expect(resposta.status).toBe(401);
  });

  it("recusa quando o corpo muda depois de assinado", async () => {
    // Prova que a validação usa os bytes crus: um espaço a mais já invalida.
    const corpo = corpoDaCaptura("message.json");
    const assinatura = assinar(corpo);
    const resposta = await POST(requisicao(`${corpo} `, assinatura));
    expect(resposta.status).toBe(401);
  });

  it("aceita a captura real assinada e grava a mensagem", async () => {
    const corpo = corpoDaCaptura("message.json");
    const resposta = await POST(requisicao(corpo, assinar(corpo)));
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({
      ok: true,
      gravadas: 1,
    });

    const mensagem = await prisma.message.findFirstOrThrow({
      where: { organizationId: org.id },
      include: { conversation: { include: { lead: true } } },
    });
    expect(mensagem.fromMe).toBe(false);
    expect(mensagem.conversation.lead.phone).toBe("558688923098");
    expect(mensagem.conversation.funnelId).toBe(funnelId);
  });

  it("a reentrega do mesmo webhook não duplica nada", async () => {
    const antes = await prisma.message.count({
      where: { organizationId: org.id },
    });

    const corpo = corpoDaCaptura("message.json");
    const assinatura = assinar(corpo);
    await POST(requisicao(corpo, assinatura));
    await POST(requisicao(corpo, assinatura));

    expect(
      await prisma.message.count({ where: { organizationId: org.id } }),
    ).toBe(antes);
  });

  it("responde 401 para número que não conhecemos", async () => {
    // Sem conexão não há App Secret com que validar — e 401 faz a Meta parar
    // de retentar, que é o certo para webhook apontado no ambiente errado.
    const corpo = corpoDaCaptura("message.json").replace(
      PHONE_NUMBER_ID,
      "000000000000000",
    );
    const resposta = await POST(requisicao(corpo, assinar(corpo)));
    expect(resposta.status).toBe(401);
  });

  it("reconhece com 200 evento que não é mensagem", async () => {
    const corpo = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    });
    const resposta = await POST(requisicao(corpo, assinar(corpo)));
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({
      ignorado: "sem_phone_number_id",
    });
  });
});

/**
 * A regressão: um POST com mais de um `phone_number_id` era descartado com
 * 200. Como 2xx faz a Meta considerar entregue, a mensagem do cliente sumia
 * sem retentativa — e a Meta agrupa justamente quando os números estão sob o
 * mesmo App, que é o arranjo normal quando o nerp é o BSP.
 *
 * O que os dois testes fixam: o lote é processado, **e** cada mensagem cai na
 * organização dona do número. Aprovar o lote inteiro porque o segredo de uma
 * conexão confere deixaria quem conhece esse segredo escrever na conversa da
 * vizinha.
 */
describe("lote com mais de um número", () => {
  const PHONE_DA_VIZINHA = "2098624330008863";
  const CLIENTE_DA_VIZINHA = "5511999990000";

  let vizinha: Organization;
  let funilDaVizinha: string;

  beforeAll(async () => {
    vizinha = await createOrg("Rede vizinha");
    const adminDaVizinha = await createUser();
    await createMember(adminDaVizinha, vizinha);

    const funil = await call(
      createFunnel,
      { name: "Atendimento" },
      { context: s2sContext(adminDaVizinha, vizinha) },
    );
    funilDaVizinha = funil.id;
  });

  /** Envelope com duas `entry`, uma por número, como a Meta agrupa. */
  function corpoComDoisNumeros(): string {
    const payload = JSON.parse(corpoDaCaptura("message.json"));

    payload.entry[0].changes[0].value.messages[0].id = "wamid.PRIMEIRA-LOTE";

    const daVizinha = structuredClone(payload.entry[0]);
    const valor = daVizinha.changes[0].value;
    valor.metadata.phone_number_id = PHONE_DA_VIZINHA;
    valor.contacts[0].wa_id = CLIENTE_DA_VIZINHA;
    valor.messages[0].from = CLIENTE_DA_VIZINHA;
    valor.messages[0].id = "wamid.VIZINHA-LOTE";
    payload.entry.push(daVizinha);

    return JSON.stringify(payload);
  }

  it("processa os dois quando as conexões compartilham o App Secret", async () => {
    await prisma.whatsAppConnection.create({
      data: {
        organizationId: vizinha.id,
        funnelId: funilDaVizinha,
        name: "Número da vizinha",
        ...encryptMetaCredentialsInput({
          accessToken: "token-da-vizinha",
          phoneNumberId: PHONE_DA_VIZINHA,
          appSecret: APP_SECRET,
        }),
      },
    });

    const corpo = corpoComDoisNumeros();
    const resposta = await POST(requisicao(corpo, assinar(corpo)));

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({
      ok: true,
      gravadas: 2,
    });

    const naVizinha = await prisma.message.findFirstOrThrow({
      where: { organizationId: vizinha.id },
      include: { conversation: { include: { lead: true } } },
    });
    expect(naVizinha.conversation.lead.phone).toBe(CLIENTE_DA_VIZINHA);
    expect(naVizinha.conversation.funnelId).toBe(funilDaVizinha);

    // E nada da vizinha atravessou para a primeira organização.
    expect(
      await prisma.message.count({
        where: {
          organizationId: org.id,
          conversation: { lead: { phone: CLIENTE_DA_VIZINHA } },
        },
      }),
    ).toBe(0);
  });

  it("processa só o número cujo próprio segredo valida o corpo", async () => {
    // A vizinha passa a ter App Secret próprio: a assinatura do corpo é feita
    // com o segredo da PRIMEIRA, então só ela pode ser processada.
    await prisma.whatsAppConnection.updateMany({
      where: { organizationId: vizinha.id },
      data: encryptMetaCredentialsInput({ appSecret: "segredo-so-da-vizinha" }),
    });

    const antesNaVizinha = await prisma.message.count({
      where: { organizationId: vizinha.id },
    });

    const payload = JSON.parse(corpoComDoisNumeros());
    payload.entry[0].changes[0].value.messages[0].id = "wamid.PRIMEIRA-MISTA";
    payload.entry[1].changes[0].value.messages[0].id = "wamid.VIZINHA-MISTA";
    const corpo = JSON.stringify(payload);

    const resposta = await POST(requisicao(corpo, assinar(corpo)));

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({ gravadas: 1 });

    // A mensagem da vizinha não entrou: o corpo não foi assinado com o segredo
    // dela, e aceitar seria deixar a primeira forjar conversa na vizinha.
    expect(
      await prisma.message.count({ where: { organizationId: vizinha.id } }),
    ).toBe(antesNaVizinha);

    // E — o que importa de verdade — ela também não caiu na organização que
    // autenticou. Processar o envelope inteiro porque uma conexão passou na
    // assinatura entregaria a conversa da vizinha a quem não é dono dela.
    expect(
      await prisma.message.findFirst({
        where: {
          organizationId: org.id,
          externalMessageId: "wamid.VIZINHA-MISTA",
        },
      }),
    ).toBeNull();
  });
});
