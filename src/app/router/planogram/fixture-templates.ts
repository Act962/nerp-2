import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const templateShelfSchema = z.object({
  yMm: z.number().int().min(0),
  widthMm: z.number().int().min(1),
  depthMm: z.number().int().min(1),
  thicknessMm: z.number().int().min(1),
  kind: z.enum(["PRATELEIRA", "GANCHEIRA", "CESTO", "CAIXARIA"]),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
});

const templateShape = {
  id: true,
  name: true,
  kind: true,
  widthMm: true,
  heightMm: true,
  depthMm: true,
  baseHeightMm: true,
  colorHex: true,
  moduleCount: true,
  shelves: true,
  isDefault: true,
} satisfies Prisma.PlanogramFixtureTemplateSelect;

export const listFixtureTemplates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const templates = await prisma.planogramFixtureTemplate.findMany({
      where: { organizationId: context.org.id },
      select: templateShape,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return templates.map((template) => ({
      ...template,
      shelves: templateShelfSchema.array().parse(template.shelves),
    }));
  });

export const saveFixtureTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().trim().min(1, "Dê um nome ao padrão").max(60),
      kind: z.enum([
        "GONDOLA",
        "PONTA_GONDOLA",
        "ILHA",
        "CHECKOUT",
        "GELADEIRA",
        "EXPOSITOR",
        "CLIP_STRIP",
      ]),
      widthMm: z.number().int().min(1),
      heightMm: z.number().int().min(1),
      depthMm: z.number().int().min(1),
      baseHeightMm: z.number().int().min(0),
      colorHex: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable(),
      moduleCount: z.number().int().min(1).max(20),
      shelves: templateShelfSchema.array().min(1),
      isDefault: z.boolean(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { name, isDefault, shelves, ...data } = input;
    const shelvesJson = shelves as unknown as Prisma.InputJsonValue;

    // Salvar com um nome já usado SUBSTITUI o padrão: quem ajusta a gôndola e
    // salva de novo espera atualizar o padrão da loja, não colecionar cópias.
    return prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.planogramFixtureTemplate.updateMany({
          where: { organizationId: context.org.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.planogramFixtureTemplate.upsert({
        where: {
          organizationId_name: { organizationId: context.org.id, name },
        },
        create: {
          organizationId: context.org.id,
          name,
          isDefault,
          shelves: shelvesJson,
          ...data,
        },
        update: { isDefault, shelves: shelvesJson, ...data },
        select: { id: true },
      });
    });
  });

export const deleteFixtureTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const template = await prisma.planogramFixtureTemplate.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!template) {
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    }

    return prisma.planogramFixtureTemplate.delete({ where: { id: input.id } });
  });
