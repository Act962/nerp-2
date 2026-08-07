import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Supplier } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { normalizeDocument } from "@/lib/document";
import { z } from "zod";
import { canManageSuppliers } from "./_can-manage-suppliers";

export const updateSupplier = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      tradeName: z.string().optional(),
      personType: z.enum(["FISICA", "JURIDICA"]).optional(),
      document: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      contactPerson: z.string().optional(),
      logo: z.string().optional(),
      actionCodeImage: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .output(
    z.object({
      supplier: z.custom<Supplier>(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageSuppliers(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para editar fornecedores",
      });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });

    if (!supplier) {
      throw errors.NOT_FOUND({
        message: "Fornecedor não encontrado",
      });
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id: input.id },
      data: {
        name: input.name,
        tradeName: input.tradeName,
        personType: input.personType,
        document: normalizeDocument(input.document) ?? input.document,
        phone: input.phone,
        email: input.email,
        contactPerson: input.contactPerson,
        logo: input.logo,
        actionCodeImage: input.actionCodeImage,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        address: input.address,
        notes: input.notes,
      },
    });

    return { supplier: updatedSupplier };
  });
