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
