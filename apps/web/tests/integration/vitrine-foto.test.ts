import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listProducts } from "@/app/router/catalog/list-products";
import { updateProduct } from "@/app/router/products/update";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * A vitrine só mostra produto com foto cadastrada — e "foto" é miniatura OU
 * galeria. Contar só a miniatura escondeu da vitrine, em produção, todo
 * produto que tinha foto apenas na galeria.
 */

let org: Organization;
let user: User;

const publico = { context: { headers: new Headers() } };

async function produto(
  name: string,
  fotos: { thumbnail?: string; images?: string[] },
) {
  return prisma.product.create({
    data: {
      organizationId: org.id,
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      salePrice: 10,
      currentStock: 5,
      createdById: user.id,
      thumbnail: fotos.thumbnail ?? "",
      images: fotos.images ?? [],
    },
  });
}

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja das fotos");
  user = await createUser();
  await createMember(user, org);
  await prisma.organization.update({
    where: { id: org.id },
    data: { subdomain: "loja-das-fotos", verifiedAt: new Date() },
  });

  await produto("Com miniatura", { thumbnail: "produtos/miniatura.jpg" });
  await produto("Só galeria", { images: ["produtos/galeria.jpg"] });
  await produto("Sem foto", {});
  await produto("Espaço em branco", { thumbnail: "   ", images: [" "] });
});

afterAll(resetDb);

describe("vitrine pública e foto do produto", () => {
  it("mostra quem tem miniatura ou galeria, e só esses", async () => {
    const pagina = await call(
      listProducts,
      { subdomain: "loja-das-fotos", limit: 24 },
      publico,
    );

    expect(pagina.products.map((p) => p.name).sort()).toEqual([
      "Com miniatura",
      "Só galeria",
    ]);
    expect(pagina.total).toBe(2);
  });

  it("entrega a foto da galeria como capa quando falta a miniatura", async () => {
    const pagina = await call(
      listProducts,
      { subdomain: "loja-das-fotos", limit: 24 },
      publico,
    );
    const soGaleria = pagina.products.find((p) => p.name === "Só galeria");

    expect(soGaleria?.thumbnail).toBe("produtos/galeria.jpg");
  });

  it("salvar o produto sem mandar a galeria não a apaga", async () => {
    const alvo = await produto("Editado", {
      images: ["produtos/editado-1.jpg", "produtos/editado-2.jpg"],
    });

    // O formulário de edição não tem campo de galeria: manda só o resto.
    await call(
      updateProduct,
      { id: alvo.id, name: "Editado de novo", thumbnail: "" },
      { context: s2sContext(user, org) },
    );

    const salvo = await prisma.product.findUniqueOrThrow({
      where: { id: alvo.id },
      select: { images: true },
    });
    expect(salvo.images).toEqual([
      "produtos/editado-1.jpg",
      "produtos/editado-2.jpg",
    ]);
  });
});
