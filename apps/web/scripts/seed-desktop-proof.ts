/**
 * Seed de VERIFICAÇÃO da Fase 1 do desktop (descartável).
 *
 * Cria uma org, um usuário, dois produtos e um device com token conhecido no
 * banco apontado por DATABASE_URL. Imprime o token para injetar no desktop e
 * validar o fluxo online (login/PDV) contra o backend local.
 *
 * Uso: DATABASE_URL=postgres://...5433 pnpm --filter @nerp/web exec tsx scripts/seed-desktop-proof.ts
 */
import prisma from "@/lib/db";
import { DEFAULT_DEVICE_SCOPES } from "@/lib/device-scopes";
import { generateDeviceToken, hashDeviceToken } from "@/lib/device-token";

async function main() {
  const suffix = Date.now().toString(36);

  const org = await prisma.organization.create({
    data: { name: "Loja Prova Desktop", slug: `prova-desktop-${suffix}` },
  });
  const user = await prisma.user.create({
    data: { name: "Operador Prova", email: `prova-${suffix}@teste.local` },
  });
  await prisma.member.create({
    data: { organizationId: org.id, userId: user.id, role: "owner" },
  });
  await prisma.product.createMany({
    data: [
      {
        organizationId: org.id,
        name: "Café Torrado 500g",
        slug: `cafe-${suffix}`,
        salePrice: 18.9,
        createdById: user.id,
      },
      {
        organizationId: org.id,
        name: "Açúcar Refinado 1kg",
        slug: `acucar-${suffix}`,
        salePrice: 4.5,
        createdById: user.id,
      },
    ],
  });

  const token = generateDeviceToken();
  const device = await prisma.device.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      name: "Caixa Prova",
      platform: "windows",
      scopes: DEFAULT_DEVICE_SCOPES,
      tokenHash: hashDeviceToken(token),
    },
  });

  console.info(
    JSON.stringify(
      { orgId: org.id, orgName: org.name, deviceId: device.id, token },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
