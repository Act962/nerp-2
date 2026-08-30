import "server-only";

import prisma from "@/lib/db";

/**
 * Pacotes de ★ oferecidos na recarga.
 *
 * A tabela é **global**, sem `organizationId`: o preço de mil créditos é o
 * mesmo para toda loja, e um preço por organização viraria negociação caso a
 * caso sem tela para gerenciar.
 *
 * Semeados na primeira leitura, e não por migration: preço muda, e mudar preço
 * por migration obriga a escrever uma migration para cada reajuste.
 */
const PADRAO = [
  { label: "Recarga pequena", stars: 500, priceBrl: "49.90" },
  { label: "Recarga média", stars: 1500, priceBrl: "129.90" },
  { label: "Recarga grande", stars: 5000, priceBrl: "379.90" },
];

export async function pacotesDisponiveis(): Promise<
  { id: string; label: string; stars: number; precoCentavos: number }[]
> {
  const existentes = await prisma.starPackage.findMany({
    where: { isActive: true },
    orderBy: { stars: "asc" },
    select: { id: true, label: true, stars: true, priceBrl: true },
  });

  if (existentes.length === 0) {
    await prisma.starPackage.createMany({ data: PADRAO, skipDuplicates: true });
    return pacotesDisponiveis();
  }

  return existentes.map((pacote) => ({
    id: pacote.id,
    label: pacote.label,
    stars: pacote.stars,
    // Centavos no limite do handler: `Decimal` não atravessa a fronteira, e
    // centavos é o que o Stripe espera.
    precoCentavos: Math.round(Number(pacote.priceBrl) * 100),
  }));
}
