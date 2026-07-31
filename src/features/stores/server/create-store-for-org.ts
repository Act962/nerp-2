import prisma from "@/lib/db";

/**
 * Dados de entrada para criar uma loja. Espelha os campos aceitos pela
 * procedure `store.create`, mas é independente do contexto oRPC para poder
 * ser reusado tanto pelo handler HTTP quanto pela função Inngest de importação.
 */
export interface CreateStoreInput {
  name: string;
  code?: string;
  managerName?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
}

/**
 * Cria uma loja para uma organização. Centraliza a persistência para que a
 * importação em massa reuse o mesmo comportamento do handler `store.create`.
 */
export async function createStoreForOrg(
  input: CreateStoreInput,
  { orgId }: { orgId: string },
) {
  return prisma.store.create({
    data: {
      organizationId: orgId,
      name: input.name,
      code: input.code,
      managerName: input.managerName,
      address: input.address,
      city: input.city,
      state: input.state,
      notes: input.notes,
    },
  });
}
