import prisma from "@/lib/db";
import { PersonType } from "@/generated/prisma/enums";

/**
 * Dados de entrada para criar um fornecedor. Espelha os campos aceitos pela
 * procedure `supplier.create`, mas é independente do contexto oRPC para poder
 * ser reusado tanto pelo handler HTTP quanto pela função Inngest de importação.
 *
 * Segue a mesma convenção de `supplier.create`: o input usa `cep`, que é gravado
 * na coluna `zipCode` do Prisma.
 */
export interface CreateSupplierInput {
  name: string;
  tradeName?: string;
  personType?: PersonType;
  document?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  cep?: string;
  city?: string;
  state?: string;
  address?: string;
  notes?: string;
}

/**
 * Cria um fornecedor para uma organização. Centraliza a persistência para que a
 * importação em massa reuse o mesmo comportamento do handler `supplier.create`
 * (incluindo o mapeamento `cep` → `zipCode`).
 */
export async function createSupplierForOrg(
  input: CreateSupplierInput,
  { orgId }: { orgId: string },
) {
  return prisma.supplier.create({
    data: {
      organizationId: orgId,
      name: input.name,
      tradeName: input.tradeName,
      personType: input.personType ?? PersonType.JURIDICA,
      document: input.document,
      phone: input.phone,
      email: input.email,
      contactPerson: input.contactPerson,
      zipCode: input.cep,
      city: input.city,
      state: input.state,
      address: input.address,
      notes: input.notes,
    },
  });
}
