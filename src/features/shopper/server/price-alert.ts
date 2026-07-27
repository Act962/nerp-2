import prisma from "@/lib/db";
import { getResend, organizationFrom } from "@/lib/email/client";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Consome shopper/price.changed: notifica quem favoritou o produto e cujo preço
// de referência (lastNotifiedPrice ?? priceWhenFavorited) ficou acima do novo.
// E-mail via Resend é best-effort — sem RESEND_API_KEY em dev, só marca o preço.
export async function runShopperPriceAlert(data: {
  productId: string;
  newPrice: number;
}): Promise<{ notified: number }> {
  const [favorites, product] = await Promise.all([
    prisma.favorite.findMany({
      where: { productId: data.productId, notifyOnDrop: true },
      select: {
        id: true,
        priceWhenFavorited: true,
        lastNotifiedPrice: true,
        shopper: { select: { email: true, name: true } },
      },
    }),
    prisma.product.findUnique({
      where: { id: data.productId },
      select: { name: true },
    }),
  ]);

  let notified = 0;
  for (const favorite of favorites) {
    const reference = Number(
      favorite.lastNotifiedPrice ?? favorite.priceWhenFavorited,
    );
    if (data.newPrice >= reference) continue;

    await prisma.favorite.update({
      where: { id: favorite.id },
      data: { lastNotifiedPrice: data.newPrice },
    });
    notified++;

    try {
      const resend = getResend();
      await resend.emails.send({
        from: organizationFrom(),
        to: favorite.shopper.email,
        subject: `Baixou de preço: ${product?.name ?? "um favorito seu"}`,
        html: `<p>Olá${favorite.shopper.name ? `, ${favorite.shopper.name}` : ""}!</p>
<p><strong>${product?.name ?? "Um produto que você favoritou"}</strong> baixou para <strong>${formatBRL(data.newPrice)}</strong> (antes ${formatBRL(reference)}).</p>
<p>Aproveite na loja. 🛒</p>`,
      });
    } catch (error) {
      console.error("[shopperPriceAlert] e-mail falhou (best-effort):", error);
    }
  }

  return { notified };
}
