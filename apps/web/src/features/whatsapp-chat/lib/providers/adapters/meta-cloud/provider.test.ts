import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { unwrapCapturedFixture } from "@/lib/whatsapp-cloud";
import { MetaCloudProvider } from "./provider";
import { normalizePhoneToMetaE164 } from "./normalize-phone";

/**
 * Testes do adapter da Meta sobre as **capturas reais de webhook** que vieram
 * do Órbita (`src/lib/whatsapp-cloud/__fixtures__/`). São payloads que a Meta
 * de fato entregou em produção — valem mais que qualquer mock escrito à mão,
 * porque é neles que aparecem os campos opcionais que a documentação omite.
 *
 * O que estes testes protegem:
 *
 *  - a **assinatura** do webhook, que é a única coisa entre o endpoint público
 *    e alguém injetando mensagem falsa na conversa de um cliente;
 *  - a **normalização**, onde um campo lido errado faz a mensagem chegar e
 *    sumir sem log.
 */

const APP_SECRET = "segredo-de-teste-do-app";

function carregarFixture(nome: string): unknown {
  const arquivo = path.resolve(
    __dirname,
    "../../../../../../lib/whatsapp-cloud/__fixtures__",
    nome,
  );
  return unwrapCapturedFixture(JSON.parse(readFileSync(arquivo, "utf8")));
}

function assinar(corpo: string, segredo = APP_SECRET): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;
}

function provider(config?: { appSecret?: string }) {
  return new MetaCloudProvider({
    accessToken: "token-de-teste",
    phoneNumberId: "1234567890",
    ...config,
  });
}

describe("MetaCloudProvider.verifyWebhook", () => {
  const corpo = JSON.stringify({ object: "whatsapp_business_account" });

  it("aceita corpo com assinatura correta", () => {
    const p = provider({ appSecret: APP_SECRET });
    expect(
      p.verifyWebhook(corpo, { "x-hub-signature-256": assinar(corpo) }),
    ).toBe(true);
  });

  it("recusa assinatura de outro segredo", () => {
    const p = provider({ appSecret: APP_SECRET });
    expect(
      p.verifyWebhook(corpo, {
        "x-hub-signature-256": assinar(corpo, "outro-segredo"),
      }),
    ).toBe(false);
  });

  it("recusa quando o corpo foi alterado depois de assinado", () => {
    const p = provider({ appSecret: APP_SECRET });
    const assinatura = assinar(corpo);
    expect(
      p.verifyWebhook(`${corpo} `, { "x-hub-signature-256": assinatura }),
    ).toBe(false);
  });

  it("recusa quando não vem assinatura nenhuma", () => {
    const p = provider({ appSecret: APP_SECRET });
    expect(p.verifyWebhook(corpo, {})).toBe(false);
  });

  it("recusa quando a conexão está sem App Secret — falha fechada", () => {
    // Sem segredo não há o que verificar. Aceitar aqui abriria o endpoint
    // para qualquer um que descobrisse a URL.
    const p = provider();
    expect(
      p.verifyWebhook(corpo, { "x-hub-signature-256": assinar(corpo) }),
    ).toBe(false);
  });
});

describe("MetaCloudProvider.normalizeInbound", () => {
  it("normaliza mensagem de texto real", () => {
    const resultado = provider().normalizeInbound(
      carregarFixture("message.json"),
    );

    expect(resultado).not.toBeNull();
    const mensagem = resultado?.messages[0];
    expect(mensagem?.type).toBe("text");
    expect(mensagem?.externalMessageId).toMatch(/^wamid\./);
    expect(mensagem?.sender.fromMe).toBe(false);
    expect(mensagem?.sender.phone).toMatch(/^\d+$/);
    expect(mensagem?.instance.externalId).toBeTruthy();
    expect(mensagem?.sentAt.getTime()).toBeGreaterThan(0);
  });

  it("normaliza imagem preservando id de mídia e mimetype", () => {
    const resultado = provider().normalizeInbound(
      carregarFixture("image.json"),
    );
    const mensagem = resultado?.messages[0];

    expect(mensagem?.type).toBe("media");
    if (mensagem?.type !== "media") throw new Error("esperava mídia");
    expect(mensagem.kind).toBe("image");
    // O id é o caminho de download; a URL da Meta expira em minutos.
    expect(mensagem.mediaId).toBeTruthy();
    expect(mensagem.mimetype).toContain("image/");
  });

  it("normaliza áudio e figurinha como mídia, cada um com seu tipo", () => {
    const audio = provider().normalizeInbound(carregarFixture("audio.json"))
      ?.messages[0];
    const figurinha = provider().normalizeInbound(
      carregarFixture("figurinha.json"),
    )?.messages[0];

    if (audio?.type !== "media") throw new Error("esperava mídia no áudio");
    if (figurinha?.type !== "media")
      throw new Error("esperava mídia na figurinha");

    expect(audio.kind).toBe("audio");
    expect(figurinha.kind).toBe("sticker");
  });

  it("normaliza documento preservando o nome do arquivo", () => {
    const mensagem = provider().normalizeInbound(carregarFixture("docs.json"))
      ?.messages[0];

    if (mensagem?.type !== "media") throw new Error("esperava mídia");
    expect(mensagem.kind).toBe("document");
    expect(mensagem.fileName).toBeTruthy();
  });

  it("devolve null para payload que não é da Meta", () => {
    expect(provider().normalizeInbound({ foo: "bar" })).toBeNull();
    expect(provider().normalizeInbound(null)).toBeNull();
  });

  it("todo id de mensagem é único dentro do payload", () => {
    // A idempotência da pipeline depende do `wamid`; dois ids iguais no mesmo
    // lote significariam sobrescrita silenciosa.
    for (const nome of ["message.json", "image.json", "audio.json"]) {
      const mensagens =
        provider().normalizeInbound(carregarFixture(nome))?.messages ?? [];
      const ids = mensagens.map((m) => m.externalMessageId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => id.length > 0)).toBe(true);
    }
  });
});

describe("normalizePhoneToMetaE164", () => {
  it("insere o nono dígito em celular brasileiro de 12 dígitos", () => {
    expect(normalizePhoneToMetaE164("558688923098")).toBe("5586988923098");
  });

  it("não mexe em número que já tem 13 dígitos", () => {
    expect(normalizePhoneToMetaE164("5586988923098")).toBe("5586988923098");
  });

  it("é idempotente", () => {
    const uma = normalizePhoneToMetaE164("558688923098");
    expect(normalizePhoneToMetaE164(uma)).toBe(uma);
  });

  it("tira máscara antes de decidir", () => {
    expect(normalizePhoneToMetaE164("+55 (86) 98892-3098")).toBe(
      "5586988923098",
    );
  });

  it("deixa número internacional como está", () => {
    expect(normalizePhoneToMetaE164("+1 415 555 0123")).toBe("14155550123");
  });
});
