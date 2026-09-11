import "server-only";

import prisma from "@/lib/db";

/**
 * Apaga uma organização inteira.
 *
 * A cascata da `Organization` não basta: `SaleItem`, `StockMovement`,
 * `PurchaseItem`, `BookPage.storeId` e `PdvPhoto.storeId` têm FK restrita e
 * travam a cascata na ordem errada. A ordem abaixo é a mesma que a suíte de
 * integração usa para limpar o banco — e a suíte passa a chamar esta função,
 * para a ordem viver num lugar só.
 *
 * Quem chama decide se apaga o dono junto (`apagarDonoAnonimo`): só faz
 * sentido para a conta provisória de uma sandbox expirada, e só se ela não
 * tiver outra organização.
 */
export async function apagarOrganizacao(
  organizationId: string,
  opcoes: { apagarDonoAnonimo?: boolean } = {},
): Promise<void> {
  const where = { organizationId };

  const donos = opcoes.apagarDonoAnonimo
    ? await prisma.member.findMany({
        where: { organizationId, role: "owner", user: { isAnonymous: true } },
        select: { userId: true },
      })
    : [];

  await prisma.cashMovement.deleteMany({ where });
  await prisma.stockMovement.deleteMany({ where });
  await prisma.sale.deleteMany({ where });
  await prisma.cashSession.deleteMany({ where });
  await prisma.cashRegister.deleteMany({ where });
  await prisma.purchase.deleteMany({ where });
  await prisma.product.deleteMany({ where });
  await prisma.book.deleteMany({ where });
  await prisma.pdvPhoto.deleteMany({ where });
  await prisma.store.deleteMany({ where });
  await prisma.device.deleteMany({ where });
  await prisma.organization.delete({ where: { id: organizationId } });

  for (const dono of donos) {
    const outras = await prisma.member.count({
      where: { userId: dono.userId },
    });
    if (outras === 0) {
      await prisma.user.delete({ where: { id: dono.userId } });
    }
  }
}
