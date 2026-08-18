import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import type { ReceiptBlock } from "@/features/receipt-designer/lib/types";
import { z } from "zod";

const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const receiptType = z.enum(["FISCAL", "NAO_FISCAL", "ORCAMENTO"]);
const receiptPaper = z.enum(["MM80", "MM58", "A4"]);
// Blocos são dado estruturado da própria org (não security-critical); validamos
// só que é um array. A tipagem forte vive no cliente (ReceiptBlock).
const blocksSchema = z.custom<ReceiptBlock[]>((v) => Array.isArray(v));

const templateOutput = z.object({
  id: z.string(),
  name: z.string(),
  type: receiptType,
  paper: receiptPaper,
  isDefault: z.boolean(),
  blocks: blocksSchema,
});

const listTemplates = p
  .input(z.void())
  .output(z.object({ templates: z.array(templateOutput) }))
  .handler(async ({ context }) => {
    const templates = await prisma.receiptTemplate.findMany({
      where: { organizationId: context.org.id },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return {
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        paper: t.paper,
        isDefault: t.isDefault,
        blocks: t.blocks as unknown as ReceiptBlock[],
      })),
    };
  });

const getDefaultTemplate = p
  .input(z.void())
  .output(z.object({ template: templateOutput.nullable() }))
  .handler(async ({ context }) => {
    const t =
      (await prisma.receiptTemplate.findFirst({
        where: { organizationId: context.org.id, isDefault: true },
      })) ??
      (await prisma.receiptTemplate.findFirst({
        where: { organizationId: context.org.id },
        orderBy: { createdAt: "asc" },
      }));
    if (!t) return { template: null };
    return {
      template: {
        id: t.id,
        name: t.name,
        type: t.type,
        paper: t.paper,
        isDefault: t.isDefault,
        blocks: t.blocks as unknown as ReceiptBlock[],
      },
    };
  });

const createTemplate = p
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do template"),
      type: receiptType.default("NAO_FISCAL"),
      paper: receiptPaper.default("MM80"),
      blocks: blocksSchema,
      isDefault: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const created = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.receiptTemplate.updateMany({
          where: { organizationId: context.org.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.receiptTemplate.create({
        data: {
          organizationId: context.org.id,
          name: input.name,
          type: input.type,
          paper: input.paper,
          blocks: input.blocks as unknown as Prisma.InputJsonValue,
          isDefault: input.isDefault ?? false,
        },
        select: { id: true },
      });
    });
    return created;
  });

const updateTemplate = p
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      type: receiptType.optional(),
      paper: receiptPaper.optional(),
      blocks: blocksSchema.optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const template = await prisma.receiptTemplate.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!template)
      throw errors.NOT_FOUND({ message: "Template não encontrado" });
    await prisma.receiptTemplate.update({
      where: { id: input.id },
      data: {
        name: input.name,
        type: input.type,
        paper: input.paper,
        blocks:
          input.blocks === undefined
            ? undefined
            : (input.blocks as unknown as Prisma.InputJsonValue),
      },
    });
    return { ok: true };
  });

const setDefaultTemplate = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const template = await prisma.receiptTemplate.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!template)
      throw errors.NOT_FOUND({ message: "Template não encontrado" });
    await prisma.$transaction([
      prisma.receiptTemplate.updateMany({
        where: { organizationId: context.org.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.receiptTemplate.update({
        where: { id: input.id },
        data: { isDefault: true },
      }),
    ]);
    return { ok: true };
  });

const deleteTemplate = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const template = await prisma.receiptTemplate.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!template)
      throw errors.NOT_FOUND({ message: "Template não encontrado" });
    await prisma.receiptTemplate.delete({ where: { id: input.id } });
    return { ok: true };
  });

export const receiptTemplateRoutes = {
  list: listTemplates,
  getDefault: getDefaultTemplate,
  create: createTemplate,
  update: updateTemplate,
  setDefault: setDefaultTemplate,
  delete: deleteTemplate,
};
