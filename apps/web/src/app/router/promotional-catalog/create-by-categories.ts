import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { CatalogConfig } from "@/features/promotional-catalog/types";
import { capacidadeDaPagina } from "@/features/promotional-catalog/lib/layout";
import { montarPorCategorias } from "@/features/promotional-catalog/lib/montar-por-categorias";
import { assertCanEditCatalog } from "./_require-edit";
import { DEFAULT_CONFIG } from "./types";

// "Criar por categorias" num passo: a capa e o estilo vêm de um catálogo
// existente (o molde) e cada categoria vira as suas páginas — o mesmo que o
// "Por categoria" do editor, sem precisar preparar o molde à mão.
export const createCatalogByCategories = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar catálogo promocional com uma página por categoria",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do catálogo"),
      moldeId: z.string().min(1, "Escolha o catálogo de modelo"),
      categoryIds: z.array(z.string()).min(1, "Escolha ao menos uma categoria"),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      paginas: z.number(),
      produtos: z.number(),
      textosFixosDoMolde: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await assertCanEditCatalog(context.org.id, context.user.id, errors);

    const molde = await prisma.promotionalCatalog.findFirst({
      where: { id: input.moldeId, organizationId: context.org.id },
      select: { config: true },
    });
    if (!molde) {
      throw errors.NOT_FOUND({ message: "Catálogo de modelo não encontrado" });
    }

    const [categorias, produtos] = await Promise.all([
      prisma.category.findMany({
        where: {
          id: { in: input.categoryIds },
          organizationId: context.org.id,
        },
        select: { id: true, name: true },
      }),
      prisma.product.findMany({
        where: {
          organizationId: context.org.id,
          isActive: true,
          categoryId: { in: input.categoryIds },
        },
        select: { id: true, categoryId: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Na ordem em que o usuário escolheu; categoria vazia não gera página.
    const nomes = new Map(categorias.map((c) => [c.id, c.name]));
    const grupos = input.categoryIds
      .filter((id) => nomes.has(id))
      .map((id) => ({
        id,
        name: nomes.get(id) ?? "",
        ids: produtos.filter((p) => p.categoryId === id).map((p) => p.id),
      }))
      .filter((g) => g.ids.length > 0);
    if (grupos.length === 0) {
      throw errors.BAD_REQUEST({
        message: "As categorias escolhidas não têm produtos ativos",
      });
    }

    const { config, textosFixosDoMolde } = montarPorCategorias({
      molde: {
        ...DEFAULT_CONFIG,
        ...(molde.config as object),
      } as CatalogConfig,
      grupos,
      capacidade: capacidadeDaPagina,
    });

    const catalogo = await prisma.promotionalCatalog.create({
      data: {
        name: input.name,
        config: config as object,
        organizationId: context.org.id,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    return {
      id: catalogo.id,
      paginas: config.pages?.length ?? 0,
      produtos: config.manuallyAddedIds?.length ?? 0,
      textosFixosDoMolde,
    };
  });
