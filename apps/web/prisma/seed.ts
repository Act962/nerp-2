import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const organizationId = "1t6DsLPXPcAQotNrDK9DD6I4MiZWAbVD";
const createdById = "yoxChAjqKEyx16ToqupGUZ0j5xhTewu0";

export async function main() {
  const c1 = await prisma.category.create({
    data: {
      name: "Informática",
      slug: "informatica",
      organizationId,
    },
  });
  const c2 = await prisma.category.create({
    data: {
      name: "Mecânica",
      slug: "mecanica",
      organizationId,
    },
  });

  await prisma.product.createMany({
    data: [
      {
        name: "Notebook Gamer RTX 4050",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-rtx-4050",
        description: "Notebook gamer com RTX 4050",
        salePrice: 5899.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Notebook Gamer RTX 4060",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-rtx-4060",
        description: "Notebook gamer com RTX 4060",
        salePrice: 6699.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Notebook Gamer RTX 4070",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-rtx-4070",
        description: "Notebook gamer com RTX 4070",
        salePrice: 8199.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Notebook Gamer RTX 4080",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-rtx-4080",
        description: "Notebook gamer com RTX 4080",
        salePrice: 11999.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Notebook Gamer Ryzen 5 RTX 3050",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-ryzen-5-rtx-3050",
        description: "Notebook gamer com Ryzen 5 e RTX 3050",
        salePrice: 4699.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Notebook Gamer Ryzen 7 RTX 3060",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-ryzen-7-rtx-3060",
        description: "Notebook gamer com Ryzen 7 e RTX 3060",
        salePrice: 5499.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Notebook Gamer Intel i5 RTX 3050",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-intel-i5-rtx-3050",
        description: "Notebook gamer com Intel i5 e RTX 3050",
        salePrice: 4899.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Notebook Gamer Intel i7 RTX 4060",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-intel-i7-rtx-4060",
        description: "Notebook gamer com Intel i7 e RTX 4060",
        salePrice: 6999.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Notebook Gamer Intel i9 RTX 4090",
        organizationId: organizationId,
        categoryId: c1.id,
        slug: "notebook-gamer-intel-i9-rtx-4090",
        description: "Notebook gamer topo de linha com RTX 4090",
        salePrice: 15999.9,
        thumbnail:
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        images: [
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
          "c0bbd700-b030-444e-9f67-c16b5406127b-Captura%20de%20tela%202025-10-30%20154432.png",
        ],
        createdById: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });
}

main();
