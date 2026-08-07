import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Indústria com senha do mês (`actionCodeImage`) primeiro; sem senha por
// último — dentro de cada grupo, ordem alfabética. O promotor só consegue
// fotografar quem tem senha, então o que ele usa fica no topo.
//
// Feito em memória de propósito: o Prisma não ordena por "actionCodeImage IS
// NOT NULL" (só pelo VALOR da coluna, que é uma chave do R2 e bagunçaria o
// alfabético). Como a lista de indústrias é limitada por org (as marcas com
// que a empresa trabalha, dezenas a poucas centenas — não milhares como as
// lojas), trazemos tudo ordenado por nome e reordenamos aqui. `Array.sort` é
// estável, então a ordem alfabética se preserva dentro de cada grupo.
function senhaFirst<T extends { actionCodeImage: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) => (a.actionCodeImage ? 0 : 1) - (b.actionCodeImage ? 0 : 1),
  );
}

// Indústrias do passo "Escolha a Indústria" do wizard. Mesma visibilidade do
// `myStores`: todas as indústrias ativas da org, para qualquer membro. A
// captura é escopada pela org (a indústria precisa pertencer a ela), sem
// exigir vínculo por promotor. Antes só owner/admin viam tudo e o promotor
// sem vínculo cadastrado via a lista vazia e não conseguia trabalhar.
//
// Página única (sem cursor real): a ordenação "com senha primeiro" exige um
// sort global, incompatível com o keyset por página, e a lista é pequena o
// bastante para caber de uma vez. `nextCursor` volta sempre `null`, então o
// scroll infinito do client simplesmente não pede a próxima página.
export const listMyIndustries = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      search: z.string().optional(),
      // Aceitos por compatibilidade com o hook de scroll infinito, mas sem
      // efeito: a lista volta inteira numa página (ver comentário acima).
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(60).optional(),
    }),
  )
  .output(
    z.object({
      suppliers: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          actionCodeImage: z.string().nullable(),
          isFavorite: z.boolean(),
        }),
      ),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    const memberId = member?.id ?? "";
    const searchTerm = input.search?.trim();

    const where = {
      organizationId: context.org.id,
      isActive: true,
      ...(searchTerm
        ? {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" as const } },
              {
                tradeName: {
                  contains: searchTerm,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    // Favoritos numa consulta própria: continuam fixados no topo (a estrela é
    // escolha do promotor), com a mesma ordem "com senha primeiro" dentro do
    // grupo.
    const favoriteIds = memberId
      ? (
          await prisma.promoterFavoriteSupplier.findMany({
            where: { memberId, organizationId: context.org.id },
            select: { supplierId: true },
          })
        ).map((item) => item.supplierId)
      : [];

    const select = { id: true, name: true, actionCodeImage: true };
    const [favorites, others] = await Promise.all([
      favoriteIds.length > 0
        ? prisma.supplier.findMany({
            where: { AND: [where, { id: { in: favoriteIds } }] },
            orderBy: { name: "asc" },
            select,
          })
        : Promise.resolve([]),
      prisma.supplier.findMany({
        where:
          favoriteIds.length > 0
            ? { AND: [where, { id: { notIn: favoriteIds } }] }
            : where,
        orderBy: { name: "asc" },
        select,
      }),
    ]);

    return {
      suppliers: [
        ...senhaFirst(favorites).map((supplier) => ({
          ...supplier,
          isFavorite: true,
        })),
        ...senhaFirst(others).map((supplier) => ({
          ...supplier,
          isFavorite: false,
        })),
      ],
      nextCursor: null,
    };
  });
