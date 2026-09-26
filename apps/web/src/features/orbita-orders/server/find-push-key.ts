import "server-only";
import prisma from "@/lib/db";
import { canPushCatalogOrders } from "../lib/scopes";

export type OrbitaPushKey = {
  id: string;
  apiKey: string;
  secretCiphertext: string;
};

/**
 * Chave ativa da org que pode empurrar pedidos ao Órbita. A mais recente
 * ganha: reconectar a integração gera chave nova sem revogar a anterior na
 * mesma hora.
 */
export async function findOrbitaPushKey(
  organizationId: string,
): Promise<OrbitaPushKey | null> {
  const keys = await prisma.nasaIntegrationKey.findMany({
    where: { organizationId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, apiKey: true, secretCiphertext: true, scopes: true },
  });
  const key = keys.find((candidate) => canPushCatalogOrders(candidate.scopes));
  if (!key) return null;
  return {
    id: key.id,
    apiKey: key.apiKey,
    secretCiphertext: key.secretCiphertext,
  };
}
