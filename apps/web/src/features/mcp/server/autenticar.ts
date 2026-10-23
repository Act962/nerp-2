import "server-only";
import { verifyDeviceAuth } from "@/lib/device-auth-verify";
import { podeMapearBanco } from "@/features/mapeamento-banco/server/acesso";
import {
  ESCOPOS_DO_MCP,
  type EscopoDoMcp,
  PLATAFORMA_DO_AGENTE,
} from "../escopos";

export interface AgenteAutenticado {
  organizationId: string;
  usuario: { id: string; email: string; name: string };
  tokenId: string;
  /** Escopos do token que o usuário AINDA tem direito de exercer. */
  habilidades: EscopoDoMcp[];
}

export type Autenticacao =
  | { ok: true; agente: AgenteAutenticado }
  | { ok: false; status: 401 | 403; motivo: string };

function ehEscopoDoMcp(escopo: string): escopo is EscopoDoMcp {
  return (ESCOPOS_DO_MCP as readonly string[]).includes(escopo);
}

/**
 * Quem está chamando o MCP e o que pode fazer. O token só diz quais
 * habilidades foram concedidas; cada uma é reconferida com a regra da
 * feature a cada chamada — tirar a pessoa da equipe ou da org derruba o agente
 * dela na hora, sem precisar revogar o token.
 */
export async function autenticarAgente(
  request: Request,
): Promise<Autenticacao> {
  const principal = await verifyDeviceAuth(request);
  if (!principal) {
    return {
      ok: false,
      status: 401,
      motivo:
        "Token ausente, inválido ou revogado. Gere um em Integrações › Banco de dados › Agente de IA.",
    };
  }
  // Token de caixa do desktop não vira agente, mesmo sendo um `Device` válido.
  if (principal.device.platform !== PLATAFORMA_DO_AGENTE) {
    return {
      ok: false,
      status: 403,
      motivo: "Este token é de um terminal, não de um agente de IA.",
    };
  }

  const usuario = {
    id: principal.user.id,
    email: principal.user.email,
    name: principal.user.name,
  };
  const habilidades: EscopoDoMcp[] = [];
  // Mapear e importar têm hoje o mesmo portão (equipe interna + admin da
  // org); continuam escopos separados para o token decidir se pode gravar.
  const podeUsarOBanco = await podeMapearBanco(principal.org.id, usuario);
  for (const escopo of principal.scopes.filter(ehEscopoDoMcp)) {
    if (podeUsarOBanco) habilidades.push(escopo);
  }
  if (habilidades.length === 0) {
    return {
      ok: false,
      status: 403,
      motivo:
        "O dono deste token não tem mais acesso a nenhuma habilidade do MCP nesta organização.",
    };
  }

  return {
    ok: true,
    agente: {
      organizationId: principal.org.id,
      usuario,
      tokenId: principal.device.id,
      habilidades,
    },
  };
}
