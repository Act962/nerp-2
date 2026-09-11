import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolvePromotionalProducts } from "@/features/promotional-catalog/server/resolve-products";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, resetDb } from "./helpers";

/**
 * O filtro de categoria do catálogo promocional é por SLUG.
 *
 * Existe por um bug real: as duas tools do Astro resolviam o nome que a pessoa
 * falava ("Lavanderia") para o **id** da categoria e passavam esse id em
 * `categoryFilter`, que a consulta compara com `category.slug`. Compilava,
 * rodava e devolvia ZERO produtos — e o Astro respondia "não existe produto
 * nessa categoria" para uma categoria com dezessete deles, mandando a pessoa
 * procurar o defeito no cadastro.
 *
 * O tipo é `string[]` dos dois lados, então nada além deste teste separa um do
 * outro. É por isso que ele afirma as duas metades: que o slug acha, e que o
 * id NÃO acha.
 */
describe("resolvePromotionalProducts — filtro por categoria", () => {
  let org: Organization;
  let user: User;
  let categoriaId: string;

  beforeAll(async () => {
    await resetDb();
    org = await createOrg("Mercado");
    user = await createUser();

    const categoria = await prisma.category.create({
      data: { organizationId: org.id, name: "LAVANDERIA", slug: "lavanderia" },
    });
    categoriaId = categoria.id;

    const base = {
      organizationId: org.id,
      categoryId: categoria.id,
      createdById: user.id,
      isActive: true,
      salePrice: 20,
    };

    await prisma.product.createMany({
      data: [
        {
          ...base,
          name: "Sabão em pó 1,6kg",
          slug: "sabao-em-po",
          promotionalPrice: 12,
        },
        {
          ...base,
          name: "Amaciante 2L",
          slug: "amaciante-2l",
          promotionalPrice: 15,
        },
        // Sem preço promocional: entra no cadastro, fica fora do encarte.
        {
          ...base,
          name: "Tira-manchas 500ml",
          slug: "tira-manchas",
          promotionalPrice: null,
        },
      ],
    });
  });

  afterAll(async () => {
    await resetDb();
  });

  it("acha os produtos pelo SLUG da categoria", async () => {
    const produtos = await resolvePromotionalProducts(org.id, {
      autoPromotions: true,
      categoryFilter: ["lavanderia"],
    });
    expect(produtos).toHaveLength(2);
  });

  it("NÃO acha nada quando recebe o id — era este o bug", async () => {
    const produtos = await resolvePromotionalProducts(org.id, {
      autoPromotions: true,
      categoryFilter: [categoriaId],
    });
    expect(produtos).toHaveLength(0);
  });

  it("produto sem preço promocional fica de fora do encarte", async () => {
    const produtos = await resolvePromotionalProducts(org.id, {
      autoPromotions: true,
      categoryFilter: ["lavanderia"],
    });
    expect(produtos.map((p) => p.name)).not.toContain("Tira-manchas 500ml");
  });

  it("não atravessa organizações", async () => {
    const outra = await createOrg("Outra");
    const produtos = await resolvePromotionalProducts(outra.id, {
      autoPromotions: true,
      categoryFilter: ["lavanderia"],
    });
    expect(produtos).toHaveLength(0);
  });
});
