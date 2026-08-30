import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { pacotesDisponiveis } from "@/features/stars/server/pacotes";
import prisma from "@/lib/db";
import { stripe } from "@/lib/stripe";

/**
 * Abre o checkout do Stripe para uma recarga.
 *
 * O que o cliente manda é **o id do pacote**, nunca o valor. Preço vindo do
 * navegador é preço que o navegador escolhe: quem quiser mil créditos por um
 * real só precisa editar a requisição. Aqui o valor e a quantidade saem da
 * tabela de pacotes, do lado de cá.
 *
 * A linha de `StarsPayment` nasce `pending` **antes** da sessão existir, e o
 * seu id vai nos metadados: é por ele que o webhook sabe o que creditar, sem
 * confiar em nada que tenha passado pelo navegador. Se a criação da sessão
 * falhar, sobra uma linha pendente — visível, em vez de um pagamento sem
 * rastro.
 */
export const createCheckout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Inicia recarga", tags: ["Stars"] })
  .input(
    z.object({
      packageId: z.string().min(1),
      /** Para onde voltar depois de pagar. Caminho relativo, nunca URL. */
      voltarPara: z.string().startsWith("/").default("/whatsapp/creditos"),
    }),
  )
  .output(z.object({ url: z.string(), paymentId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    const pacote = (await pacotesDisponiveis()).find(
      (item) => item.id === input.packageId,
    );
    if (!pacote) {
      throw errors.NOT_FOUND({ message: "Pacote não encontrado" });
    }

    const pagamento = await prisma.starsPayment.create({
      data: {
        organizationId,
        userId: context.user.id,
        packageId: pacote.id,
        starsAmount: pacote.stars,
        amountBrl: (pacote.precoCentavos / 100).toFixed(2),
        provider: "stripe",
        status: "pending",
      },
      select: { id: true },
    });

    // O destino é montado a partir do domínio do servidor e de um caminho
    // relativo validado: `success_url` com URL vinda do cliente é redirecionamento
    // aberto de graça.
    const base_url = process.env.NEXT_PUBLIC_DOMAIN ?? "http://localhost:3000";
    const destino = `${base_url.replace(/\/$/, "")}${input.voltarPara}`;

    let sessao: { id: string; url: string | null };
    try {
      sessao = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "brl",
              unit_amount: pacote.precoCentavos,
              product_data: {
                name: `${pacote.label} — ${pacote.stars} ★`,
                description:
                  "Créditos para envio de mensagens no WhatsApp pelo nerp.",
              },
            },
          },
        ],
        // O webhook lê daqui. Não confia em query string de retorno: o cliente
        // controla o navegador, não controla o que o Stripe assina.
        metadata: {
          starsPaymentId: pagamento.id,
          organizationId,
          stars: String(pacote.stars),
        },
        success_url: `${destino}?recarga=ok`,
        cancel_url: `${destino}?recarga=cancelada`,
      });
    } catch (erro) {
      await prisma.starsPayment.update({
        where: { id: pagamento.id },
        data: { status: "failed" },
      });
      throw errors.INTERNAL_SERVER_ERROR({
        message:
          erro instanceof Error
            ? `Não foi possível abrir o pagamento: ${erro.message}`
            : "Não foi possível abrir o pagamento.",
      });
    }

    if (!sessao.url) {
      await prisma.starsPayment.update({
        where: { id: pagamento.id },
        data: { status: "failed" },
      });
      throw errors.INTERNAL_SERVER_ERROR({
        message: "O Stripe não devolveu o endereço de pagamento.",
      });
    }

    await prisma.starsPayment.update({
      where: { id: pagamento.id },
      data: { externalId: sessao.id },
    });

    return { url: sessao.url, paymentId: pagamento.id };
  });
