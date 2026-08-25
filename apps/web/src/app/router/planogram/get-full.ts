import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Hidratação da cena inteira: o editor carrega tudo de uma vez e passa a
// trabalhar em memória, com autosave incremental. Uma gôndola tem dezenas de
// itens, não milhares — carregar tudo é mais barato que paginar.
export const getPlanogramFull = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const planogram = await prisma.planogram.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      include: {
        fixtures: {
          orderBy: { order: "asc" },
          include: {
            modules: {
              orderBy: { index: "asc" },
              include: { shelves: { orderBy: { index: "asc" } } },
            },
          },
        },
        items: {
          orderBy: { position: "asc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                barcode: true,
                thumbnail: true,
                brandId: true,
                categoryId: true,
                supplierId: true,
                widthMm: true,
                heightMm: true,
                depthMm: true,
                packWidthMm: true,
                packHeightMm: true,
                packDepthMm: true,
                brand: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!planogram) {
      throw errors.NOT_FOUND({ message: "Planograma não encontrado" });
    }

    const modules = planogram.fixtures.flatMap((fixture) => fixture.modules);
    const shelves = modules.flatMap((moduleNode) => moduleNode.shelves);

    // Produtos deduplicados: o mesmo SKU pode estar em várias prateleiras, e
    // mandar a ficha repetida infla o payload à toa.
    const productsById = new Map<
      string,
      (typeof planogram.items)[number]["product"]
    >();
    for (const item of planogram.items) {
      productsById.set(item.product.id, item.product);
    }

    return {
      meta: {
        id: planogram.id,
        name: planogram.name,
        status: planogram.status,
        isActive: planogram.isActive,
        currentVersion: planogram.currentVersion,
        categoryId: planogram.categoryId,
      },
      fixtures: planogram.fixtures.map((fixture) => ({
        id: fixture.id,
        kind: fixture.kind,
        name: fixture.name,
        order: fixture.order,
        widthMm: fixture.widthMm,
        heightMm: fixture.heightMm,
        depthMm: fixture.depthMm,
        baseHeightMm: fixture.baseHeightMm,
        colorHex: fixture.colorHex,
        mapObjectId: fixture.mapObjectId,
      })),
      modules: modules.map((moduleNode) => ({
        id: moduleNode.id,
        fixtureId: moduleNode.fixtureId,
        index: moduleNode.index,
        widthMm: moduleNode.widthMm,
        label: moduleNode.label,
      })),
      shelves: shelves.map((shelf) => ({
        id: shelf.id,
        moduleId: shelf.moduleId,
        index: shelf.index,
        yMm: shelf.yMm,
        widthMm: shelf.widthMm,
        depthMm: shelf.depthMm,
        thicknessMm: shelf.thicknessMm,
        kind: shelf.kind,
        layoutMode: shelf.layoutMode,
        maxWeightKg: shelf.maxWeightKg,
        colorHex: shelf.colorHex,
        dividers: (shelf.dividers as { xMm: number }[] | null) ?? [],
      })),
      items: planogram.items.map((item) => ({
        id: item.id,
        shelfId: item.shelfId,
        productId: item.productId,
        position: item.position,
        xMm: item.xMm,
        facings: item.facings,
        facingsDeep: item.facingsDeep,
        facingsHigh: item.facingsHigh,
        orientation: item.orientation,
        isBoxed: item.isBoxed,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        depthMm: item.depthMm,
        note: item.note,
      })),
      products: [...productsById.values()].map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        thumbnail: product.thumbnail || null,
        brandId: product.brandId,
        brandName: product.brand?.name ?? null,
        categoryId: product.categoryId,
        supplierId: product.supplierId,
        widthMm: product.widthMm,
        heightMm: product.heightMm,
        depthMm: product.depthMm,
        packWidthMm: product.packWidthMm,
        packHeightMm: product.packHeightMm,
        packDepthMm: product.packDepthMm,
      })),
    };
  });
