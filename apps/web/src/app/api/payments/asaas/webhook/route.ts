import { timingSafeEqual } from "node:crypto";
import { estadoDoAsaas } from "@/features/pagamentos/lib/estado-da-cobranca";
import {
  confirmarPagamento,
  registrarEvento,
} from "@/features/pagamentos/server/confirmar-pagamento";
import prisma from "@/lib/db";
import { decifrarCredenciais } from "@/features/integracoes/server/credentials";
import { NextResponse } from "next/server";
import z from "zod";

// TLS mútuo não entra aqui, mas `timingSafeEqual` é do Node: a rota não roda no
// Edge.
export const runtime = "nodejs";

/**
 * Aviso de pagamento do Asaas.
 *
 * Três coisas que o webhook antigo (`/api/assas/webhooks`) não faz, e que são a
 * razão desta rota existir:
 *
 * 1. **Confere assinatura.** O Asaas manda o token configurado no painel em
 *    `asaas-access-token`. Sem essa checagem, quem souber o endereço marca
 *    pedido como pago e a cozinha produz de graça.
 * 2. **Deduplica o evento.** O provedor reenvia quando não recebe 200 a tempo.
 *    Sem trava, o mesmo pedido entra duas vezes na cozinha.
 * 3. **Não deriva número de venda.** Quem cria venda é o checkout, com o
 *    contador atômico; aqui só se confirma o que já existe.
 *
 * Responde 200 para o que não interessa (evento de outro tipo, cobrança que não
 * é nossa): 4xx faz o Asaas reenviar para sempre.
 */
const eventoSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  payment: z
    .object({
      id: z.string().min(1),
      status: z.string().min(1),
      externalReference: z.string().nullable().optional(),
    })
    .optional(),
});

function segredoConfere(recebido: string, esperado: string): boolean {
  // Comparação de tempo constante: `===` vaza o tamanho do prefixo correto
  // pelo tempo de resposta, e isso é o bastante para descobrir o token.
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const corpo = await req.json().catch(() => null);
  const evento = eventoSchema.safeParse(corpo);

  if (!evento.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const pagamento = evento.data.payment;
  if (!pagamento) {
    // Evento que não fala de cobrança (assinatura, transferência). Nada a fazer.
    return NextResponse.json({ ignored: true });
  }

  // A cobrança diz de qual organização é o evento — e é ela que aponta para a
  // credencial cujo segredo assina este webhook.
  const cobranca = await prisma.charge.findUnique({
    where: {
      provider_externalId: { provider: "asaas", externalId: pagamento.id },
    },
    select: { integration: { select: { credentialsCiphertext: true } } },
  });

  if (!cobranca) {
    // Cobrança que não é nossa (outra instalação apontando para cá). 200 para
    // o Asaas parar de reenviar.
    return NextResponse.json({ ignored: true });
  }

  const credenciais = cobranca.integration?.credentialsCiphertext
    ? decifrarCredenciais(cobranca.integration.credentialsCiphertext)
    : {};
  const esperado = credenciais.webhookSecret ?? "";

  if (!esperado) {
    // Fail-closed: instalação sem segredo configurado não aceita aviso de
    // pagamento. O contrário seria uma porta aberta por esquecimento.
    console.warn(
      "[asaas] webhook recusado: instalação sem segredo configurado",
    );
    return NextResponse.json(
      { error: "Webhook não configurado" },
      { status: 401 },
    );
  }

  const recebido = req.headers.get("asaas-access-token") ?? "";
  if (!segredoConfere(recebido, esperado)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const novo = await registrarEvento("asaas", evento.data.id);
  if (!novo) {
    return NextResponse.json({ duplicated: true });
  }

  const resultado = await confirmarPagamento({
    provider: "asaas",
    externalId: pagamento.id,
    estado: estadoDoAsaas(pagamento.status),
  });

  if (!resultado.ok) {
    // Nada a corrigir do lado do Asaas — reenviar não mudaria o desfecho.
    return NextResponse.json({ ignored: resultado.motivo });
  }

  return NextResponse.json({
    ok: true,
    foiParaCozinha: resultado.foiParaCozinha,
  });
}
