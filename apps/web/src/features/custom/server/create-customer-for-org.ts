import prisma from "@/lib/db";
import { PersonType } from "@/generated/prisma/enums";

/**
 * Dados de entrada para criar um cliente. Espelha os campos aceitos pela
 * procedure `customer.create`, mas é independente do contexto oRPC para poder
 * ser reusado tanto pelo handler HTTP quanto pela função Inngest de importação.
 *
 * Segue a mesma convenção de `customer.create`: o input usa `cep`, que é gravado
 * na coluna `zipCode` do Prisma, e `notes` para observações.
 */
export interface CreateCustomerInput {
  name: string;
  email?: string;
  personType?: PersonType;
  document?: string;
  phone?: string;
  cep?: string;
  city?: string;
  state?: string;
  address?: string;
  notes?: string;
}

/**
 * Cria um cliente para uma organização. Centraliza a persistência para que a
 * importação em massa reuse o mesmo comportamento do handler `customer.create`
 * (incluindo o mapeamento `cep` → `zipCode`).
 */
export async function createCustomerForOrg(
  input: CreateCustomerInput,
  { orgId }: { orgId: string },
) {
  return prisma.customer.create({
    data: {
      organizationId: orgId,
      name: input.name,
      // Vazio/espaços viram null (não colidem na constraint única por org).
      email: input.email?.trim() || null,
      personType: input.personType ?? PersonType.FISICA,
      document: input.document,
      phone: input.phone,
      zipCode: input.cep,
      city: input.city,
      state: input.state,
      address: input.address,
      notes: input.notes,
    },
  });
}
