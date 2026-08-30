import { ORPCError } from "@orpc/server";
import { ehSegredo, getManifest } from "@/features/integracoes/catalog";
import type { ProviderManifest } from "@/features/integracoes/catalog/types";
import {
  type Credenciais,
  decifrarCredenciais,
} from "@/features/integracoes/server/credentials";
import prisma from "@/lib/db";
import type { CredenciaisInput } from "./_schema";

export function exigirManifesto(providerId: string): ProviderManifest {
  const manifest = getManifest(providerId);
  if (!manifest) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Provedor de integração desconhecido.",
    });
  }
  return manifest;
}

/**
 * Junta o que veio do formulário com o que já estava cifrado.
 *
 * Segredo em branco significa "mantém o que está lá" — sem isso, editar o nome
 * de exibição obrigaria a reenviar certificado e senha, que é justamente o
 * caminho em que o usuário cola credencial errada.
 */
export async function montarCredenciais(
  organizationId: string,
  input: CredenciaisInput,
): Promise<{ manifest: ProviderManifest; valores: Credenciais }> {
  const manifest = exigirManifesto(input.providerId);

  if (!manifest.disponivel) {
    throw new ORPCError("BAD_REQUEST", {
      message: `${manifest.nome} ainda não pode ser conectado por aqui.`,
    });
  }

  const existente = await prisma.financialIntegration.findUnique({
    where: {
      organizationId_providerId_externalRef: {
        organizationId,
        providerId: input.providerId,
        externalRef: input.externalRef,
      },
    },
    select: { credentialsCiphertext: true },
  });

  let guardadas: Credenciais = {};
  if (existente?.credentialsCiphertext) {
    try {
      guardadas = decifrarCredenciais(existente.credentialsCiphertext);
    } catch {
      // Blob ilegível (chave de cifra trocada) não trava a tela: o usuário
      // reenvia tudo e a instalação se conserta sozinha.
      guardadas = {};
    }
  }

  const valores: Credenciais = {};
  const faltando: string[] = [];

  for (const campo of manifest.auth.campos) {
    const informado = input.valores[campo.key]?.trim();
    const anterior = guardadas[campo.key];
    const valor = informado || (ehSegredo(campo.tipo) ? anterior : informado);

    if (valor) {
      valores[campo.key] = valor;
    } else if (!campo.opcional) {
      faltando.push(campo.label);
    }
  }

  if (faltando.length > 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Informe: ${faltando.join(", ")}.`,
    });
  }

  return { manifest, valores };
}
