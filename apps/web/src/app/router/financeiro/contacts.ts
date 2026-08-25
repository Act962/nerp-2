import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Contatos financeiros (clientes/fornecedores) vinculados a lançamentos.
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const contactType = z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]);

const contactOutput = z.object({
  id: z.string(),
  name: z.string(),
  document: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  contactType: z.string(),
  notes: z.string().nullable(),
  creditLimit: z.number().int(),
  isActive: z.boolean(),
});

export const listContacts = p
  .input(
    z
      .object({
        type: contactType.optional(),
        search: z.string().optional(),
        includeInactive: z.boolean().optional(),
      })
      .optional(),
  )
  .output(z.object({ contacts: z.array(contactOutput) }))
  .handler(async ({ input, context }) => {
    const contacts = await prisma.paymentContact.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.includeInactive ? {} : { isActive: true }),
        ...(input?.type && input.type !== "BOTH"
          ? { contactType: { in: [input.type, "BOTH"] } }
          : {}),
        ...(input?.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { document: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
    return { contacts };
  });

export const createContact = p
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do contato"),
      document: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      contactType: contactType.default("BOTH"),
      notes: z.string().optional(),
      creditLimit: z.number().int().min(0).default(0),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const created = await prisma.paymentContact.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        document: input.document || null,
        email: input.email?.trim() || null,
        phone: input.phone || null,
        contactType: input.contactType,
        notes: input.notes || null,
        creditLimit: input.creditLimit,
      },
      select: { id: true },
    });
    return created;
  });

export const updateContact = p
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      document: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      contactType: contactType.optional(),
      notes: z.string().nullable().optional(),
      creditLimit: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const contact = await prisma.paymentContact.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!contact) throw errors.NOT_FOUND({ message: "Contato não encontrado" });
    await prisma.paymentContact.update({
      where: { id: input.id },
      data: {
        name: input.name,
        document: input.document,
        email: input.email,
        phone: input.phone,
        contactType: input.contactType,
        notes: input.notes,
        creditLimit: input.creditLimit,
        isActive: input.isActive,
      },
    });
    return { ok: true };
  });

export const deleteContact = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean(), deactivated: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const contact = await prisma.paymentContact.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, _count: { select: { entries: true } } },
    });
    if (!contact) throw errors.NOT_FOUND({ message: "Contato não encontrado" });

    if (contact._count.entries > 0) {
      await prisma.paymentContact.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { ok: true, deactivated: true };
    }
    await prisma.paymentContact.delete({ where: { id: input.id } });
    return { ok: true, deactivated: false };
  });
