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

/** Prisma sinaliza violação de índice único com este código. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Cria uma loja para uma organização. Centraliza a persistência para que a
 * importação em massa reuse o mesmo comportamento do handler `store.create`.
 *
 * `slug` existe para a importação em massa: cunhar linha a linha custa duas
 * consultas mais um update por loja, e num arquivo de 15 mil clientes isso é o
 * que estoura o tempo da invocação. Quem importa resolve o slug em memória e
 * grava tudo num INSERT só; o resto do sistema continua chamando sem o campo.
 */
export async function createStoreForOrg(
  input: CreateStoreInput,
  { orgId, slug }: { orgId: string; slug?: string | null },
) {
  const data = {
    organizationId: orgId,
    name: input.name,
    code: input.code,
    managerName: input.managerName,
    address: input.address,
    city: input.city,
    state: input.state,
    postcode: normalizePostcode(input.postcode),
    notes: input.notes,
  };

  if (slug !== undefined) {
    try {
      return await prisma.store.create({ data: { ...data, slug } });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Alguém cravou o mesmo slug entre o cálculo em memória e o INSERT. A
      // loja sem slug continua acessível pela URL antiga e o backfill pega
      // depois — perder o cadastro do cliente por causa da URL bonita, não.
      return await prisma.store.create({ data });
    }
  }

  const store = await prisma.store.create({ data });

  // Best-effort: sem slug a loja continua acessível pela URL antiga.
  await mintStoreSlug(store.id, store.name, store.city);
  return store;
}
