/**
 * Preenche Category.level e Category.path a partir de parentId.
 *
 * `path` é materialized path de ids ("catA/subB/segC") — permite buscar todos os
 * descendentes de um nó com um startsWith, sem CTE recursiva. É o que sustenta o
 * filtro Categoria > Sub-Categoria > Segmento > Sub-Segmento do planograma.
 *
 * Idempotente: pode rodar quantas vezes quiser.
 * Uso: npx tsx --env-file=.env scripts/backfill-category-hierarchy.ts [--dry-run]
 */
import prisma from "@/lib/db";

const isDryRun = process.argv.includes("--dry-run");

interface Node {
  id: string;
  parentId: string | null;
  level: number;
  path: string | null;
}

async function main() {
  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true, level: true, path: true },
  });
  console.log(`Categorias encontradas: ${categories.length}`);

  const byId = new Map<string, Node>(categories.map((node) => [node.id, node]));

  // Memoizado: uma árvore profunda recalcularia o mesmo ancestral N vezes.
  const resolved = new Map<string, { level: number; path: string }>();

  function resolve(
    id: string,
    seen: Set<string>,
  ): { level: number; path: string } {
    const cached = resolved.get(id);
    if (cached) return cached;

    const node = byId.get(id);
    if (!node) return { level: 0, path: id };

    let result: { level: number; path: string };
    if (!node.parentId || !byId.has(node.parentId)) {
      result = { level: 0, path: id };
    } else if (seen.has(node.parentId)) {
      // Ciclo (parentId apontando para um ancestral): trata como raiz em vez de
      // estourar a pilha. Não deveria existir, mas o banco não impede.
      console.warn(`  ciclo detectado em ${id} — tratando como raiz`);
      result = { level: 0, path: id };
    } else {
      seen.add(id);
      const parent = resolve(node.parentId, seen);
      result = { level: parent.level + 1, path: `${parent.path}/${id}` };
    }

    resolved.set(id, result);
    return result;
  }

  const updates: { id: string; level: number; path: string }[] = [];
  for (const node of categories) {
    const { level, path } = resolve(node.id, new Set());
    if (node.level !== level || node.path !== path) {
      updates.push({ id: node.id, level, path });
    }
  }

  const byLevel = new Map<number, number>();
  for (const [, value] of resolved) {
    byLevel.set(value.level, (byLevel.get(value.level) ?? 0) + 1);
  }
  const levelLabels = [
    "Categoria",
    "Sub-Categoria",
    "Segmento",
    "Sub-Segmento",
  ];
  for (const [level, count] of [...byLevel.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    console.log(
      `  nível ${level} (${levelLabels[level] ?? "mais fundo"}): ${count}`,
    );
  }

  console.log(`\nPrecisam de atualização: ${updates.length}`);
  if (isDryRun) {
    console.log("--dry-run: nada foi gravado.");
    await prisma.$disconnect();
    return;
  }

  const CHUNK = 200;
  for (let start = 0; start < updates.length; start += CHUNK) {
    const chunk = updates.slice(start, start + CHUNK);
    await prisma.$transaction(
      chunk.map((update) =>
        prisma.category.update({
          where: { id: update.id },
          data: { level: update.level, path: update.path },
        }),
      ),
    );
    console.log(
      `  ${Math.min(start + CHUNK, updates.length)}/${updates.length}`,
    );
  }

  console.log("Backfill concluído.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("FALHOU:", error instanceof Error ? error.message : error);
  process.exit(1);
});
