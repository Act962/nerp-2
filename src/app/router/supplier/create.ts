import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { normalizeDocument } from "@/lib/document";
import { z } from "zod";

export const createSupplier = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string(),
      tradeName: z.string().optional(),
      personType: z.enum(["FISICA", "JURIDICA"]).default("JURIDICA"),
      document: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      contactPerson: z.string().optional(),
      logo: z.string().optional(),
      actionCodeImage: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      cep: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const supplier = await prisma.supplier.create({
      data: {
        name: input.name,
        tradeName: input.tradeName,
        personType: input.personType,
        // Só dígitos no banco: com máscara, a dedupe por documento nunca casa.
        document: normalizeDocument(input.document) ?? input.document,
        phone: input.phone,
        email: input.email,
        contactPerson: input.contactPerson,
        logo: input.logo,
        actionCodeImage: input.actionCodeImage,
        zipCode: input.cep,
        city: input.city,
        state: input.state,
        address: input.address,
        notes: input.notes,
        organizationId: context.org.id,
      },
    });

    return {
      id: supplier.id,
      name: supplier.name,
    };
  });
