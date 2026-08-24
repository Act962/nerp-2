import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { FixtureKind } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

/** Lê as dimensões da gôndola guardadas em `MapObject.properties.fixture`. */
function readCellDims(properties: unknown): {
  kind: FixtureKind;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  baseHeightMm: number;
} {
  const fixture =
    properties && typeof properties === "object"
      ? ((properties as Record<string, unknown>).fixture as
          | Record<string, unknown>
          | undefined)
      : undefined;
  const num = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const kind =
    typeof fixture?.kind === "string" &&
    (Object.values(FixtureKind) as string[]).includes(fixture.kind)
      ? (fixture.kind as FixtureKind)
      : FixtureKind.GONDOLA;
  return {
    kind,
    widthMm: num(fixture?.widthMm, 1300),
    heightMm: num(fixture?.heightMm, 1900),
    depthMm: num(fixture?.depthMm, 400),
    baseHeightMm: num(fixture?.baseHeightMm, 100),
  };
}

export const createPlanogram = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do planograma"),
      code: z.string().trim().max(40).optional(),
      categoryId: z.string().optional(),
      // Quando criado a partir de uma gôndola do mapa: liga uma PlanogramFixture
      // a esse MapObject e já semeia as dimensões da célula.
      mapObjectId: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string(), fixtureId: z.string().nullable() }))
  .handler(async ({ input, context, errors }) => {
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!category) {
        throw errors.NOT_FOUND({ message: "Categoria não encontrada" });
      }
    }

    // Valida a gôndola do mapa na org antes de ligar (anti cross-tenant).
    let mapObject: {
      id: string;
      name: string | null;
      properties: unknown;
    } | null = null;
    if (input.mapObjectId) {
      mapObject = await prisma.mapObject.findFirst({
        where: { id: input.mapObjectId, organizationId: context.org.id },
        select: { id: true, name: true, properties: true },
      });
      if (!mapObject) {
        throw errors.NOT_FOUND({ message: "Espaço do mapa não encontrado" });
      }
    }

    // `code` é único por org quando informado; string vazia vira null para não
    // colidir com outro planograma sem código.
    const code = input.code?.trim() || null;
    if (code) {
      const existing = await prisma.planogram.findFirst({
        where: { organizationId: context.org.id, code },
        select: { id: true },
      });
      if (existing) {
        throw errors.BAD_REQUEST({
          message: "Já existe um planograma com esse código",
        });
      }
    }

    const planogram = await prisma.planogram.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        code,
        categoryId: input.categoryId,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    // Semeia uma gôndola vinculada ao MapObject, com as dimensões da célula +
    // um módulo — o editor abre já com essa gôndola.
    let fixtureId: string | null = null;
    if (mapObject) {
      const dims = readCellDims(mapObject.properties);
      const fixture = await prisma.planogramFixture.create({
        data: {
          organizationId: context.org.id,
          planogramId: planogram.id,
          mapObjectId: mapObject.id,
          kind: dims.kind,
          name: mapObject.name ?? "Gôndola",
          order: 0,
          widthMm: dims.widthMm,
          heightMm: dims.heightMm,
          depthMm: dims.depthMm,
          baseHeightMm: dims.baseHeightMm,
          modules: {
            create: {
              organizationId: context.org.id,
              index: 0,
              widthMm: dims.widthMm,
            },
          },
        },
        select: { id: true },
      });
      fixtureId = fixture.id;
    }

    return { id: planogram.id, fixtureId };
  });
