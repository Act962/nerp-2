import prisma from "@/lib/db";
import { normalizePostcode } from "@/lib/postcode";
import { mintStoreSlug } from "@/lib/store-slug";

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
  /** CNPJ do estabelecimento. Usado pelo catálogo; `Store` não o guarda. */
  document?: string;
  /** Bairro. Melhora o casamento; `Store` não tem coluna própria para ele. */
  suburb?: string;
  /** CEP, com ou sem máscara — normalizado na gravação. */
  postcode?: string;
}

/**
 * Cria uma loja para uma organização. Centraliza a persistência para que a
 * importação em massa reuse o mesmo comportamento do handler `store.create`.
 */
export async function createStoreForOrg(
  input: CreateStoreInput,
  { orgId }: { orgId: string },
) {
  const store = await prisma.store.create({
    data: {
      organizationId: orgId,
      name: input.name,
      code: input.code,
      managerName: input.managerName,
      address: input.address,
      city: input.city,
      state: input.state,
      postcode: normalizePostcode(input.postcode),
      notes: input.notes,
    },
  });

  // Best-effort: sem slug a loja continua acessível pela URL antiga.
  await mintStoreSlug(store.id, store.name, store.city);
  return store;
}
