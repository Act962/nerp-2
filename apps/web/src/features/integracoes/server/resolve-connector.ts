import "server-only";
import { requireManifest } from "../catalog";
import { createInterConnector } from "./connectors/inter";
import type { FinancialConnector } from "./connectors/types";
import type { Credenciais } from "./credentials";

/**
 * Monta o conector do provedor a partir de credenciais já decifradas.
 *
 * Este é o único `switch` por provedor do sistema. Tudo depois dele fala o
 * contrato de `connectors/types.ts` e não sabe com quem está falando.
 */
export function criarConector(
  providerId: string,
  credenciais: Credenciais,
): FinancialConnector {
  const manifest = requireManifest(providerId);

  if (!manifest.disponivel) {
    throw new Error(`${manifest.nome} ainda não tem conector implementado.`);
  }

  switch (providerId) {
    case "inter":
      return createInterConnector({
        clientId: credenciais.clientId ?? "",
        clientSecret: credenciais.clientSecret ?? "",
        contaCorrente: credenciais.contaCorrente ?? "",
        cert: credenciais.certificado ?? "",
        key: credenciais.chavePrivada ?? "",
      });
    default:
      throw new Error(`Sem conector para o provedor ${providerId}.`);
  }
}
