import prisma from "@/lib/db";

/**
 * `level` e `path` são derivados de `parentId` — precisam ser recalculados em
 * toda escrita, senão categoria nova nasce como raiz e some do filtro em
 * cascata da estrutura mercadológica.
 *
 * `path` é materialized path de ids ("catA/subB/segC"): buscar a subárvore vira
 * um `startsWith`, sem CTE recursiva.
 */
export async function resolveHierarchy(
  parentId: string | null | undefined,
  organizationId: string,
): Promise<{ level: number; path: string | null }> {
  if (!parentId) return { level: 0, path: null };

  const parent = await prisma.category.findFirst({
    where: { id: parentId, organizationId },
    select: { id: true, level: true, path: true },
  });
  if (!parent) return { level: 0, path: null };

  const parentPath = parent.path ?? parent.id;
  return { level: parent.level + 1, path: parentPath };
}

/** O path só fica completo depois que o id existe — daí o segundo passo. */
export async function applyOwnPath(
  categoryId: string,
  parentPath: string | null,
): Promise<void> {
  await prisma.category.update({
    where: { id: categoryId },
    data: { path: parentPath ? `${parentPath}/${categoryId}` : categoryId },
  });
}

/**
 * Mover uma categoria reescreve o path dela e o de todos os descendentes.
 * Sem isso, mudar o pai deixa a subárvore inteira apontando para o caminho
 * antigo e o filtro passa a devolver resultado errado silenciosamente.
 */
export async function repathSubtree(
  categoryId: string,
  organizationId: string,
): Promise<void> {
  const node = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true, parentId: true, path: true },
  });
  if (!node) return;

  const { level, path: parentPath } = await resolveHierarchy(
    node.parentId,
    organizationId,
  );
  const newPath = parentPath ? `${parentPath}/${node.id}` : node.id;
  const oldPath = node.path ?? node.id;

  await prisma.category.update({
    where: { id: node.id },
    data: { level, path: newPath },
  });

  if (oldPath === newPath) return;

  const descendants = await prisma.category.findMany({
    where: {
      organizationId,
      path: { startsWith: `${oldPath}/` },
    },
    select: { id: true, path: true },
  });

  if (descendants.length === 0) return;

  await prisma.$transaction(
    descendants.map((descendant) => {
      const suffix = (descendant.path ?? "").slice(oldPath.length);
      const rebuilt = `${newPath}${suffix}`;
      return prisma.category.update({
        where: { id: descendant.id },
        data: {
          path: rebuilt,
          level: rebuilt.split("/").length - 1,
        },
      });
    }),
  );
}
