import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import type { Customer } from "@/generated/prisma/client";
import type { CustomerUpdateInput } from "@/generated/prisma/models";
import prisma from "@/lib/db";
import { z } from "zod";

// `priceListId` é campo escalar novo — o `CustomerUpdateInput` gerado o
// expõe como relação (`priceList: {connect: ...}`), o que é chato pro client.
// Aceitamos os dois: se o cliente enviar `priceListId` (string|null), o
// handler mapeia pra relação Prisma.
type UpdateCustomerInput = CustomerUpdateInput & {
  id: string;
  priceListId?: string | null;
};

export const updateCustomer = base
  .use(requireAuthMiddleware)
  .input(z.custom<UpdateCustomerInput>())
  .output(
    z.object({
      customer: z.custom<Customer>(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const customer = await prisma.customer.findUnique({
      where: {
        id: input.id,
      },
    });
    if (!customer) {
      throw errors.NOT_FOUND({
        message: "Cliente não encontrado",
      });
    }
    const updatedCustomer = await prisma.customer.update({
      where: {
        id: input.id,
      },
      data: {
        name: input.name,
        document: input.document,
        phone: input.phone,
        // Vazio/espaços viram null para não colidir na constraint única
        // `organizationId_email`; `undefined` mantém o valor atual.
        email:
          typeof input.email === "string"
            ? input.email.trim() || null
            : input.email,
        personType: input.personType,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        address: input.address,
        notes: input.notes,
        // Tabela de preço vinculada — mapeia `priceListId` (string|null) do
        // input escalar pra sintaxe de relação Prisma. `null` = desvincula.
        ...(input.priceListId === null
          ? { priceList: { disconnect: true } }
          : input.priceListId
            ? { priceList: { connect: { id: input.priceListId } } }
            : {}),
      },
    });

    return {
      customer: updatedCustomer,
    };
  });
