import path from "node:path";
import dotenv from "dotenv";

// Mesma ordem de precedência do Next: `.env.local` primeiro, `.env` depois.
// `import "dotenv/config"` sozinho leria só o `.env`, e é no `.env.local` que
// mora a APP_ENCRYPTION_KEY.
dotenv.config({
  path: [
    path.resolve(__dirname, "../.env.local"),
    path.resolve(__dirname, "../.env"),
  ],
});
import { createHmac } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { decryptAppSecret } from "@/lib/crypto/app-secret";

/**
 * Simula um cliente mandando mensagem no WhatsApp.
 *
 * Monta um payload no formato exato da Meta, **assina com HMAC** usando o App
 * Secret guardado na conexão e faz um POST no webhook de verdade. Ou seja: a
 * mensagem percorre o caminho real inteiro — verificação de assinatura,
 * descoberta de qual organização é dona do número, pipeline de entrada,
 * gravação idempotente e aviso em tempo real. Nada é dublado aqui.
 *
 * É o par do modo demo: aquele dubla só a **saída** (a Meta que receberia a
 * resposta); este exercita a **entrada** sem dublar nada.
 *
 * Uso:
 *   pnpm --filter @nerp/web exec tsx scripts/simular-mensagem-whatsapp.ts <slug-da-org> "texto da mensagem" [telefone]
 *
 * Sem telefone, usa o primeiro lead do funil de demonstração — a mensagem cai
 * numa conversa que já existe. Com um telefone novo, você vê o sistema criar
 * lead e conversa do zero.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";

async function main() {
  const slug = process.argv[2];
  const texto = process.argv[3] ?? "Olá! Esta é uma mensagem de teste.";
  const telefoneInformado = process.argv[4];

  if (!slug) {
    console.log(
      'Uso: tsx scripts/simular-mensagem-whatsapp.ts <slug-da-org> "mensagem" [telefone]',
    );
    return;
  }

  const org = await prisma.organization.findFirst({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`Organização "${slug}" não encontrada.`);

  const conexao = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: org.id },
    select: {
      id: true,
      funnelId: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
    },
  });
  if (!conexao?.metaPhoneNumberId || !conexao.metaAppSecret) {
    throw new Error(
      `A organização "${slug}" não tem conexão de WhatsApp com App Secret. Rode antes o seed-whatsapp-demo.ts.`,
    );
  }

  let telefone = telefoneInformado;
  let nome = "Cliente de teste";

  if (!telefone) {
    const lead = await prisma.crmLead.findFirst({
      where: { funnelId: conexao.funnelId, phone: { not: null } },
      select: { phone: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    if (!lead?.phone) {
      throw new Error(
        "Nenhum lead com telefone no funil. Passe um telefone como terceiro argumento.",
      );
    }
    telefone = lead.phone;
    nome = lead.name;
  }

  const appSecret = decryptAppSecret(conexao.metaAppSecret);

  // Formato exato do que a Meta entrega. O `id` muda a cada execução: id
  // repetido é justamente o que a gravação idempotente descarta — se quiser
  // testar a reentrega, rode duas vezes com o mesmo (edite aqui).
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-de-demonstracao",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "5586988110000",
                phone_number_id: conexao.metaPhoneNumberId,
              },
              contacts: [{ profile: { name: nome }, wa_id: telefone }],
              messages: [
                {
                  from: telefone,
                  id: `wamid.SIMULADA-${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: texto },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const corpo = JSON.stringify(payload);
  const assinatura = `sha256=${createHmac("sha256", appSecret).update(corpo).digest("hex")}`;

  const url = `${BASE}/api/whatsapp/webhook`;
  console.log(`\nEnviando para ${url}`);
  console.log(`  de:   ${nome} <${telefone}>`);
  console.log(`  texto: ${texto}\n`);

  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": assinatura,
    },
    body: corpo,
  });

  const retorno = await resposta.text();
  console.log(`  HTTP ${resposta.status} — ${retorno}\n`);

  if (resposta.ok) {
    console.log("Abra /whatsapp e veja a conversa. Se o Pusher estiver");
    console.log("configurado, a mensagem aparece sem recarregar a página.\n");
  } else {
    console.log("O servidor recusou. Confira se ele está no ar em", BASE, "\n");
  }
}

main()
  .catch((erro) => {
    console.error("\nFalhou:", erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
