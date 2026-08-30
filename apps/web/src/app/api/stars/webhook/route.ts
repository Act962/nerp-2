import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { creditar } from "@/features/stars/server/debitar";
import prisma from "@/lib/db";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Webhook da recarga de ★.
 *
 * **Separado** do `/api/stripe/webhooks`, que é do checkout da loja, e com
 * segredo próprio (`STRIPE_STARS_WEBHOOK_SECRET`). Dois produtos de cobrança
 * diferentes no mesmo handler é como um evento acaba processado pelo ramo
 * errado — e aqui o ramo errado credita dinheiro.
 *
 * Três garantias:
 *
 *  1. **Assinatura conferida** com o corpo cru. Sem ela, qualquer um credita
 *     ★ mandando um POST.
 *  2. **Idempotência por `ProcessedStripeEvent`**, gravado antes de creditar.
 *     O Stripe reentrega em qualquer resposta que não seja 2xx, e creditar
 *     duas vezes é dar crédito de graça.
 *  3. **Valor e quantidade saem do banco**, pelo `starsPaymentId` dos
 *     metadados — nunca do payload. Metadado é ponto de partida para achar a
 *     linha, não fonte de verdade sobre quanto creditar.
 */
export async function POST(request: Request) {
  const assinatura = request.headers.get("stripe-signature");
  const segredo = process.env.STRIPE_STARS_WEBHOOK_SECRET;

  if (!segredo) {
    console.error("[stars:webhook] STRIPE_STARS_WEBHOOK_SECRET ausente");
    return NextResponse.json({ erro: "Não configurado" }, { status: 500 });
  }

  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(
      await request.text(),
      assinatura ?? "",
      segredo,
    );
  } catch (erro) {
    // Falha fechada: assinatura ruim não é processada, e o motivo não volta
    // para quem mandou.
    console.error(
      "[stars:webhook] assinatura_invalida",
      erro instanceof Error ? erro.message : erro,
    );
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 400 });
  }

  if (evento.type !== "checkout.session.completed") {
    // 200 para o Stripe parar de reentregar o que não nos interessa.
    return NextResponse.json({ ignorado: evento.type });
  }

  // Grava o evento ANTES de creditar. Se duas entregas chegarem juntas, a
  // segunda falha na chave primária e sai por aqui sem creditar de novo.
  try {
    await prisma.processedStripeEvent.create({
      data: { id: evento.id, type: evento.type, source: "stars" },
    });
  } catch {
    return NextResponse.json({ repetido: evento.id });
  }

  const sessao = evento.data.object as Stripe.Checkout.Session;
  const paymentId = sessao.metadata?.starsPaymentId;

  if (!paymentId) {
    // Evento de outro produto que caiu neste endereço por engano de
    // configuração. Não é erro nosso, e reentregar não resolveria.
    return NextResponse.json({ ignorado: "sem starsPaymentId" });
  }

  const pagamento = await prisma.starsPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      organizationId: true,
      starsAmount: true,
      status: true,
      userId: true,
    },
  });

  if (!pagamento) {
    console.error("[stars:webhook] pagamento_nao_encontrado", { paymentId });
    return NextResponse.json({ ignorado: "pagamento não encontrado" });
  }

  if (pagamento.status === "paid") {
    return NextResponse.json({ repetido: pagamento.id });
  }

  if (sessao.payment_status !== "paid") {
    await prisma.starsPayment.update({
      where: { id: pagamento.id },
      data: { status: "pending" },
    });
    return NextResponse.json({ aguardando: sessao.payment_status });
  }

  await prisma.starsPayment.update({
    where: { id: pagamento.id },
    data: {
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId:
        typeof sessao.payment_intent === "string"
          ? sessao.payment_intent
          : null,
    },
  });

  // A quantidade vem da linha gravada quando o checkout foi aberto, com o
  // preço da tabela de pacotes — não do que chegou pelo webhook.
  const saldo = await creditar({
    organizationId: pagamento.organizationId,
    valor: pagamento.starsAmount,
    tipo: "TOPUP_PURCHASE",
    descricao: `Recarga de ${pagamento.starsAmount} ★`,
    userId: pagamento.userId,
  });

  console.log("[stars:webhook] recarga_creditada", {
    paymentId: pagamento.id,
    organizationId: pagamento.organizationId,
    saldo,
  });

  return NextResponse.json({ creditado: pagamento.starsAmount, saldo });
}
