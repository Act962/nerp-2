import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

const MIN_STORES_PER_CELL = 3;

// Auto-benchmark das próprias lojas da org, agrupado por cidade/estado —
// zero schema extra, mas só mostra a célula com >= 3 lojas: com N=1 ou 2 não é
// benchmark, é reexibir (ou quase deduzir) o custo exato de uma loja vizinha.
export const selfBenchmarkRegionCost = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const stores = await prisma.store.findMany({
      where: {
        organizationId: context.org.id,
        isActive: true,
        areaM2: { not: null },
        monthlyCost: { not: null },
        city: { not: null },
        state: { not: null },
      },
      select: { city: true, state: true, areaM2: true, monthlyCost: true },
    });

    const cells = new Map<
      string,
      { city: string; state: string; costsPerM2: number[] }
    >();

    for (const store of stores) {
      if (!store.areaM2 || !store.monthlyCost || !store.city || !store.state) {
        continue;
      }
      const key = `${store.state}|${store.city}`;
      const cell = cells.get(key) ?? {
        city: store.city,
        state: store.state,
        costsPerM2: [],
      };
      cell.costsPerM2.push(Number(store.monthlyCost) / store.areaM2);
      cells.set(key, cell);
    }

    const items = [...cells.values()]
      .filter((cell) => cell.costsPerM2.length >= MIN_STORES_PER_CELL)
      .map((cell) => ({
        city: cell.city,
        state: cell.state,
        storeCount: cell.costsPerM2.length,
        avgCostPerM2:
          cell.costsPerM2.reduce((sum, value) => sum + value, 0) /
          cell.costsPerM2.length,
      }))
      .sort((a, b) => b.avgCostPerM2 - a.avgCostPerM2);

    return { items };
  });
